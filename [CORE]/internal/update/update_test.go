package update

import (
	"os"
	"path/filepath"
	"testing"
)

func testPaths(t *testing.T) Paths {
	t.Helper()
	dir := t.TempDir()
	p := Paths{
		OSRelease: filepath.Join(dir, "os-release"),
		StatusDir: filepath.Join(dir, "status"),
		Request:   filepath.Join(dir, "update.request"),
	}
	if err := os.WriteFile(p.OSRelease, []byte("NAME=\"JenerOS\"\nIMAGE_VERSION=0.1.1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(p.StatusDir, 0o755); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestReadFreshSystem(t *testing.T) {
	p := testPaths(t)
	info, err := Read(p)
	if err != nil {
		t.Fatal(err)
	}
	if info.Current != "0.1.1" || info.Available != nil || info.Status != nil || info.Requested {
		t.Fatalf("unexpected info: %+v", info)
	}
}

func TestRequestAndStatus(t *testing.T) {
	p := testPaths(t)
	if err := Request(p); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(p.StatusDir, "status.json"), []byte(`{"state":"installing","version":"0.1.2"}`), 0o644)
	os.WriteFile(filepath.Join(p.StatusDir, "available.json"), []byte(`not json`), 0o644)

	info, err := Read(p)
	if err != nil {
		t.Fatal(err)
	}
	if !info.Requested {
		t.Error("request file not seen")
	}
	if string(info.Status) != `{"state":"installing","version":"0.1.2"}` {
		t.Errorf("status = %s", info.Status)
	}
	if info.Available != nil {
		t.Errorf("invalid JSON should be ignored, got %s", info.Available)
	}
}
