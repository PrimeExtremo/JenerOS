package system

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBoxFacts(t *testing.T) {
	dir := t.TempDir()
	write := func(name, value string) {
		t.Helper()
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(value), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("dmi/sys_vendor", " Jener, Inc.\n")
	write("dmi/product_name", "Tiny box\x00\n")
	write("proc/sys/kernel/osrelease", "6.12.0-amd64\n")
	write("os-release", "# comment\nIMAGE_VERSION=\"0.3.1\"\nVERSION_ID=0.3.0\nBUILD_DATE='2026-10-07T12:00:00Z'\n")
	write("proc/net/tcp", "  sl  local_address rem_address st\n 0: 00000000:0050 00000000:0000 0A\n")
	var info Info
	readBoxFacts(&info, filepath.Join(dir, "dmi"), filepath.Join(dir, "proc"), filepath.Join(dir, "os-release"))
	if info.Manufacturer != "Jener, Inc." || info.Model != "Tiny box" || info.Kernel != "6.12.0-amd64" || info.OSVersion != "0.3.1" || info.BuildDate != "2026-10-07T12:00:00Z" || info.SSHStatus != "off" {
		t.Fatalf("unexpected facts: %+v", info)
	}
	write("proc/net/tcp6", "0: 00000000000000000000000000000000:0016 00000000000000000000000000000000:0000 0A\n")
	if sshStatus(filepath.Join(dir, "proc")) != "on" {
		t.Fatal("IPv6 SSH listener missed")
	}
	write("proc/net/tcp6", "0: 00000000000000000000000000000000:0016 00000000000000000000000000000000:0000 01\n")
	if sshStatus(filepath.Join(dir, "proc")) != "off" {
		t.Fatal("connection mistaken for listener")
	}
	write("os-release", "VERSION_ID=0.4.0\n")
	readBoxFacts(&info, dir, dir, filepath.Join(dir, "os-release"))
	if info.OSVersion != "0.4.0" || info.BuildDate != "" || info.Model != "" || info.SSHStatus != "unknown" {
		t.Fatalf("fallbacks: %+v", info)
	}
}
