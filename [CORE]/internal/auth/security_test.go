package auth

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestBackoffAndBoundedPeers(t *testing.T) {
	l := Limiter{Max: 5, Window: time.Minute}
	now := time.Now()
	for round := 0; round < 6; round++ {
		for n := 0; n < 5; n++ {
			if !l.Allow("peer", now) {
				t.Fatal("early limit")
			}
		}
		level := round
		if level > 4 {
			level = 4
		}
		wait := time.Minute * time.Duration(1<<level)
		if l.RetryAfter("peer", now) != wait || l.Allow("peer", now.Add(wait-time.Nanosecond)) {
			t.Fatal("backoff bypassed")
		}
		now = now.Add(wait)
	}
	now = now.Add(31 * time.Minute)
	if !l.Allow("peer", now) {
		t.Fatal("idle backoff did not reset")
	}
	for n := 0; n < 1100; n++ {
		l.Allow(fmt.Sprint(n), now)
	}
	if len(l.entries) != 1024 || l.Allow("another", now) {
		t.Fatal("peer map grew beyond its bound")
	}
	l.Reset("peer")
	if !l.Allow("peer", now) {
		t.Fatal("reset did not release entry")
	}
}

func TestConcurrentLimit(t *testing.T) {
	l := Limiter{Max: 5, Window: time.Minute}
	var accepted atomic.Int32
	var wg sync.WaitGroup
	now := time.Now()
	for n := 0; n < 100; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if l.Allow("peer", now) {
				accepted.Add(1)
			}
		}()
	}
	wg.Wait()
	if accepted.Load() != 5 {
		t.Fatal("concurrent guesses bypassed limit")
	}
}

func TestSecureCookieIsolation(t *testing.T) {
	m := New()
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "https://box/", nil)
	if err := m.Issue(w, r, "owner"); err != nil {
		t.Fatal(err)
	}
	c := w.Result().Cookies()[0]
	clear := httptest.NewRequest("GET", "http://box/", nil)
	clear.AddCookie(c)
	if _, ok := m.Owner(clear); ok {
		t.Fatal("TLS cookie accepted over cleartext")
	}
	r.AddCookie(&http.Cookie{Name: CookieName, Value: c.Value})
	if _, ok := m.Owner(r); ok {
		t.Fatal("unprefixed cookie accepted over TLS")
	}
	r.AddCookie(c)
	w = httptest.NewRecorder()
	if err := m.Issue(w, r, "owner"); err != nil {
		t.Fatal(err)
	}
	if _, ok := m.Owner(r); ok || w.Result().Cookies()[0].Value == c.Value {
		t.Fatal("TLS login did not rotate the session")
	}
}
