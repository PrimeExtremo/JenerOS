package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PrimeExtremo/JenerOS/core/internal/access"
)

func TestSSHRequest(t *testing.T) {
	dir := t.TempDir()
	p := access.Paths{Request: filepath.Join(dir, "ssh.request"), Status: filepath.Join(dir, "status.json"), SetupDone: filepath.Join(dir, "setup-done"), Helper: filepath.Join(dir, "helper"), DevKey: filepath.Join(dir, "dev-key")}
	for _, file := range []string{p.SetupDone, p.Helper} {
		if err := os.WriteFile(file, nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	RegisterSSH(mux, p)
	for _, tc := range []struct {
		body   string
		header string
		want   int
	}{
		{`{"enabled":true}`, "", 403},
		{`{}`, "1", 400},
		{`{"enabled":null}`, "1", 400},
		{`{"enabled":"yes"}`, "1", 400},
		{`{"enabled":true,"command":"reboot"}`, "1", 400},
		{`{"enabled":true} {}`, "1", 400},
		{strings.Repeat(" ", 300) + `{"enabled":true}`, "1", 400},
		{`{"enabled":true}`, "1", 202},
		{`{"enabled":false}`, "1", 409},
	} {
		req := httptest.NewRequest("POST", "/api/settings/ssh", strings.NewReader(tc.body))
		req.Header.Set("X-JenerOS", tc.header)
		res := httptest.NewRecorder()
		mux.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Fatalf("%s: got %d, want %d: %s", tc.body, res.Code, tc.want, res.Body.String())
		}
		if tc.want == 400 || tc.want == 403 {
			if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
				t.Fatal("invalid request queued an SSH action")
			}
		}
	}
	b, err := os.ReadFile(p.Request)
	if err != nil || string(b) != "enable\n" {
		t.Fatalf("unexpected request: %q, %v", b, err)
	}
	st, err := os.Stat(p.Request)
	if err != nil || st.Mode().Perm() != 0o600 {
		t.Fatal("SSH request must be private")
	}
	if err := os.Remove(p.Request); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p.DevKey, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := access.Request(p, false); err != access.ErrDevMode {
		t.Fatalf("development SSH was not protected: %v", err)
	}
	if err := os.Remove(p.SetupDone); err != nil {
		t.Fatal(err)
	}
	if err := access.Request(p, true); err != access.ErrUnavailable {
		t.Fatalf("pre-setup request was allowed: %v", err)
	}
}
