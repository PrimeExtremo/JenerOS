package transport

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"

func Headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", CSP)
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// Only a loopback peer AND loopback Host can use cleartext. Cage cannot handle
// a self-signed certificate warning. LAN setup, login and APIs always use TLS.
// Matching both also prevents DNS rebinding from exposing local-only facts.
func Local(r *http.Request) bool {
	peer, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(peer)
	if ip == nil || !ip.IsLoopback() {
		return false
	}
	host := (&url.URL{Host: r.Host}).Hostname()
	ip = net.ParseIP(host)
	return host == "localhost" || ip != nil && ip.IsLoopback()
}

func HTTPS(next http.Handler, port string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS != nil || Local(r) {
			next.ServeHTTP(w, r)
			return
		}
		host := (&url.URL{Host: r.Host}).Hostname()
		if host == "" || strings.ContainsAny(host, " /\\\r\n@") {
			http.Error(w, "Invalid address", 400)
			return
		}
		target := *r.URL
		target.Scheme = "https"
		target.Host = net.JoinHostPort(host, port)
		if port == "443" {
			target.Host = host
			if strings.Contains(host, ":") {
				target.Host = "[" + host + "]"
			}
		}
		// A POST must not carry credentials onward after first using cleartext.
		if r.Method != "GET" && r.Method != "HEAD" {
			http.Error(w, "Open this box with HTTPS before sending information.", http.StatusUpgradeRequired)
			return
		}
		http.Redirect(w, r, target.String(), http.StatusPermanentRedirect)
	})
}
