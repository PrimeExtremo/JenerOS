// Package storage discovers blank whole disks and queues work for a root worker.
package storage

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

const MinDiskBytes = uint64(1024 * 1024 * 1024)

var namePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)
var diskPattern = regexp.MustCompile(`^/dev/[a-zA-Z0-9]+$`)
var ErrBusy = errors.New("Storage is already being created. Please wait.")
var ErrUnavailable = errors.New("Storage creation is available after setup on your JenerOS box.")

type Paths struct {
	Request, Status, SetupDone, Helper, SysBlock, Pools, Records, Units string
}

var DefaultPaths = Paths{
	Request: "/run/jeneros/storage.request", Status: "/run/jeneros-storage/status.json",
	SetupDone: "/var/lib/jeneros/setup-done", Helper: "/usr/lib/jeneros/storage-create",
	SysBlock: "/sys/block", Pools: "/var/lib/jeneros/pools",
	Records: "/var/lib/jeneros/storage", Units: "/etc/systemd/system",
}

type Disk struct {
	Path       string `json:"path"`
	Model      string `json:"model"`
	Serial     string `json:"serial"`
	Size       uint64 `json:"size"`
	Rotational bool   `json:"rotational"`
	Transport  string `json:"transport"`
	System     bool   `json:"system"`
	Eligible   bool   `json:"eligible"`
	Reason     string `json:"reason"`
	Identity   string `json:"identity"`
}

type Status struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	State   string `json:"state"`
	Message string `json:"message"`
	Percent int    `json:"percent"`
}

type Pool struct {
	Name    string `json:"name"`
	Profile string `json:"profile"`
	UUID    string `json:"uuid"`
	Path    string `json:"path"`
	State   string `json:"state"`
	Total   uint64 `json:"total"`
	Free    uint64 `json:"free"`
	Mounted bool   `json:"mounted"`
}

type Info struct {
	Disks     []Disk `json:"disks"`
	Pools     []Pool `json:"pools"`
	Status    Status `json:"status"`
	Available bool   `json:"available"`
	Requested bool   `json:"requested"`
}

type Request struct {
	Name    string   `json:"name"`
	Profile string   `json:"profile"`
	Disks   []string `json:"disks"`
	Erase   bool     `json:"erase"`
	// Identity ties the user's selection to the observed devices, not just sdX.
	Identities map[string]string `json:"identities"`
}

type Job struct {
	Request
	ID string `json:"id"`
}

// Run always uses fixed programs and argv, never a shell or caller environment.
func Run(ctx context.Context, program string, args ...string) ([]byte, error) {
	dir := "/usr/bin/"
	if program == "wipefs" || program == "mkfs.btrfs" || program == "blkid" {
		dir = "/usr/sbin/"
	}
	cmd := exec.CommandContext(ctx, dir+program, args...)
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin", "LC_ALL=C"}
	b, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("%s failed: %w", program, err)
	}
	return b, nil
}

type Block struct {
	Name        string   `json:"name"`
	Size        uint64   `json:"size"`
	Type        string   `json:"type"`
	Model       string   `json:"model"`
	Serial      string   `json:"serial"`
	Rota        bool     `json:"rota"`
	Tran        string   `json:"tran"`
	Mountpoints []string `json:"mountpoints"`
	FSType      string   `json:"fstype"`
	PKName      string   `json:"pkname"`
	Children    []Block  `json:"children"`
}

func systemMount(m string) bool {
	return m == "/" || m == "/usr" || m == "/var" || m == "/etc" || m == "/boot" || m == "/efi" || strings.HasPrefix(m, "/boot/")
}

func flags(b Block) (system, mounted bool) {
	for _, m := range b.Mountpoints {
		mounted = mounted || m != ""
		system = system || systemMount(m)
	}
	for _, child := range b.Children {
		s, m := flags(child)
		system, mounted = system || s, mounted || m
	}
	return
}

// Filter deliberately rejects even empty partition tables. Imported storage is
// a separate flow; absence of a filesystem label alone does not prove emptiness.
func Filter(blocks []Block) []Disk {
	out := []Disk{}
	rootKnown := false
	var hasRoot func(Block)
	hasRoot = func(b Block) {
		for _, m := range b.Mountpoints {
			if m == "/" {
				rootKnown = true
			}
		}
		for _, c := range b.Children {
			hasRoot(c)
		}
	}
	for _, b := range blocks {
		hasRoot(b)
	}
	for _, b := range blocks {
		if b.Type != "disk" {
			continue
		}
		system, mounted := flags(b)
		d := Disk{Path: "/dev/" + b.Name, Model: strings.TrimSpace(b.Model), Serial: strings.TrimSpace(b.Serial), Size: b.Size, Rotational: b.Rota, Transport: b.Tran, System: system}
		switch {
		case system:
			d.Reason = "System disk"
		case !rootKnown:
			d.Reason = "Could not identify the system disk"
		case mounted:
			d.Reason = "In use"
		case b.FSType != "" || len(b.Children) != 0 || b.PKName != "":
			d.Reason = "Contains data or partitions"
		case b.Size < MinDiskBytes:
			d.Reason = "Needs at least 1 GB"
		case !diskPattern.MatchString(d.Path):
			d.Reason = "Unsupported disk path"
		default:
			d.Eligible = true
		}
		out = append(out, d)
	}
	return out
}

func Discover(ctx context.Context, p Paths) ([]Disk, error) {
	b, err := Run(ctx, "lsblk", "-J", "-b", "-o", "NAME,SIZE,TYPE,MODEL,SERIAL,ROTA,TRAN,MOUNTPOINTS,FSTYPE,PKNAME")
	if err != nil {
		return nil, err
	}
	var tree struct {
		Blocks []Block `json:"blockdevices"`
	}
	if err := json.Unmarshal(b, &tree); err != nil {
		return nil, err
	}
	return inspect(Filter(tree.Blocks), p.SysBlock)
}

func inspect(disks []Disk, sysRoot string) ([]Disk, error) {
	for i := range disks {
		d := &disks[i]
		sys := filepath.Join(sysRoot, filepath.Base(d.Path))
		entries, err := os.ReadDir(sys)
		if err != nil {
			return nil, err
		}
		ro, err := os.ReadFile(filepath.Join(sys, "ro"))
		if err != nil {
			return nil, err
		}
		holders, err := os.ReadDir(filepath.Join(sys, "holders"))
		if err != nil {
			return nil, err
		}
		if d.Eligible && (strings.TrimSpace(string(ro)) != "0" || len(holders) > 0) {
			d.Eligible, d.Reason = false, "Read-only or in use"
		}
		for _, entry := range entries {
			_, err := os.Stat(filepath.Join(sys, entry.Name(), "partition"))
			if err == nil {
				d.Eligible, d.Reason = false, "Contains partitions"
			} else if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, syscall.ENOTDIR) {
				return nil, err
			}
		}
		dev, err := os.ReadFile(filepath.Join(sys, "dev"))
		if err != nil {
			return nil, err
		}
		// Kernel disk sequence changes when a device is reattached, including
		// virtual/USB disks with no serial or identical model and capacity.
		sequence, err := os.ReadFile(filepath.Join(sys, "diskseq"))
		if err != nil {
			return nil, err
		}
		real, err := filepath.EvalSymlinks(sys)
		if err != nil {
			return nil, err
		}
		h := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s|%s|%d", real, dev, sequence, d.Serial, d.Model, d.Size)))
		d.Identity = hex.EncodeToString(h[:])
	}
	return disks, nil
}

func Decode(r io.Reader, v any) error {
	d := json.NewDecoder(io.LimitReader(r, 16385))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return errors.New("Send one valid storage request.")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("Send one valid storage request.")
	}
	return nil
}

func Validate(r Request, disks []Disk) error {
	if !namePattern.MatchString(r.Name) {
		return errors.New("Use 1–32 lowercase letters, numbers or dashes, starting with a letter.")
	}
	if !r.Erase {
		return errors.New("Confirm that these disks will be erased.")
	}
	n := len(r.Disks)
	if n > 32 || (r.Profile == "single" && n != 1) || (r.Profile == "raid1" && n < 2) || (r.Profile == "raid10" && n < 4) {
		return errors.New("Choose enough disks for this layout (one, two or four minimum).")
	}
	if r.Profile != "single" && r.Profile != "raid1" && r.Profile != "raid10" {
		return errors.New("Choose Safe, Fast and safe, or One disk.")
	}
	seen := map[string]bool{}
	for _, path := range r.Disks {
		if !diskPattern.MatchString(path) || seen[path] {
			return errors.New("Choose each whole disk only once.")
		}
		seen[path] = true
		found := false
		for _, d := range disks {
			if d.Path == path && d.Eligible && !d.System && d.Size >= MinDiskBytes && d.Identity != "" && r.Identities[path] == d.Identity {
				found = true
			}
		}
		if !found {
			return errors.New("A selected disk changed or is not empty. Refresh the disk list.")
		}
	}
	return nil
}

func Read(p Paths) (Info, error) {
	info := Info{Disks: []Disk{}, Pools: []Pool{}}
	_, done := os.Stat(p.SetupDone)
	_, helper := os.Stat(p.Helper)
	info.Available = done == nil && helper == nil
	if b, err := os.ReadFile(p.Status); err == nil {
		if err := json.Unmarshal(b, &info.Status); err != nil {
			return info, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return info, err
	}
	if b, err := os.ReadFile(p.Request); err == nil {
		var job Job
		if err := Decode(strings.NewReader(string(b)), &job); err != nil {
			return info, err
		}
		info.Requested = true
		if info.Status.ID != job.ID {
			info.Status = Status{ID: job.ID, Name: job.Name, State: "queued", Message: "Waiting to begin…"}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return info, err
	}
	return info, nil
}

func Queue(p Paths, req Request, disks []Disk) (Job, error) {
	job := Job{Request: req}
	if err := Validate(req, disks); err != nil {
		return job, err
	}
	info, err := Read(p)
	if err != nil {
		return job, err
	}
	if !info.Available {
		return job, ErrUnavailable
	}
	if info.Requested || info.Status.State == "working" {
		return job, ErrBusy
	}
	for _, path := range []string{filepath.Join(p.Pools, req.Name), filepath.Join(p.Records, req.Name+".json")} {
		if _, err := os.Lstat(path); err == nil {
			return job, errors.New("That storage name is already in use.")
		} else if !errors.Is(err, os.ErrNotExist) {
			return job, err
		}
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return job, err
	}
	job.ID = hex.EncodeToString(id)
	b, err := json.Marshal(job)
	if err != nil {
		return job, err
	}
	f, err := os.CreateTemp(filepath.Dir(p.Request), ".storage-*")
	if err != nil {
		return job, err
	}
	defer os.Remove(f.Name())
	if _, err := f.Write(b); err != nil {
		f.Close()
		return job, err
	}
	if err := f.Close(); err != nil {
		return job, err
	}
	if err := os.Link(f.Name(), p.Request); err != nil {
		if errors.Is(err, os.ErrExist) {
			return job, ErrBusy
		}
		return job, err
	}
	return job, nil
}

func Inventory(p Paths) (Info, error) {
	info, err := Read(p)
	if err != nil {
		return info, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	info.Disks, err = Discover(ctx, p)
	if err != nil {
		return info, err
	}
	info.Pools, err = readPools(p)
	return info, err
}
