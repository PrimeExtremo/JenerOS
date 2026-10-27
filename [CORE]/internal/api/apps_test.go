package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

func appHandler(t *testing.T) (http.Handler, *http.Cookie, runtime.Paths) {
	t.Helper()
	dir := t.TempDir()
	p := runtime.Paths{Request: filepath.Join(dir, "request"), Public: filepath.Join(dir, "status.json"), SetupDone: filepath.Join(dir, "setup"), Ready: filepath.Join(dir, "ready"), Catalog: filepath.Join("..", "..", "..", "[STORE]", "apps")}
	for _, path := range []string{p.Ready, p.SetupDone} {
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	b, _ := json.Marshal(runtime.Snapshot{Updated: time.Now(), Apps: []runtime.App{}})
	if err := os.WriteFile(p.Public, b, 0o644); err != nil {
		t.Fatal(err)
	}
	cat, err := catalog.Load(p.Catalog)
	if err != nil {
		t.Fatal(err)
	}
	sessions := auth.New()
	sessions.Verify = func(context.Context, auth.Credentials) error { return nil }
	mux := http.NewServeMux()
	RegisterAuth(mux, sessions)
	New(cat, &runtime.Incus{Paths: p}, update.Paths{}).Register(mux)
	h := OwnerOnly(sessions, mux)
	w := authRequest(h, "POST", "/api/auth/login", `{"username":"jener","password":"owner password"}`, "192.168.1.20:1234", nil, true)
	if w.Code != 200 || len(w.Result().Cookies()) != 1 {
		t.Fatalf("test login: %d %s", w.Code, w.Body)
	}
	return h, w.Result().Cookies()[0], p
}

func TestAppActionsRequireOwnerAndCSRF(t *testing.T) {
	for _, action := range []struct{ method, path string }{{"POST", "/api/apps/photos/install"}, {"POST", "/api/apps/photos/start"}, {"POST", "/api/apps/photos/stop"}, {"DELETE", "/api/apps/photos"}} {
		h, cookie, p := appHandler(t)
		for _, peer := range []string{"127.0.0.1:1234", "192.168.1.20:1234"} {
			if w := authRequest(h, action.method, action.path, `{}`, peer, nil, true); w.Code != 401 {
				t.Fatalf("anonymous app action: %d", w.Code)
			}
		}
		if w := authRequest(h, action.method, action.path, `{}`, "192.168.1.20:1234", cookie, false); w.Code != 403 {
			t.Fatal("missing CSRF accepted")
		}
		if _, err := os.Stat(p.Request); err == nil {
			t.Fatal("unauthorized request written")
		}
		w := authRequest(h, action.method, action.path, `{}`, "192.168.1.20:1234", cookie, true)
		if w.Code != 202 {
			t.Fatalf("authorized action: %d %s", w.Code, w.Body)
		}
	}
}

func TestAppBadRequestsAndProgress(t *testing.T) {
	h, cookie, _ := appHandler(t)
	peer := "192.168.1.20:1234"
	for _, body := range []string{`{"deleteData":true}`, `{"deleteData":true,"confirm":"tv"}`, `{"command":"sh"}`, `{} {}`} {
		if w := authRequest(h, "DELETE", "/api/apps/photos", body, peer, cookie, true); w.Code != 400 {
			t.Fatalf("invalid body accepted: %s: %d", body, w.Code)
		}
	}
	if w := authRequest(h, "POST", "/api/apps/relay/install", `{}`, peer, cookie, true); w.Code != 501 {
		t.Fatal("coming-soon app accepted")
	}
	if w := authRequest(h, "POST", "/api/apps/missing/install", `{}`, peer, cookie, true); w.Code != 404 {
		t.Fatal("unknown app accepted")
	}
	if w := authRequest(h, "GET", "/api/apps", "", peer, nil, false); w.Code != 401 {
		t.Fatal("anonymous app inventory exposed")
	}
	w := authRequest(h, "POST", "/api/apps/photos/install", `{"pool":"@system"}`, peer, cookie, true)
	if w.Code != 202 {
		t.Fatalf("install: %d %s", w.Code, w.Body)
	}
	w = authRequest(h, "GET", "/api/apps", "", peer, cookie, false)
	var s runtime.Snapshot
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil || s.Progress.Stage != "queued" || s.Progress.App != "photos" {
		t.Fatalf("progress: %s %v", w.Body, err)
	}
	if w := authRequest(h, "POST", "/api/apps/tv/install", `{}`, peer, cookie, true); w.Code != 409 {
		t.Fatal("concurrent app work accepted")
	}
}
