package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
	"github.com/PrimeExtremo/JenerOS/core/internal/storage"
)

func TestStorageAPI(t *testing.T) {
	dir := t.TempDir()
	p := storage.Paths{Request: filepath.Join(dir, "storage.request"), Status: filepath.Join(dir, "status.json"), Helper: filepath.Join(dir, "helper"), SetupDone: filepath.Join(dir, "done"), Pools: filepath.Join(dir, "pools"), Records: filepath.Join(dir, "records")}
	for _, file := range []string{p.Helper, p.SetupDone} {
		if err := os.WriteFile(file, nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	disks := []storage.Disk{{Path: "/dev/sdb", Eligible: true, Size: storage.MinDiskBytes, Identity: "fixture"}}
	mux := http.NewServeMux()
	registerStorage(mux, p, func(context.Context, storage.Paths) ([]storage.Disk, error) { return disks, nil }, func(storage.Paths) (storage.Info, error) { return storage.Info{Disks: disks}, nil })
	sessions := auth.New()
	w := httptest.NewRecorder()
	if err := sessions.Issue(w, httptest.NewRequest("GET", "/", nil), "owner"); err != nil {
		t.Fatal(err)
	}
	cookie := w.Result().Cookies()[0]
	handler := OwnerOnly(sessions, mux)
	body := `{"name":"files","profile":"single","disks":["/dev/sdb"],"identities":{"/dev/sdb":"fixture"},"erase":true}`
	for _, tc := range []struct {
		method, path, body, header string
		owner                      bool
		code                       int
	}{
		{"GET", "/api/storage", "", "", false, 401},
		{"POST", "/api/storage/create", body, "1", false, 401},
		{"POST", "/api/storage/create", body, "", true, 403},
		{"POST", "/api/storage/create", `{}`, "1", true, 400},
		{"POST", "/api/storage/create", body + `{}`, "1", true, 400},
		{"POST", "/api/storage/create", strings.Replace(body, "single", "raid5", 1), "1", true, 400},
		{"GET", "/api/storage", "", "", true, 200},
		{"POST", "/api/storage/create", body, "1", true, 202},
		{"POST", "/api/storage/create", body, "1", true, 409},
	} {
		r := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		r.Header.Set("X-JenerOS", tc.header)
		if tc.owner {
			r.AddCookie(cookie)
		}
		out := httptest.NewRecorder()
		handler.ServeHTTP(out, r)
		if out.Code != tc.code {
			t.Fatalf("%s %s: got %d want %d: %s", tc.method, tc.path, out.Code, tc.code, out.Body.String())
		}
		if tc.code == 400 || tc.code == 401 || tc.code == 403 {
			if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
				t.Fatal("rejected request queued work")
			}
		}
	}
}
