package setup

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func applyFixture(t *testing.T) (Paths, Request) {
	t.Helper()
	dir := t.TempDir()
	p := Paths{
		Done: filepath.Join(dir, "state", "setup-done"), Owner: filepath.Join(dir, "state", "owner"),
		PendingOwner: filepath.Join(dir, "state", "setup-owner-pending"), Request: filepath.Join(dir, "setup.request"),
		Code: filepath.Join(dir, "setup-code"), Status: filepath.Join(dir, "status.json"),
		ZoneTable: filepath.Join(dir, "zone.tab"), Network: filepath.Join(dir, "10-jeneros.network"),
		Keyboard: filepath.Join(dir, "keyboard"),
	}
	if err := os.WriteFile(p.ZoneTable, []byte("US\t+4042-07400\tAmerica/New_York\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := New(p); err != nil {
		t.Fatal(err)
	}
	r := Request{Hostname: "my-box", Username: "jener", Keymap: "us", Timezone: "UTC", Password: "private-pass", PasswordConfirm: "private-pass", Network: Network{Mode: "automatic"}}
	r.AcceptedPrivacy, r.Language = true, "en"
	r.PrivacyAcceptedAt, r.PrivacyPolicyVersion = "2026-10-07T12:00:00Z", PrivacyPolicyVersion
	queueFixture(t, p, r)
	return p, r
}

func queueFixture(t *testing.T, p Paths, r Request) {
	t.Helper()
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	if err := atomicWrite(p.Request, b, 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestApplyUsesStdinAndClosesSetup(t *testing.T) {
	p, req := applyFixture(t)
	var commands []string
	run := func(name, stdin string, args ...string) error {
		commands = append(commands, name)
		if strings.Contains(strings.Join(args, " "), req.Password) {
			t.Fatal("password in command line")
		}
		if name == "chpasswd" && stdin != req.Username+":"+req.Password+"\n" {
			t.Fatal("wrong chpasswd input")
		}
		return nil
	}
	if err := apply(p, run, func(string) (bool, error) {
		return false, nil
	}); err != nil {
		t.Fatal(err)
	}
	if strings.Join(commands, ",") != "localectl,setupcon,timedatectl,hostnamectl,useradd,chpasswd" {
		t.Fatal("unexpected commands")
	}
	for _, path := range []string{p.Done, p.Owner, p.Status} {
		if _, err := os.Stat(path); err != nil {
			t.Fatal(err)
		}
	}
	for _, path := range []string{p.Request, p.Code, p.PendingOwner} {
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("%s not removed", path)
		}
	}
	owner, err := os.ReadFile(p.Owner)
	if err != nil || string(owner) != "jener\n" {
		t.Fatal("owner not saved")
	}
	status, err := os.ReadFile(p.Status)
	if err != nil || strings.Contains(string(status), req.Password) || !strings.Contains(string(status), `"state":"done"`) {
		t.Fatal("unsafe or missing status")
	}
}

func TestApplyFailureCanRetryOnlyPendingOwner(t *testing.T) {
	p, req := applyFixture(t)
	run := func(name, stdin string, args ...string) error {
		if name == "chpasswd" {
			return errors.New("chpasswd could not finish.")
		}
		return nil
	}
	if err := apply(p, run, func(string) (bool, error) {
		return false, nil
	}); err == nil {
		t.Fatal("failure not returned")
	}
	if _, err := os.Stat(p.Done); !os.IsNotExist(err) {
		t.Fatal("failed apply marked done")
	}
	if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
		t.Fatal("password request left on failure")
	}
	status, err := os.ReadFile(p.Status)
	if err != nil || !strings.Contains(string(status), `"state":"failed"`) || strings.Contains(string(status), req.Password) {
		t.Fatal("failure not safely recorded")
	}
	queueFixture(t, p, req)
	if err := apply(p, func(name, stdin string, args ...string) error {
		if name == "useradd" {
			t.Fatal("retry must reuse its own partial account")
		}
		return nil
	}, func(string) (bool, error) { return true, nil }); err != nil {
		t.Fatal(err)
	}
}

func TestApplyNeverClaimsExistingAccount(t *testing.T) {
	p, _ := applyFixture(t)
	if err := apply(p, func(string, string, ...string) error {
		t.Fatal("must reject before commands")
		return nil
	}, func(string) (bool, error) { return true, nil }); err == nil {
		t.Fatal("existing account accepted")
	}
}

func TestDebianKeyboardFallback(t *testing.T) {
	p, _ := applyFixture(t)
	loaded := false
	if err := apply(p, func(name, stdin string, args ...string) error {
		if name == "localectl" {
			return errors.New("keymap changes are unsupported")
		}
		if name == "loadkeys" {
			loaded = true
		}
		return nil
	}, func(string) (bool, error) { return false, nil }); err != nil {
		t.Fatal(err)
	}
	if !loaded {
		t.Fatal("Debian fallback did not load a console map")
	}
	keyboard, err := os.ReadFile(p.Keyboard)
	if err != nil || !strings.Contains(string(keyboard), "XKBLAYOUT=us\n") {
		t.Fatal("Debian boot keyboard configuration not saved")
	}
}

func TestApplyWritesFixedNetwork(t *testing.T) {
	p, req := applyFixture(t)
	info, err := ReadInfo(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(info.Interfaces) == 0 {
		t.Skip("no network interface on this test host")
	}
	req.Network = Network{Mode: "fixed", Interface: info.Interfaces[0], Address: "192.168.1.20/24", Gateway: "192.168.1.1", DNS: []string{"192.168.1.1", "1.1.1.1"}}
	queueFixture(t, p, req)
	var networkCommands []string
	if err := apply(p, func(name, stdin string, args ...string) error {
		if name == "networkctl" {
			networkCommands = append(networkCommands, strings.Join(args, " "))
		}
		return nil
	}, func(string) (bool, error) { return false, nil }); err != nil {
		t.Fatal(err)
	}
	config, err := os.ReadFile(p.Network)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range []string{"Name=" + req.Network.Interface + "\n", "DHCP=no\n", "Address=192.168.1.20/24\n", "Gateway=192.168.1.1\n", "DNS=1.1.1.1\n"} {
		if !strings.Contains(string(config), line) {
			t.Fatalf("missing network setting %q", line)
		}
	}
	if strings.Join(networkCommands, ",") != "reload,reconfigure "+req.Network.Interface {
		t.Fatal("fixed network was not reloaded and reconfigured")
	}
}

func TestFixedNetworkValidation(t *testing.T) {
	_, req := applyFixture(t)
	info := Info{Timezones: []string{"UTC"}, Keymaps: Keymaps, Interfaces: []string{"ens33"}}
	req.Network = Network{Mode: "fixed", Interface: "ens33", Address: "192.168.1.20/24", Gateway: "192.168.1.1", DNS: []string{"192.168.1.1", "1.1.1.1"}}
	if err := Validate(req, info); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ name, value string }{{"address", "192.168.1.20"}, {"address", "127.0.0.1/8"}, {"gateway", "10.0.0.1"}, {"dns", "1.1.1.1\nDNS=evil"}, {"interface", "ens33\nName=*"}} {
		t.Run(tc.name+tc.value, func(t *testing.T) {
			bad := req
			switch tc.name {
			case "address":
				bad.Network.Address = tc.value
			case "gateway":
				bad.Network.Gateway = tc.value
			case "dns":
				bad.Network.DNS = []string{tc.value}
			case "interface":
				bad.Network.Interface = tc.value
			}
			if err := Validate(bad, info); err == nil {
				t.Fatal("unsafe fixed network accepted")
			}
		})
	}
}
