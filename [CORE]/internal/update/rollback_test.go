package update

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOtherEntry(t *testing.T) {
	current := bootEntry{ID: "jeneros_0.3.0.efi", Type: "type2", Path: "/boot/EFI/Linux/jeneros_0.3.0.efi", Selected: true}
	previous := bootEntry{ID: "jeneros_0.2.1.efi", Type: "type2", Path: "/boot/EFI/Linux/jeneros_0.2.1+3-0.efi"}
	zero := uint(0)
	for _, tc := range []struct {
		name    string
		entries []bootEntry
		want    string
	}{
		{"two slots", []bootEntry{current, previous}, previous.ID},
		{"first boot", []bootEntry{current}, ""},
		{"no current", []bootEntry{previous}, ""},
		{"foreign", []bootEntry{current, {ID: "windows.efi", Type: "auto"}}, ""},
		{"exhausted", []bootEntry{current, {ID: previous.ID, Type: "type2", Path: previous.Path, TriesLeft: &zero}}, ""},
		{"ambiguous", []bootEntry{current, previous, {ID: "jeneros_0.1.0.efi", Type: "type2", Path: "/boot/EFI/Linux/jeneros_0.1.0.efi"}}, ""},
		{"multiple selected", []bootEntry{current, {ID: previous.ID, Type: "type2", Path: previous.Path, Selected: true}}, ""},
		{"unsafe id", []bootEntry{current, {ID: "jeneros_evil;reboot.efi", Type: "type2", Path: previous.Path}}, ""},
		{"wrong location", []bootEntry{current, {ID: previous.ID, Type: "type2", Path: "/tmp/jeneros_0.2.1.efi"}}, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.entries)
			if err != nil {
				t.Fatal(err)
			}
			got, err := OtherEntry(strings.NewReader(string(b)))
			if got != tc.want || (tc.want == "") != (err != nil) {
				t.Fatalf("got %q, %v; want %q", got, err, tc.want)
			}
		})
	}
	for _, invalid := range []string{"oops", "[] []", "null", "[{}]"} {
		if _, err := OtherEntry(strings.NewReader(invalid)); err == nil {
			t.Fatalf("accepted %q", invalid)
		}
	}
}

func TestRollbackRequestConflictsAndStatus(t *testing.T) {
	p := testPaths(t)
	p.Rollback = filepath.Join(filepath.Dir(p.Request), "rollback.request")
	if err := RequestRollback(p); err != nil {
		t.Fatal(err)
	}
	if err := RequestRollback(p); !errors.Is(err, ErrBusy) {
		t.Fatalf("duplicate: %v", err)
	}
	if err := Request(p); !errors.Is(err, ErrBusy) {
		t.Fatalf("update during rollback: %v", err)
	}
	info, err := Read(p)
	if err != nil || !info.RollbackRequested {
		t.Fatalf("request not reported: %+v %v", info, err)
	}
	if err := os.Remove(p.Rollback); err != nil {
		t.Fatal(err)
	}
	if err := Request(p); err != nil {
		t.Fatal(err)
	}
	if err := RequestRollback(p); !errors.Is(err, ErrBusy) {
		t.Fatalf("rollback during update: %v", err)
	}
	if err := os.Remove(p.Request); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(p.StatusDir, "status.json"), []byte(`{"state":"installing"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := RequestRollback(p); !errors.Is(err, ErrBusy) {
		t.Fatalf("rollback during root install: %v", err)
	}
	if err := os.WriteFile(filepath.Join(p.StatusDir, "status.json"), []byte(`{"state":"failed"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := RequestRollback(p); err != nil {
		t.Fatal(err)
	}
}
