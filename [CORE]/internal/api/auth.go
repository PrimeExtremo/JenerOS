package api

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
)

func RegisterAuth(mux *http.ServeMux, m *auth.Manager) {
	mux.HandleFunc("POST /api/auth/login", sameSite(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		// Ignore forwarding headers: only the direct peer is trusted.
		now := m.Now()
		if !m.IP.Allow(ip, now) || !m.Global.Allow("owner", now) {
			w.Header().Set("Retry-After", "60")
			writeError(w, 429, errors.New("Too many tries. Wait a minute, then try again."))
			return
		}
		var c auth.Credentials
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		decoder.DisallowUnknownFields()
		err = decoder.Decode(&c)
		var extra any
		if err != nil || decoder.Decode(&extra) != io.EOF || !auth.Valid(c) {
			writeError(w, 400, auth.ErrCredentials)
			return
		}
		err = m.Verify(r.Context(), c)
		c.Password = ""
		if err != nil {
			if errors.Is(err, auth.ErrUnavailable) {
				writeError(w, 503, auth.ErrUnavailable)
			} else {
				writeError(w, 401, auth.ErrCredentials)
			}
			return
		}
		if err := m.Issue(w, r, c.Username); err != nil {
			writeError(w, 503, err)
			return
		}
		m.IP.Reset(ip)
		writeJSON(w, 200, map[string]string{"username": c.Username})
	}))
	mux.HandleFunc("GET /api/auth/session", func(w http.ResponseWriter, r *http.Request) {
		owner, ok := m.Owner(r)
		if !ok {
			writeError(w, 401, errors.New("Sign in to your owner account."))
			return
		}
		writeJSON(w, 200, map[string]string{"username": owner})
	})
	mux.HandleFunc("POST /api/auth/logout", sameSite(func(w http.ResponseWriter, r *http.Request) {
		m.Logout(w, r)
		w.WriteHeader(http.StatusNoContent)
	}))
}

func loopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// OwnerOnly protects the whole mux, including future APIs. First-boot setup has
// its separate one-time code + done-marker guard; login is the session bootstrap.
// Only GET /api/system is available to the unauthenticated loopback box screen.
func OwnerOnly(m *auth.Manager, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		_, signedIn := m.Owner(r)
		path := r.URL.Path
		bootstrap := path == "/api/auth/login" || path == "/api/auth/session" || path == "/api/setup" || path == "/api/setup/status"
		publicSystem := path == "/api/system" && r.Method == "GET" && loopback(r)
		if strings.HasPrefix(path, "/api/") && !bootstrap && !publicSystem && !signedIn {
			writeError(w, 401, errors.New("Sign in to your owner account."))
			return
		}
		if strings.HasPrefix(path, "/api/") && r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" && r.Header.Get("X-JenerOS") != "1" {
			writeError(w, 403, errors.New("missing X-JenerOS header"))
			return
		}
		if !signedIn && path == "/screen.html" && !loopback(r) {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next.ServeHTTP(w, r)
	})
}
