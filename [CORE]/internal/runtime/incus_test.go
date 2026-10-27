package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type testTransport struct {
	base string
	rt   http.RoundTripper
}

func (t testTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r.URL.Scheme = "http"
	r.URL.Host = strings.TrimPrefix(t.base, "http://")
	return t.rt.RoundTrip(r)
}

func fakeClient(t *testing.T, h http.HandlerFunc) *client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &client{http: &http.Client{Transport: testTransport{base: srv.URL, rt: http.DefaultTransport}}}
}

func TestIncusWaitAndRedaction(t *testing.T) {
	for _, failed := range []bool{false, true} {
		calls := 0
		c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
			calls++
			if r.Method == "POST" {
				json.NewEncoder(w).Encode(map[string]any{"type": "async", "operation": "/1.0/operations/test?project=jener-photos"})
				return
			}
			if r.URL.Path != "/1.0/operations/test/wait" || r.URL.Query().Get("timeout") != "-1" || r.URL.Query().Get("project") != "jener-photos" {
				t.Error("wrong wait request")
			}
			code := 200
			if failed {
				code = 400
			}
			json.NewEncoder(w).Encode(map[string]any{"type": "sync", "metadata": map[string]any{"status_code": code, "err": "password=private-value", "metadata": map[string]string{"fingerprint": "abc"}}})
		})
		var out map[string]string
		err := c.call(context.Background(), "POST", "/1.0/images", map[string]string{"image": "x"}, &out)
		if calls != 2 || failed != (err != nil) || err != nil && strings.Contains(err.Error(), "private-value") {
			t.Fatalf("operation wait: %d %v", calls, err)
		}
		if !failed && out["fingerprint"] != "abc" {
			t.Fatal("lost operation result")
		}
	}
}

func TestIncusRejectsForeignOperation(t *testing.T) {
	c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"type": "async", "operation": "https://other/1.0/operations/a"})
	})
	if c.call(context.Background(), "POST", "/1.0/images", nil, nil) == nil {
		t.Fatal("followed foreign operation URL")
	}
}
