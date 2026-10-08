package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/access"
	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

func authRequest(h http.Handler, method, path, body, peer string, cookie *http.Cookie, csrf bool) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.RemoteAddr = peer
	if cookie != nil {
		r.AddCookie(cookie)
	}
	if csrf {
		r.Header.Set("X-JenerOS", "1")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestLogin(t *testing.T) {
	m := auth.New()
	checks := 0
	m.Verify = func(_ context.Context, c auth.Credentials) error {
		checks++
		if c.Username == "jener" && c.Password == "owner password" {
			return nil
		}
		return auth.ErrCredentials
	}
	mux := http.NewServeMux()
	RegisterAuth(mux, m)
	h := OwnerOnly(m, mux)
	valid := `{"username":"jener","password":"owner password"}`
	peer := "192.168.1.20:1234"
	if w := authRequest(h, "POST", "/api/auth/login", valid, peer, nil, false); w.Code != 403 || checks != 0 {
		t.Fatal("login bypassed CSRF header")
	}
	for _, body := range []string{valid + ` {}`, `{"username":"jener","password":"secret","command":"reboot"}`, `{"username":"jener","password":"bad\u0000value"}`, strings.Repeat(" ", 2048) + valid} {
		w := authRequest(h, "POST", "/api/auth/login", body, peer, nil, true)
		if w.Code != 400 || len(w.Result().Cookies()) != 0 || checks != 0 {
			t.Fatal("invalid body issued cookie or reached verifier")
		}
	}
	w := authRequest(h, "POST", "/api/auth/login", valid, peer, nil, true)
	if w.Code != 200 || len(w.Result().Cookies()) != 1 || checks != 1 {
		t.Fatalf("login failed: %d %s", w.Code, w.Body.String())
	}
	cookie := w.Result().Cookies()[0]
	if w := authRequest(h, "GET", "/api/auth/session", "", peer, cookie, false); w.Code != 200 || !strings.Contains(w.Body.String(), "jener") || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("session lookup failed or cached")
	}
	if w := authRequest(h, "POST", "/api/auth/logout", "", peer, cookie, false); w.Code != 403 {
		t.Fatal("logout bypassed CSRF")
	}
	if w := authRequest(h, "POST", "/api/auth/logout", "", peer, cookie, true); w.Code != 204 {
		t.Fatal("logout failed")
	}
	if w := authRequest(h, "GET", "/api/auth/session", "", peer, cookie, false); w.Code != 401 {
		t.Fatal("revoked cookie accepted")
	}
	for i := 0; i < 5; i++ {
		w := authRequest(h, "POST", "/api/auth/login", `{"username":"jener","password":"wrong"}`, peer, nil, true)
		if w.Code != 401 || len(w.Result().Cookies()) != 0 {
			t.Fatal("wrong password accepted")
		}
	}
	w = authRequest(h, "POST", "/api/auth/login", valid, peer, nil, true)
	if w.Code != 429 || w.Header().Get("Retry-After") != "60" {
		t.Fatal("failed-login limit bypassed")
	}
	m.Now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	m.Verify = func(context.Context, auth.Credentials) error { return auth.ErrUnavailable }
	if w := authRequest(h, "POST", "/api/auth/login", valid, peer, nil, true); w.Code != 503 || len(w.Result().Cookies()) != 0 {
		t.Fatal("helper failure did not fail closed")
	}
}

func TestProductionBoundary(t *testing.T) {
	dir := t.TempDir()
	cat, err := catalog.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	p := update.Paths{OSRelease: filepath.Join(dir, "os-release"), StatusDir: dir,
		Request: filepath.Join(dir, "update.request"), Check: filepath.Join(dir, "check.request"), Rollback: filepath.Join(dir, "rollback.request")}
	ssh := access.Paths{Request: filepath.Join(dir, "ssh.request"), Status: filepath.Join(dir, "ssh.json"), SetupDone: filepath.Join(dir, "done"), Helper: filepath.Join(dir, "helper"), DevKey: filepath.Join(dir, "dev-key")}
	mux := http.NewServeMux()
	New(cat, runtime.NewIncus(), p).Register(mux)
	RegisterSSH(mux, ssh)
	m := auth.New()
	RegisterAuth(mux, m)
	reached := false
	mux.HandleFunc("POST /api/future/action", func(w http.ResponseWriter, r *http.Request) { reached = true; w.WriteHeader(204) })
	h := OwnerOnly(m, mux)
	for _, peer := range []string{"192.168.1.20:99", "127.0.0.1:99", "[::1]:99"} {
		for _, tc := range []struct{ method, path, body string }{
			{"POST", "/api/update", ""}, {"POST", "/api/update/check", ""}, {"POST", "/api/update/rollback", ""},
			{"POST", "/api/settings/ssh", `{"enabled":true}`}, {"POST", "/api/apps/photos/install", ""},
			{"DELETE", "/api/apps/photos", ""}, {"POST", "/api/future/action", ""}, {"GET", "/api/update", ""}, {"GET", "/api/settings/ssh", ""}, {"GET", "/api/store", ""},
		} {
			if w := authRequest(h, tc.method, tc.path, tc.body, peer, nil, true); w.Code != 401 {
				t.Fatalf("%s %s from %s: %d", tc.method, tc.path, peer, w.Code)
			}
		}
	}
	for _, file := range []string{p.Request, p.Check, p.Rollback, ssh.Request} {
		if _, err := os.Stat(file); !os.IsNotExist(err) {
			t.Fatal("unauthenticated request wrote action file")
		}
	}
	for _, tc := range []struct {
		peer string
		want int
	}{{"192.168.1.20:99", 401}, {"127.0.0.1:99", 200}, {"[::1]:99", 200}} {
		if w := authRequest(h, "GET", "/api/system", "", tc.peer, nil, false); w.Code != tc.want {
			t.Fatalf("system exposure from %s: %d", tc.peer, w.Code)
		}
	}
	spoof := httptest.NewRequest("GET", "/api/system", nil)
	spoof.RemoteAddr = "192.168.1.20:99"
	spoof.Header.Set("X-Forwarded-For", "127.0.0.1")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, spoof)
	if w.Code != 401 {
		t.Fatal("forwarded header bypassed loopback gate")
	}
	w = httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/", nil)
	if err := m.Issue(w, r, "jener"); err != nil {
		t.Fatal(err)
	}
	cookie := w.Result().Cookies()[0]
	for _, file := range []string{ssh.SetupDone, ssh.Helper} {
		if err := os.WriteFile(file, nil, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	for _, tc := range []struct{ path, body, file string }{
		{"/api/settings/ssh", `{"enabled":true}`, ssh.Request}, {"/api/update/rollback", "", p.Rollback}, {"/api/update/check", "", p.Check},
	} {
		if w := authRequest(h, "POST", tc.path, tc.body, "192.168.1.20:99", cookie, true); w.Code != 202 {
			t.Fatalf("authorized %s: %d %s", tc.path, w.Code, w.Body.String())
		}
		if err := os.Remove(tc.file); err != nil {
			t.Fatal(err)
		}
	}
	if w := authRequest(h, "POST", "/api/future/action", "", "192.168.1.20:99", cookie, false); w.Code != 403 || reached {
		t.Fatal("session bypassed CSRF")
	}
	if w := authRequest(h, "POST", "/api/future/action", "", "192.168.1.20:99", cookie, true); w.Code != 204 || !reached {
		t.Fatal("authorized action refused")
	}
	if w := authRequest(h, "POST", "/api/update", "", "192.168.1.20:99", cookie, true); w.Code != 202 {
		t.Fatalf("authorized update failed: %d %s", w.Code, w.Body.String())
	}
}

func TestGlobalLoginLimit(t *testing.T) {
	m := auth.New()
	checks := 0
	m.Verify = func(context.Context, auth.Credentials) error { checks++; return auth.ErrCredentials }
	mux := http.NewServeMux()
	RegisterAuth(mux, m)
	h := OwnerOnly(m, mux)
	for i := 0; i < 30; i++ {
		w := authRequest(h, "POST", "/api/auth/login", `{"username":"owner","password":"wrong"}`, fmt.Sprintf("192.168.1.%d:99", i+1), nil, true)
		if w.Code != 401 {
			t.Fatalf("unexpected early limit: %d", w.Code)
		}
	}
	if w := authRequest(h, "POST", "/api/auth/login", `{"username":"owner","password":"wrong"}`, "192.168.1.100:99", nil, true); w.Code != 429 || checks != 30 {
		t.Fatal("many peers bypassed global login limit")
	}
}
