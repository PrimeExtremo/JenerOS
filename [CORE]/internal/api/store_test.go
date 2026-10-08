package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

func storeMux(t *testing.T) *http.ServeMux {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "tv", "shots"), 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := `{"id":"tv","name":"TV","developer":"Jellyfin team","whatsNew":"New.","category":"media",
		"screenshots":["shots/a.png"],"requirements":{"memoryMB":2048,"diskGB":5},
		"services":[{"name":"server","image":"x"}],"web":{"service":"server","port":8096}}`
	for name, body := range map[string]string{"tv/app.json": manifest, "tv/shots/a.png": "\x89PNG\r\n\x1a\nfake", "tv/secret.txt": "no"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	cat, err := catalog.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	New(cat, runtime.NewIncus(), update.Paths{}).Register(mux)
	return mux
}

func TestStoreListsStoreFields(t *testing.T) {
	rec := httptest.NewRecorder()
	storeMux(t).ServeHTTP(rec, httptest.NewRequest("GET", "/api/store", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
	var apps []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &apps); err != nil || len(apps) != 1 {
		t.Fatalf("body %s: %v", rec.Body, err)
	}
	a := apps[0]
	if a["developer"] != "Jellyfin team" || a["whatsNew"] != "New." || a["status"] != "not-installed" {
		t.Fatalf("missing store fields: %v", a)
	}
	if req, _ := a["requirements"].(map[string]any); req["memoryMB"] != float64(2048) {
		t.Fatalf("requirements: %v", a["requirements"])
	}
}

func TestStoreScreenshot(t *testing.T) {
	mux := storeMux(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/store/tv/screenshots/0", nil))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("got %d %q", rec.Code, rec.Header())
	}
	for _, path := range []string{"/api/store/tv/screenshots/1", "/api/store/tv/screenshots/-1", "/api/store/tv/screenshots/x", "/api/store/nope/screenshots/0", "/api/store/tv/screenshots/..%2fsecret.txt"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: got %d, want 404", path, rec.Code)
		}
	}
}

func TestInstallIsHonestlyNotImplemented(t *testing.T) {
	mux := storeMux(t)
	req := httptest.NewRequest("POST", "/api/apps/tv/install", nil)
	req.Header.Set("X-JenerOS", "1")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("got %d, want 501", rec.Code)
	}
}
