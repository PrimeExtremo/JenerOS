package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

func setupFixture(t *testing.T) (*http.ServeMux, setup.Paths, setup.Request) {
	t.Helper()
	dir := t.TempDir()
	p := setup.Paths{
		Done: filepath.Join(dir, "setup-done"), Request: filepath.Join(dir, "setup.request"),
		Code: filepath.Join(dir, "setup-code"), Status: filepath.Join(dir, "status.json"),
		ZoneTable: filepath.Join(dir, "zone.tab"),
	}
	if err := os.WriteFile(p.ZoneTable, []byte("# comment\nUS\t+4042-07400\tAmerica/New_York\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	m, err := setup.New(p)
	if err != nil {
		t.Fatal(err)
	}
	code, err := os.ReadFile(p.Code)
	if err != nil {
		t.Fatal(err)
	}
	if len(strings.TrimSpace(string(code))) != 6 {
		t.Fatal("code must have six digits")
	}
	mux := http.NewServeMux()
	RegisterSetup(mux, m)
	req := setup.Request{
		AcceptedPrivacy: true, Language: "en",
		Code: strings.TrimSpace(string(code)), Hostname: "my-box", Keymap: "us", Timezone: "America/New_York",
		Username: "jener", Password: "eight-or-more", PasswordConfirm: "eight-or-more", Network: setup.Network{Mode: "automatic"},
	}
	return mux, p, req
}

func setupPost(t *testing.T, mux *http.ServeMux, input setup.Request, header bool) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/setup", bytes.NewReader(b))
	if header {
		req.Header.Set("X-JenerOS", "1")
	}
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	return res
}

func TestSetupRequiresCodeAndHeader(t *testing.T) {
	for _, tc := range []string{"missing code", "wrong code", "missing header"} {
		t.Run(tc, func(t *testing.T) {
			mux, p, req := setupFixture(t)
			switch tc {
			case "missing code":
				req.Code = ""
			case "wrong code":
				req.Code = "abcdef"
			}
			res := setupPost(t, mux, req, tc != "missing header")
			if res.Code != 403 {
				t.Fatalf("got %d, want 403", res.Code)
			}
			if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
				t.Fatal("unauthorized request queued")
			}
		})
	}
}

func TestSetupClosedAfterDone(t *testing.T) {
	mux, p, req := setupFixture(t)
	if err := os.WriteFile(p.Done, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/setup", "/api/setup/status"} {
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, httptest.NewRequest("GET", path, nil))
		if res.Code != 403 {
			t.Fatalf("%s: got %d, want 403", path, res.Code)
		}
	}
	if res := setupPost(t, mux, req, true); res.Code != 403 {
		t.Fatalf("POST got %d, want 403", res.Code)
	}
	if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
		t.Fatal("request queued after done")
	}
	if _, err := setup.New(p); err != nil {
		t.Fatal(err)
	}
}

func TestSetupValidation(t *testing.T) {
	cases := []struct {
		name   string
		change func(*setup.Request)
	}{
		{"missing privacy", func(r *setup.Request) { r.AcceptedPrivacy = false }},
		{"unsupported language", func(r *setup.Request) { r.Language = "zz" }},
		{"bad hostname", func(r *setup.Request) { r.Hostname = "bad name!" }},
		{"short password", func(r *setup.Request) { r.Password = "short"; r.PasswordConfirm = "short" }},
		{"mismatched passwords", func(r *setup.Request) { r.PasswordConfirm = "different-pass" }},
		{"bad username", func(r *setup.Request) { r.Username = "-root" }},
		{"root account", func(r *setup.Request) { r.Username = "root" }},
		{"reserved service", func(r *setup.Request) { r.Username = "jeneros-kiosk" }},
		{"underscore start", func(r *setup.Request) { r.Username = "_owner" }},
		{"password newline", func(r *setup.Request) { r.Password = "private\npassword"; r.PasswordConfirm = r.Password }},
		{"unknown timezone", func(r *setup.Request) { r.Timezone = "../etc/passwd" }},
		{"unknown keyboard", func(r *setup.Request) { r.Keymap = "-invalid" }},
		{"unknown connection", func(r *setup.Request) { r.Network = setup.Network{Mode: "fixed", Interface: "made-up"} }},
		{"extra automatic settings", func(r *setup.Request) { r.Network.Address = "192.168.1.20/24" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mux, p, req := setupFixture(t)
			tc.change(&req)
			res := setupPost(t, mux, req, true)
			if res.Code != 400 {
				t.Fatalf("got %d, want 400: %s", res.Code, res.Body.String())
			}
			if strings.Contains(res.Body.String(), req.Password) {
				t.Fatal("password leaked in response")
			}
			if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
				t.Fatal("invalid request queued")
			}
		})
	}
}

func TestSetupQueuesOnceAndReportsProgress(t *testing.T) {
	mux, p, req := setupFixture(t)
	req.PrivacyAcceptedAt = "forged-time"
	req.PrivacyPolicyVersion = "forged-version"
	before := time.Now().UTC()
	res := setupPost(t, mux, req, true)
	if res.Code != 202 {
		t.Fatalf("got %d, want 202: %s", res.Code, res.Body.String())
	}
	b, err := os.ReadFile(p.Request)
	if err != nil {
		t.Fatal(err)
	}
	var saved setup.Request
	if err := json.Unmarshal(b, &saved); err != nil {
		t.Fatal(err)
	}
	if saved.Password != req.Password || saved.Code != "" {
		t.Fatal("request did not preserve password privately or clear code")
	}
	accepted, err := time.Parse(time.RFC3339Nano, saved.PrivacyAcceptedAt)
	if err != nil || accepted.Before(before) || accepted.After(time.Now().UTC()) || saved.PrivacyPolicyVersion != setup.PrivacyPolicyVersion || !saved.AcceptedPrivacy {
		t.Fatal("server did not stamp consent with its own time and policy version")
	}
	st, err := os.Stat(p.Request)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && st.Mode().Perm() != 0o600 {
		t.Fatal("request mode must be 0600")
	}
	if res := setupPost(t, mux, req, true); res.Code != 409 {
		t.Fatalf("duplicate got %d, want 409", res.Code)
	}
	for _, path := range []string{"/api/setup", "/api/setup/status"} {
		res = httptest.NewRecorder()
		mux.ServeHTTP(res, httptest.NewRequest("GET", path, nil))
		if res.Code != 200 || res.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s: incorrect read response", path)
		}
	}
	if !strings.Contains(res.Body.String(), `"state":"applying"`) || strings.Contains(res.Body.String(), req.Password) {
		t.Fatal("incorrect or unsafe progress response")
	}
}
