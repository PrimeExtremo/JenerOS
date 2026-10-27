package transport

import (
	"crypto/ecdsa"
	"crypto/tls"
	"crypto/x509"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestIdentity(t *testing.T) {
	dir := t.TempDir()
	i, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	ips := []net.IP{net.ParseIP("192.168.1.20"), net.ParseIP("fd12::20")}
	if err := i.refresh("my-box", ips, now); err != nil {
		t.Fatal(err)
	}
	first := i.Fingerprint()
	c := i.cert.Leaf
	if len(first) != 64 || c.Subject.CommonName != "my-box" || c.PublicKey.(*ecdsa.PublicKey).Curve.Params().Name != "P-256" {
		t.Fatal("incorrect certificate identity")
	}
	for _, host := range []string{"my-box", "my-box.local", "192.168.1.20", "fd12::20"} {
		if err := c.VerifyHostname(host); err != nil {
			t.Fatal(err)
		}
	}
	if err := c.CheckSignature(c.SignatureAlgorithm, c.RawTBSCertificate, c.Signature); err != nil {
		t.Fatal(err)
	}
	if err := i.refresh("my-box", ips, now); err != nil || i.Fingerprint() != first {
		t.Fatal("unchanged identity rotated")
	}
	// The persisted bundle must match the live certificate and keep its key private.
	data, err := os.ReadFile(filepath.Join(dir, "identity.pem"))
	if err != nil {
		t.Fatal(err)
	}
	saved, err := tls.X509KeyPair(data, data)
	if err != nil || string(saved.Certificate[0]) != string(i.cert.Certificate[0]) {
		t.Fatal("persisted certificate/key mismatch")
	}
	if runtime.GOOS != "windows" {
		for path, want := range map[string]os.FileMode{dir: 0o700, i.path: 0o600} {
			st, err := os.Stat(path)
			if err != nil || st.Mode().Perm() != want {
				t.Fatalf("unsafe permissions on %s", path)
			}
		}
	}
	if err := i.refresh("new-box", ips[:1], now); err != nil || i.Fingerprint() == first {
		t.Fatal("name/address change did not rotate")
	}
	first = i.Fingerprint()
	if err := i.refresh("new-box", ips[:1], now.Add(340*24*time.Hour)); err != nil || i.Fingerprint() == first {
		t.Fatal("expiring certificate did not rotate")
	}
	var wg sync.WaitGroup
	for n := 0; n < 8; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = i.Fingerprint()
			_, _ = i.Config().GetCertificate(nil)
			if err := i.refresh("new-box", ips, now); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
}

func TestTLSHandshake(t *testing.T) {
	i, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := i.refresh("localhost", []net.IP{net.ParseIP("127.0.0.1")}, time.Now()); err != nil {
		t.Fatal(err)
	}
	s := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	s.TLS = i.Config()
	s.StartTLS()
	defer s.Close()
	roots := x509.NewCertPool()
	roots.AddCert(i.cert.Leaf)
	for _, version := range []uint16{tls.VersionTLS10, tls.VersionTLS11, tls.VersionTLS12, tls.VersionTLS13} {
		conn, err := tls.Dial("tcp", s.Listener.Addr().String(), &tls.Config{RootCAs: roots, ServerName: "localhost", MinVersion: version, MaxVersion: version})
		if version < tls.VersionTLS12 {
			if err == nil {
				conn.Close()
				t.Fatal("legacy TLS accepted")
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		conn.Close()
	}
	for _, suite := range i.Config().CipherSuites {
		if suite != tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 && suite != tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 && suite != tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256 {
			t.Fatal("non-AEAD cipher enabled")
		}
	}
}

func TestTransportBoundary(t *testing.T) {
	h := Headers(HTTPS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }), "443"))
	for _, tc := range []struct {
		method, url, peer string
		status            int
		location          string
	}{
		{"GET", "http://box/setup.html?code=123456", "192.168.1.2:99", 308, "https://box/setup.html?code=123456"},
		{"GET", "http://[fd12::20]:80/", "[fd12::21]:99", 308, "https://[fd12::20]/"},
		{"POST", "http://box/api/auth/login", "192.168.1.2:99", 426, ""},
		{"GET", "https://box/", "192.168.1.2:99", 204, ""},
		{"GET", "http://127.0.0.1/api/system", "127.0.0.1:99", 204, ""},
		{"GET", "http://localhost/api/system", "[::1]:99", 204, ""},
		{"GET", "http://attacker.example/api/system", "127.0.0.1:99", 308, "https://attacker.example/api/system"},
		{"GET", "http://localhost/api/system", "192.168.1.2:99", 308, "https://localhost/api/system"},
	} {
		r := httptest.NewRequest(tc.method, tc.url, nil)
		r.RemoteAddr = tc.peer
		r.Header.Set("X-Forwarded-For", "127.0.0.1")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.status || w.Header().Get("Location") != tc.location {
			t.Fatalf("%s %s: %d %s", tc.method, tc.url, w.Code, w.Header().Get("Location"))
		}
		for _, name := range []string{"Content-Security-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy"} {
			if w.Header().Get(name) == "" {
				t.Fatal("missing security header: " + name)
			}
		}
		if w.Header().Get("Strict-Transport-Security") != "" || strings.Contains(CSP, "script-src 'self' 'unsafe-inline'") {
			t.Fatal("unexpected HSTS or unsafe scripts")
		}
	}
}
