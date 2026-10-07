package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/PrimeExtremo/jeneros/core/internal/catalog"
	"github.com/PrimeExtremo/jeneros/core/internal/runtime"
	"github.com/PrimeExtremo/jeneros/core/internal/update"
)

func TestUpdateNeedsHeader(t *testing.T) {
	dir := t.TempDir()
	cat, _ := catalog.Load(dir)
	p := update.Paths{OSRelease: filepath.Join(dir, "os-release"), StatusDir: dir, Request: filepath.Join(dir, "update.request")}
	mux := http.NewServeMux()
	New(cat, runtime.NewIncus(), p).Register(mux)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("POST", "/api/update", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("without header: got %d, want 403", rec.Code)
	}
	if _, err := os.Stat(p.Request); err == nil {
		t.Fatal("request file created without header")
	}

	req := httptest.NewRequest("POST", "/api/update", nil)
	req.Header.Set("X-JenerOS", "1")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("with header: got %d, want 202", rec.Code)
	}
}
