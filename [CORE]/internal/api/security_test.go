package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

func TestGlobalSetupLimitAndBackoff(t *testing.T) {
	_, p, _ := setupFixture(t)
	m, err := setup.New(p)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	mux := http.NewServeMux()
	registerSetup(mux, m, func() time.Time { return now })
	guess := func(n int) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/api/setup", strings.NewReader(`{"code":"invalid"}`))
		r.RemoteAddr = fmt.Sprintf("192.168.1.%d:99", n)
		r.Header.Set("X-JenerOS", "1")
		r.Header.Set("X-Forwarded-For", fmt.Sprintf("10.0.0.%d", n))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	for round := 0; round < 2; round++ {
		for n := 1; n <= 20; n++ {
			if w := guess(n); w.Code != 403 {
				t.Fatalf("early global limit at %d: %d", n, w.Code)
			}
		}
		w := guess(21)
		if w.Code != 429 || w.Header().Get("Retry-After") != fmt.Sprint(60*(round+1)) {
			t.Fatal("global setup limit/backoff bypassed")
		}
		now = now.Add(time.Minute)
	}
	if w := guess(22); w.Code != 429 {
		t.Fatal("second window expired too early")
	}
}

func TestSystemCodeStaysLocal(t *testing.T) {
	s := &Server{SetupCode: func() (string, error) { return "123456", nil }, Fingerprint: func() string { return "fingerprint" }}
	for _, tc := range []struct {
		host, peer string
		local      bool
	}{
		{"127.0.0.1", "127.0.0.1:99", true},
		{"localhost", "[::1]:99", true},
		{"box.local", "192.168.1.2:99", false},
		{"attacker.example", "127.0.0.1:99", false},
	} {
		r := httptest.NewRequest("GET", "http://"+tc.host+"/api/system", nil)
		r.RemoteAddr = tc.peer
		w := httptest.NewRecorder()
		s.system(w, r)
		if w.Code != 200 || strings.Contains(w.Body.String(), "123456") != tc.local || !strings.Contains(w.Body.String(), "fingerprint") {
			t.Fatal("system response exposed local code or omitted fingerprint")
		}
	}
}
