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

func writeApp(t *testing.T, dir, id, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(dir, id), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, id, "app.json"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLoadStoreFields(t *testing.T) {
	dir := t.TempDir()
	writeApp(t, dir, "tv", `{"id":"tv","name":"TV","developer":"Jellyfin team","added":"2026-10-01",
		"category":"media","description":"About it.","whatsNew":"First version.",
		"screenshots":["shots/library.webp","player.png"],
		"requirements":{"memoryMB":2048,"diskGB":5},
		"services":[{"name":"server","image":"x"}]}`)
	c, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	m, _ := c.Get("tv")
	if m.Developer != "Jellyfin team" || m.WhatsNew != "First version." || m.Description != "About it." || m.Added != "2026-10-01" {
		t.Fatalf("store fields not loaded: %+v", m)
	}
	if p, ok := c.Screenshot("tv", 0); !ok || p != filepath.Join(dir, "tv", "shots", "library.webp") {
		t.Fatalf("screenshot 0 = %q, %v", p, ok)
	}
	for _, n := range []int{-1, 2} {
		if _, ok := c.Screenshot("tv", n); ok {
			t.Errorf("screenshot %d should not exist", n)
		}
	}
	if _, ok := c.Screenshot("nope", 0); ok {
		t.Error("unknown app should have no screenshots")
	}
}

func TestLoadRejectsBadStoreFields(t *testing.T) {
	cases := map[string]string{
		"escaping screenshot": `"screenshots":["../../etc/passwd.png"]`,
		"absolute screenshot": `"screenshots":["/srv/a.png"]`,
		"backslash":           `"screenshots":["..\\a.png"]`,
		"svg screenshot":      `"screenshots":["a.svg"]`,
		"unknown category":    `"category":"games"`,
		"bad date":            `"added":"October"`,
		"negative memory":     `"requirements":{"memoryMB":-1}`,
	}
	for name, field := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			writeApp(t, dir, "app", `{"id":"app",`+field+`,"services":[{"name":"s","image":"x"}]}`)
			if _, err := Load(dir); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
	for _, id := range []string{"Bad", "has space", "-dash", "x/y"} {
		dir := t.TempDir()
		writeApp(t, dir, "app", `{"id":"`+id+`","services":[{"name":"s","image":"x"}]}`)
		if _, err := Load(dir); err == nil {
			t.Errorf("id %q: expected an error", id)
		}
	}
}

func TestLoadRejectsDuplicateIDs(t *testing.T) {
	dir := t.TempDir()
	writeApp(t, dir, "one", `{"id":"same","services":[{"name":"s","image":"x"}]}`)
	writeApp(t, dir, "two", `{"id":"same","services":[{"name":"s","image":"x"}]}`)
	if _, err := Load(dir); err == nil {
		t.Fatal("expected an error for duplicate ids")
	}
}

// The real catalog must load, so a manifest typo fails tests, not the box.
func TestShippedCatalogLoads(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "..", "[STORE]", "apps"))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Apps()) == 0 {
		t.Fatal("shipped catalog is empty")
	}
	for _, m := range c.Apps() {
		if m.Category == "" || m.Developer == "" || m.Description == "" || m.Added == "" {
			t.Errorf("%s: store page needs category, developer, description and added", m.ID)
		}
	}
}
