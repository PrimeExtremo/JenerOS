package catalog

import (
	"os"
	"path/filepath"
	"testing"
)

// The store lives in "[STORE]/apps"; brackets must not be treated as a glob.
func TestLoadFromBracketFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "[STORE]", "apps")
	write := func(id, body string) {
		t.Helper()
		if err := os.MkdirAll(filepath.Join(dir, id), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, id, "app.json"), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("tv", `{"id":"tv","name":"TV","services":[{"name":"server","image":"x"}]}`)
	write("photos", `{"id":"photos","name":"Photos","services":[{"name":"server","image":"y"}]}`)
	os.MkdirAll(filepath.Join(dir, "empty-folder"), 0o755)

	c, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(c.Apps()); got != 2 {
		t.Fatalf("loaded %d apps, want 2", got)
	}
	if _, ok := c.Get("tv"); !ok {
		t.Error("tv missing")
	}
}

func TestLoadRejectsManifestWithoutServices(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "bad"), 0o755)
	os.WriteFile(filepath.Join(dir, "bad", "app.json"), []byte(`{"id":"bad"}`), 0o644)
	if _, err := Load(dir); err == nil {
		t.Fatal("expected an error for a manifest without services")
	}
}
