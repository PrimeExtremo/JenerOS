package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

func TestRollbackNeedsHeaderAndQueuesOnce(t *testing.T) {
	dir := t.TempDir()
	cat, err := catalog.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	p := update.Paths{StatusDir: dir, Request: filepath.Join(dir, "update.request"), Rollback: filepath.Join(dir, "rollback.request")}
	mux := http.NewServeMux()
	New(cat, runtime.NewIncus(), p).Register(mux)
	for _, tc := range []struct {
		header string
		want   int
	}{{"", 403}, {"0", 403}, {"1", 202}, {"1", 409}} {
		req := httptest.NewRequest("POST", "/api/update/rollback", nil)
		req.Header.Set("X-JenerOS", tc.header)
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Fatalf("got %d, want %d: %s", res.Code, tc.want, res.Body.String())
		}
		if tc.want == 403 {
			if _, err := os.Stat(p.Rollback); !os.IsNotExist(err) {
				t.Fatal("CSRF queued a rollback")
			}
		}
	}
}
