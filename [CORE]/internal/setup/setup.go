// Package setup queues first-boot choices for a separate root applier.
// It uses only the standard library; passwords never go into status or logs.
package setup

import (
	"bufio"
	"crypto/rand"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math/big"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type Paths struct {
	Done, Owner, PendingOwner, Request, Code, Status, ZoneTable, Network, Keyboard string
}

var DefaultPaths = Paths{
	Done: "/var/lib/jeneros/setup-done", Owner: "/var/lib/jeneros/owner",
	PendingOwner: "/var/lib/jeneros/setup-owner-pending",
	Request:      "/run/jeneros/setup.request", Code: "/run/jeneros/setup-code",
	Status: "/run/jeneros-setup/status.json", ZoneTable: "/usr/share/zoneinfo/zone.tab",
	Network:  "/etc/systemd/network/10-jeneros.network",
	Keyboard: "/etc/default/keyboard",
}

type Keymap struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// These names match console-data keymaps. The root helper also sets the XKB
// layout so Cage uses the owner's layout on later boots.
var Keymaps = []Keymap{
	{"us", "English (US)"}, {"uk", "English (UK)"}, {"de", "German"},
	{"fr", "French"}, {"es", "Spanish"}, {"it", "Italian"},
	{"pt-latin1", "Portuguese"}, {"br-abnt2", "Portuguese (Brazil)"},
	{"fi", "Finnish"}, {"dvorak", "English (Dvorak)"},
}

type Network struct {
	Mode      string   `json:"mode"`
	Interface string   `json:"interface,omitempty"`
	Address   string   `json:"address,omitempty"`
	Gateway   string   `json:"gateway,omitempty"`
	DNS       []string `json:"dns,omitempty"`
}

type Request struct {
	AcceptedPrivacy      bool    `json:"acceptedPrivacy"`
	Language             string  `json:"language"`
	PrivacyAcceptedAt    string  `json:"privacyAcceptedAt,omitempty"`
	PrivacyPolicyVersion string  `json:"privacyPolicyVersion,omitempty"`
	Code                 string  `json:"code,omitempty"`
	Keymap               string  `json:"keymap"`
	Timezone             string  `json:"timezone"`
	Hostname             string  `json:"hostname"`
	Username             string  `json:"username"`
	Password             string  `json:"password"`
	PasswordConfirm      string  `json:"passwordConfirm"`
	Network              Network `json:"network"`
}

type Info struct {
	PrivacyPolicyVersion string   `json:"privacyPolicyVersion"`
	ReservedUsernames    []string `json:"reservedUsernames"`
	Done                 bool     `json:"done"`
	Interfaces           []string `json:"interfaces"`
	Timezones            []string `json:"timezones"`
	Keymaps              []Keymap `json:"keymaps"`
	Hostname             string   `json:"hostname"`
	IP                   string   `json:"ip"`
}

type Status struct {
	State   string `json:"state"`
	Message string `json:"message,omitempty"`
}

var ErrDone = errors.New("Your box is already set up.")
var ErrCode = errors.New("Use the setup link or code shown on your box's screen.")
var ErrBusy = errors.New("Your box is already applying setup. Please wait.")

type ValidationError struct {
	error
}

type Manager struct {
	paths Paths
	code  string
	mu    sync.Mutex
}

func New(p Paths) (*Manager, error) {
	m := &Manager{paths: p}
	done, err := m.Done()
	if err != nil || done {
		return m, err
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return nil, err
	}
	m.code = fmt.Sprintf("%06d", n.Int64())
	if err := atomicWrite(p.Code, []byte(m.code+"\n"), 0o644); err != nil {
		return nil, err
	}
	return m, nil
}

func (m *Manager) Done() (bool, error) {
	return exists(m.paths.Done)
}

func exists(path string) (bool, error) {
	_, err := os.Stat(path)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return err == nil, err
}

func ReadInfo(p Paths) (Info, error) {
	zones, err := timezones(p.ZoneTable)
	if err != nil {
		return Info{}, err
	}
	ifs, err := net.Interfaces()
	if err != nil {
		return Info{}, err
	}
	info := Info{Interfaces: []string{}, Timezones: zones, Keymaps: Keymaps, PrivacyPolicyVersion: PrivacyPolicyVersion, ReservedUsernames: ReservedUsernames}
	info.Hostname, err = os.Hostname()
	if err != nil {
		return Info{}, err
	}
	var ipv6 string
	for _, iface := range ifs {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		info.Interfaces = append(info.Interfaces, iface.Name)
		addrs, err := iface.Addrs()
		if err != nil {
			return Info{}, err
		}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip.To4() != nil && !ip.IsLoopback() && info.IP == "" {
				info.IP = ip.String()
			}
			if err == nil && ip.To4() == nil && ip.IsGlobalUnicast() && ipv6 == "" {
				ipv6 = ip.String()
			}
		}
	}
	if info.IP == "" {
		info.IP = ipv6
	}
	return info, nil
}

func (m *Manager) Info() (Info, error) {
	return ReadInfo(m.paths)
}

func timezones(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	zones := []string{"UTC"}
	s := bufio.NewScanner(f)
	for s.Scan() {
		if strings.HasPrefix(s.Text(), "#") {
			continue
		}
		fields := strings.Fields(s.Text())
		if len(fields) >= 3 {
			zones = append(zones, fields[2])
		}
	}
	sort.Strings(zones)
	return zones, s.Err()
}

func Decode(r io.Reader) (Request, error) {
	var req Request
	d := json.NewDecoder(r)
	d.DisallowUnknownFields()
	if err := d.Decode(&req); err != nil {
		return req, errors.New("Please send valid setup choices.")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return req, errors.New("Please send one set of setup choices.")
	}
	return req, nil
}

var hostnamePattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

const PrivacyPolicyVersion = "2026-10-08"

// Keep the owner separate from packaged service accounts. The API publishes
// this list so the wizard and root applier use the same reserved names.
var ReservedUsernames = []string{
	"root", "daemon", "bin", "sys", "sync", "games", "man", "lp", "mail", "news",
	"uucp", "proxy", "www-data", "backup", "list", "irc", "_apt", "nobody",
	"systemd-network", "systemd-timesync", "systemd-resolve", "messagebus",
	"sshd", "ssh", "avahi", "polkitd", "dnsmasq", "ntp", "chrony", "tcpdump",
	"uuidd", "usbmux", "statd", "saned", "cups-pk-helper", "geoclue", "speech-dispatcher",
	"jenerd", "jeneros", "jeneros-kiosk", "incus", "lxd",
}

var usernamePattern = regexp.MustCompile(`^[a-z][a-z0-9_-]{0,31}$`)
var interfacePattern = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{1,15}$`)

func Validate(req Request, info Info) error {
	if !req.AcceptedPrivacy {
		return errors.New("Please accept the JenerOS Privacy Policy to continue.")
	}
	if req.Language != "en" {
		return errors.New("Choose English for now. More languages are coming.")
	}
	if !hostnamePattern.MatchString(req.Hostname) {
		return errors.New("Box name: use 1–63 lowercase letters, numbers or dashes. Start and end with a letter or number.")
	}
	if !usernamePattern.MatchString(req.Username) || contains(ReservedUsernames, req.Username) {
		return errors.New("Username: start with a lowercase letter; use up to 32 lowercase letters, numbers, underscores or dashes. Choose a name that isn't reserved.")
	}
	if !utf8.ValidString(req.Password) || utf8.RuneCountInString(req.Password) < 6 || len(req.Password) > 256 || strings.ContainsAny(req.Password, "\r\n\x00") {
		return errors.New("Choose a password with 6 or more characters (up to 256 bytes), without line breaks.")
	}
	if req.Password != req.PasswordConfirm {
		return errors.New("The passwords don't match. Please type them again.")
	}
	keymapOK := false
	for _, k := range info.Keymaps {
		if req.Keymap == k.ID {
			keymapOK = true
		}
	}
	if !keymapOK {
		return errors.New("Choose a keyboard layout from the list.")
	}
	if !contains(info.Timezones, req.Timezone) {
		return errors.New("Choose a timezone from the list.")
	}
	n := req.Network
	if n.Mode == "automatic" {
		if n.Interface != "" || n.Address != "" || n.Gateway != "" || len(n.DNS) != 0 {
			return errors.New("Automatic networking doesn't need fixed address settings.")
		}
		return nil
	}
	if n.Mode != "fixed" {
		return errors.New("Choose Automatic or Fixed for your network.")
	}
	if !interfacePattern.MatchString(n.Interface) || !contains(info.Interfaces, n.Interface) {
		return errors.New("Choose a network connection from the list.")
	}
	addr, err := netip.ParsePrefix(n.Address)
	if err != nil || !usableIP(addr.Addr()) || addr.Bits() == 0 {
		return errors.New("Enter an address with its prefix, like 192.168.1.20/24.")
	}
	if ipv4Edge(addr.Addr(), addr) {
		return errors.New("Choose a box address inside the network, not its first or last address.")
	}
	gw, err := netip.ParseAddr(n.Gateway)
	if err != nil || !usableIP(gw) || gw.Is4() != addr.Addr().Is4() || !addr.Contains(gw) || gw == addr.Addr() {
		return errors.New("Enter a router address on the same network as your box.")
	}
	if ipv4Edge(gw, addr) {
		return errors.New("Use your router's own address, not the network's first or last address.")
	}
	if len(n.DNS) == 0 || len(n.DNS) > 3 {
		return errors.New("Enter one to three DNS server addresses.")
	}
	for _, dns := range n.DNS {
		ip, err := netip.ParseAddr(dns)
		if err != nil || !usableIP(ip) {
			return errors.New("Use IP addresses for your DNS servers.")
		}
	}
	return nil
}

func usableIP(ip netip.Addr) bool {
	return ip.IsValid() && ip.Zone() == "" && !ip.Is4In6() && ip.IsGlobalUnicast() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast()
}

func ipv4Edge(ip netip.Addr, prefix netip.Prefix) bool {
	if !ip.Is4() || prefix.Bits() >= 31 {
		return false
	}
	if ip == prefix.Masked().Addr() {
		return true
	}
	bytes := ip.As4()
	value := uint32(bytes[0])<<24 | uint32(bytes[1])<<16 | uint32(bytes[2])<<8 | uint32(bytes[3])
	hostMask := (uint32(1) << uint(32-prefix.Bits())) - 1
	return value&hostMask == hostMask
}

func contains(list []string, value string) bool {
	for _, v := range list {
		if value == v {
			return true
		}
	}
	return false
}

func (m *Manager) Submit(req Request) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	done, err := m.Done()
	if err != nil {
		return err
	}
	if done {
		return ErrDone
	}
	if m.code == "" || subtle.ConstantTimeCompare([]byte(req.Code), []byte(m.code)) != 1 {
		return ErrCode
	}
	busy, err := exists(m.paths.Request)
	if err != nil {
		return err
	}
	if busy {
		return ErrBusy
	}
	info, err := m.Info()
	if err != nil {
		return err
	}
	if err := Validate(req, info); err != nil {
		return ValidationError{err}
	}
	// Never persist the code: only the in-memory code authorizes HTTP requests.
	req.Code = ""
	// The server owns the timestamp and version; client-supplied audit values
	// are overwritten after consent and all setup choices have been checked.
	req.PrivacyAcceptedAt = time.Now().UTC().Format(time.RFC3339Nano)
	req.PrivacyPolicyVersion = PrivacyPolicyVersion
	b, err := json.Marshal(req)
	if err != nil {
		return err
	}
	return atomicWrite(m.paths.Request, b, 0o600)
}

func (m *Manager) Status() (Status, error) {
	busy, err := exists(m.paths.Request)
	if err != nil {
		return Status{}, err
	}
	if busy {
		return Status{State: "applying", Message: "Setting up your box. Please keep it switched on."}, nil
	}
	b, err := os.ReadFile(m.paths.Status)
	if errors.Is(err, fs.ErrNotExist) {
		return Status{State: "waiting"}, nil
	}
	if err != nil {
		return Status{}, err
	}
	var status Status
	err = json.Unmarshal(b, &status)
	return status, err
}

// Publish complete files with a rename so the systemd path watcher cannot
// start the applier while a password or status file is only partly written.
func atomicWrite(path string, data []byte, mode fs.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".setup-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err := f.Chmod(mode); err != nil {
		f.Close()
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}
