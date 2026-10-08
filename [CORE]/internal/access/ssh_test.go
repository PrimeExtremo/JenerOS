package access

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSSHQueueAndWorkerStatus(t *testing.T) {
	dir := t.TempDir()
	p := Paths{Request: filepath.Join(dir, "ssh.request"), Status: filepath.Join(dir, "status.json"), SetupDone: filepath.Join(dir, "done"), Helper: filepath.Join(dir, "helper"), DevKey: filepath.Join(dir, "dev")}
	write := func(file, data string) {
		t.Helper()
		if err := os.WriteFile(file, []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	info, err := Read(p)
	if err != nil || info.Available || info.Requested {
		t.Fatalf("unexpected initial status: %+v, %v", info, err)
	}
	write(p.SetupDone, "")
	write(p.Helper, "")
	write(p.Status, `{"state":"applying","message":"Changing developer access."}`)
	if err := Request(p, false); err != ErrBusy {
		t.Fatalf("active worker was not blocked: %v", err)
	}
	write(p.Status, `{"state":"failed","message":"Try again."}`)
	if err := Request(p, false); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(p.Request)
	if err != nil || string(b) != "disable\n" {
		t.Fatalf("incorrect disable action: %q, %v", b, err)
	}
	info, err = Read(p)
	if err != nil || !info.Available || !info.Requested || info.Status.State != "failed" {
		t.Fatalf("queued retry lost its state: %+v, %v", info, err)
	}
	leftovers, err := filepath.Glob(filepath.Join(dir, ".ssh-request-*"))
	if err != nil || len(leftovers) != 0 {
		t.Fatalf("temporary request was not cleaned: %v, %v", leftovers, err)
	}
	write(p.Status, "broken")
	if _, err := Read(p); err == nil {
		t.Fatal("invalid worker JSON was ignored")
	}
}
