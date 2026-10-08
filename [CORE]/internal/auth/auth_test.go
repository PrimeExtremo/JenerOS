package auth

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

func TestSessions(t *testing.T) {
	m := New()
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	m.Now = func() time.Time { return now }
	r := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	if err := m.Issue(w, r, "owner"); err != nil {
		t.Fatal(err)
	}
	cookie := w.Result().Cookies()[0]
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Secure || len(cookie.Value) != 64 || cookie.MaxAge != int(Lifetime.Seconds()) {
		t.Fatalf("unsafe HTTP session cookie: %+v", cookie)
	}
	r.AddCookie(cookie)
	for _, token := range []string{"", "owner", strings.Repeat("0", 64), strings.Repeat("f", 65)} {
		forged := httptest.NewRequest("GET", "/", nil)
		forged.AddCookie(&http.Cookie{Name: CookieName, Value: token})
		if _, ok := m.Owner(forged); ok {
			t.Fatal("forged cookie accepted")
		}
	}
	if owner, ok := m.Owner(r); !ok || owner != "owner" {
		t.Fatal("issued session not recognized")
	}
	// Reauthentication rotates the token and revokes the old cookie.
	w2 := httptest.NewRecorder()
	if err := m.Issue(w2, r, "owner"); err != nil {
		t.Fatal(err)
	}
	if _, ok := m.Owner(r); ok {
		t.Fatal("old token survived rotation")
	}
	r2 := httptest.NewRequest("GET", "/", nil)
	r2.AddCookie(w2.Result().Cookies()[0])
	now = now.Add(Lifetime)
	if _, ok := m.Owner(r2); ok {
		t.Fatal("expired token accepted")
	}
	secure := httptest.NewRequest("GET", "https://box/", nil)
	w3 := httptest.NewRecorder()
	if err := m.Issue(w3, secure, "owner"); err != nil {
		t.Fatal(err)
	}
	if !w3.Result().Cookies()[0].Secure {
		t.Fatal("HTTPS cookie lacks Secure")
	}
	secure.AddCookie(w3.Result().Cookies()[0])
	w4 := httptest.NewRecorder()
	m.Logout(w4, secure)
	if _, ok := m.Owner(secure); ok || w4.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("logout did not revoke cookie")
	}
	if _, ok := New().Owner(secure); ok {
		t.Fatal("session survived daemon restart")
	}
}

func TestLimiter(t *testing.T) {
	l := Limiter{Max: 5, Window: time.Minute}
	now := time.Now()
	for i := 0; i < 5; i++ {
		if !l.Allow("peer", now) {
			t.Fatal("early limit")
		}
	}
	if l.Allow("peer", now) || !l.Allow("other", now) || !l.Allow("peer", now.Add(time.Minute)) {
		t.Fatal("limit/isolation/expiry failed")
	}
	l.Reset("peer")
	if !l.Allow("peer", now.Add(time.Minute)) {
		t.Fatal("successful login did not reset")
	}
}

func TestOwnerVerification(t *testing.T) {
	dir := t.TempDir()
	p := setup.Paths{Done: filepath.Join(dir, "done"), Owner: filepath.Join(dir, "owner")}
	c := Credentials{Username: "jener", Password: "owner password"}
	calls := 0
	check := func(_ context.Context, username, password string) error {
		calls++
		if username != c.Username || password != c.Password {
			t.Fatal("verifier got different credentials")
		}
		return nil
	}
	if err := verifyOwner(context.Background(), c, p, check); !errors.Is(err, ErrUnavailable) || calls != 0 {
		t.Fatal("checked before setup")
	}
	for file, body := range map[string]string{p.Done: "", p.Owner: "jener\n"} {
		if err := os.WriteFile(file, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	for _, bad := range []Credentials{{"root", c.Password}, {"someone", c.Password}, {"-owner", c.Password}, {"jener", "password\x00extra"}, {"jener", strings.Repeat("x", 257)}, {"jener", "\xff"}} {
		if err := verifyOwner(context.Background(), bad, p, check); !errors.Is(err, ErrCredentials) || calls != 0 {
			t.Fatalf("unsafe/non-owner credentials reached checker: %q", bad.Username)
		}
	}
	if err := verifyOwner(context.Background(), c, p, check); err != nil || calls != 1 {
		t.Fatal("owner refused")
	}
	if err := verifyOwner(context.Background(), c, p, func(context.Context, string, string) error { return ErrCredentials }); !errors.Is(err, ErrCredentials) {
		t.Fatal("wrong/locked/expired account accepted")
	}
}

func TestHelperProtocol(t *testing.T) {
	// net.Pipe tests the bounded protocol without a root process or real password.
	client, server := net.Pipe()
	done := make(chan struct{})
	go func() {
		handleHelper(server, setup.Paths{}, func(context.Context, string, string) error {
			t.Error("invalid request reached system checker")
			return nil
		}, &Limiter{Max: 30, Window: time.Minute})
		close(done)
	}()
	if _, err := client.Write([]byte("{\"username\":\"root\",\"password\":\"secret\",\"command\":\"reboot\"}\n")); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 128)
	n, err := client.Read(buf)
	client.Close()
	<-done
	if err != nil || strings.Contains(string(buf[:n]), "secret") || !strings.Contains(string(buf[:n]), `"ok":false`) {
		t.Fatalf("unsafe helper response: %q, %v", buf[:n], err)
	}
}
