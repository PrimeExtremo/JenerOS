package runtime

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testPaths(t *testing.T) Paths {
	t.Helper()
	dir := t.TempDir()
	p := Paths{Request: filepath.Join(dir, "request"), Public: filepath.Join(dir, "status.json"), Private: filepath.Join(dir, "private"), Ready: filepath.Join(dir, "ready"), SetupDone: filepath.Join(dir, "setup-done"), Catalog: filepath.Join("..", "..", "..", "[STORE]", "apps"), Storage: filepath.Join(dir, "storage"), Pools: filepath.Join(dir, "pools")}
	for _, path := range []string{p.Ready, p.SetupDone} {
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	b, _ := json.Marshal(Snapshot{Updated: time.Now(), Apps: []App{}})
	if err := os.WriteFile(p.Public, b, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestRequestValidation(t *testing.T) {
	for _, r := range []Request{
		{App: "photos", Action: "install"}, {App: "photos", Action: "install", Pool: "system"},
		{App: "photos", Action: "install", Pool: SystemPool},
		{App: "photos", Action: "install", Pool: strings.Repeat("a", 32)},
		{App: "photos", Action: "stop"}, {App: "photos", Action: "start"},
		{App: "photos", Action: "uninstall"}, {App: "photos", Action: "uninstall", DeleteData: true, Confirm: "photos"},
	} {
		if err := Validate(r); err != nil {
			t.Errorf("valid request: %+v: %v", r, err)
		}
	}
	for _, r := range []Request{
		{App: "../etc", Action: "install"}, {App: "photos", Action: "exec"},
		{App: "photos", Action: "install", Pool: "/etc"}, {App: "photos", Action: "start", Pool: "main"},
		{App: "photos", Action: "install", Pool: strings.Repeat("a", 33)},
		{App: "photos", Action: "uninstall", DeleteData: true},
		{App: "photos", Action: "uninstall", DeleteData: true, Confirm: "tv"},
		{App: "photos", Action: "install", DeleteData: true, Confirm: "photos"},
		{App: "photos", Action: "stop", ID: "anything"},
	} {
		if Validate(r) == nil {
			t.Errorf("invalid request accepted: %+v", r)
		}
	}
	for _, body := range []string{`{"app":"photos","action":"install","command":"sh"}`, `{} {}`, `{"app":3}`, strings.Repeat(" ", 65537) + `{}`} {
		var r Request
		if Decode(strings.NewReader(body), &r) == nil {
			t.Error("invalid JSON request accepted")
		}
	}
}

func TestQueueAtomicAndSnapshot(t *testing.T) {
	p := testPaths(t)
	rt := &Incus{Paths: p}
	job, err := rt.Queue(Request{App: "photos", Action: "install"})
	if err != nil || !jobID.MatchString(job.ID) {
		t.Fatalf("queue: %+v %v", job, err)
	}
	if _, err := rt.Queue(Request{App: "tv", Action: "install"}); !errors.Is(err, ErrBusy) {
		t.Fatalf("duplicate queue: %v", err)
	}
	s, err := rt.Read()
	if err != nil || s.Progress.ID != job.ID || s.Progress.Stage != "queued" {
		t.Fatalf("snapshot: %+v %v", s, err)
	}
	if _, err := rt.Queue(Request{App: "relay", Action: "install"}); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("coming soon: %v", err)
	}
}

func TestUnavailableAndStale(t *testing.T) {
	p := testPaths(t)
	rt := &Incus{Paths: p}
	b, _ := json.Marshal(Snapshot{Updated: time.Now().Add(-time.Minute), Apps: []App{{ID: "photos", State: Running}}})
	if err := os.WriteFile(p.Public, b, 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := rt.Read()
	if err != nil || s.Available || s.Apps[0].State != "unknown" {
		t.Fatal("stale readings presented as live")
	}
	if _, err := rt.Queue(Request{App: "photos", Action: "install"}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("stale worker accepted request: %v", err)
	}
}

func TestBusyProgressDoesNotRefreshOldReadings(t *testing.T) {
	p := testPaths(t)
	cpu := 25.0
	b, err := json.Marshal(Snapshot{
		Updated: time.Now(), Sampled: time.Now().Add(-time.Minute),
		Progress: Progress{Stage: "pulling"},
		Apps: []App{{ID: "tv", State: Running, CPU: &cpu, URL: "http://192.168.1.20:8096"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p.Public, b, 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := (&Incus{Paths: p}).Read()
	if err != nil || !s.Available || s.Progress.Stage != "pulling" || s.Apps[0].State != "unknown" || s.Apps[0].CPU != nil || s.Apps[0].URL != "" {
		t.Fatalf("old readings presented as current during install: %+v %v", s, err)
	}
}
