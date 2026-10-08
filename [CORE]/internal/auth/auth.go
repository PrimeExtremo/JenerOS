// Package auth keeps owner sessions in the unprivileged daemon. Passwords are
// checked by a separate root service; neither hashes nor passwords are saved here.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const Socket = "/run/jeneros-auth.sock"
const CookieName = "jeneros_session"
const Lifetime = 8 * time.Hour

var ErrCredentials = errors.New("Check your username and password, then try again.")
var ErrUnavailable = errors.New("Sign-in is unavailable. Please try again in a moment.")

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Valid(c Credentials) bool {
	if len(c.Username) == 0 || len(c.Username) > 32 || c.Username[0] < 'a' || c.Username[0] > 'z' {
		return false
	}
	for _, ch := range c.Username {
		if !(ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' || ch == '_' || ch == '-') {
			return false
		}
	}
	return len(c.Password) > 0 && len(c.Password) <= 256 && utf8.ValidString(c.Password) && !strings.ContainsAny(c.Password, "\x00\r\n")
}

// Verify sends a bounded request over the private Unix socket, never argv or disk.
func Verify(ctx context.Context, c Credentials) error {
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", Socket)
	if err != nil {
		return ErrUnavailable
	}
	defer conn.Close()
	if err := conn.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return ErrUnavailable
	}
	if err := json.NewEncoder(conn).Encode(c); err != nil {
		return ErrUnavailable
	}
	var reply struct {
		OK          bool `json:"ok"`
		Unavailable bool `json:"unavailable"`
	}
	if err := json.NewDecoder(io.LimitReader(conn, 1024)).Decode(&reply); err != nil || reply.Unavailable {
		return ErrUnavailable
	}
	if !reply.OK {
		return ErrCredentials
	}
	return nil
}

// Limiter reserves attempts before verification so parallel requests cannot
// bypass the limit. Entries expire; random LAN addresses cannot grow it forever.
type Limiter struct {
	mu      sync.Mutex
	entries map[string]attempts
	Max     int
	Window  time.Duration
}

type attempts struct {
	n     int
	until time.Time
}

func (l *Limiter) Allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.entries == nil {
		l.entries = make(map[string]attempts)
	}
	for k, v := range l.entries {
		if !now.Before(v.until) {
			delete(l.entries, k)
		}
	}
	v := l.entries[key]
	if v.n >= l.Max || len(l.entries) >= 1024 && v.n == 0 {
		return false
	}
	if v.n == 0 {
		v.until = now.Add(l.Window)
	}
	v.n++
	l.entries[key] = v
	return true
}

func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

type session struct {
	username string
	expires  time.Time
}

type Manager struct {
	mu       sync.Mutex
	sessions map[[32]byte]session
	Verify   func(context.Context, Credentials) error
	Now      func() time.Time
	IP       Limiter
	Global   Limiter
}

func New() *Manager {
	return &Manager{sessions: make(map[[32]byte]session), Verify: Verify, Now: time.Now,
		IP: Limiter{Max: 5, Window: time.Minute}, Global: Limiter{Max: 30, Window: time.Minute}}
}

func (m *Manager) Issue(w http.ResponseWriter, r *http.Request, username string) error {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return err
	}
	token := hex.EncodeToString(raw[:])
	now := m.Now()
	m.mu.Lock()
	for key, s := range m.sessions {
		if !now.Before(s.expires) {
			delete(m.sessions, key)
		}
	}
	// A fresh login replaces this browser's previous session.
	if old, err := r.Cookie(CookieName); err == nil {
		delete(m.sessions, sha256.Sum256([]byte(old.Value)))
	}
	if len(m.sessions) >= 128 {
		m.mu.Unlock()
		return errors.New("Too many active sign-ins. Sign out on another device and try again.")
	}
	m.sessions[sha256.Sum256([]byte(token))] = session{username, now.Add(Lifetime)}
	m.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: CookieName, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: r.TLS != nil, MaxAge: int(Lifetime.Seconds())})
	return nil
}

func (m *Manager) Owner(r *http.Request) (string, bool) {
	c, err := r.Cookie(CookieName)
	if err != nil || len(c.Value) != 64 {
		return "", false
	}
	key := sha256.Sum256([]byte(c.Value))
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[key]
	if !ok || !m.Now().Before(s.expires) {
		delete(m.sessions, key)
		return "", false
	}
	return s.username, true
}

func (m *Manager) Logout(w http.ResponseWriter, r *http.Request) {
	m.mu.Lock()
	if c, err := r.Cookie(CookieName); err == nil {
		delete(m.sessions, sha256.Sum256([]byte(c.Value)))
	}
	m.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: CookieName, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: r.TLS != nil, MaxAge: -1})
}
