package api

import (
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

func RegisterSetup(mux *http.ServeMux, m *setup.Manager) {
	registerSetup(mux, m, time.Now)
}

func registerSetup(mux *http.ServeMux, m *setup.Manager, now func() time.Time) {
	// The six-digit code is the only secret before an owner exists: cap guesses
	// per address and overall so the code cannot be brute-forced from the LAN.
	perIP := &auth.Limiter{Max: 5, Window: time.Minute}
	global := &auth.Limiter{Max: 20, Window: time.Minute}
	guard := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			done, err := m.Done()
			if err != nil {
				writeError(w, 500, errors.New("Could not read setup state."))
				return
			}
			if done {
				writeError(w, 403, setup.ErrDone)
				return
			}
			h(w, r)
		}
	}
	mux.HandleFunc("GET /api/setup", guard(func(w http.ResponseWriter, r *http.Request) {
		info, err := m.Info()
		if err != nil {
			writeError(w, 500, errors.New("Could not read setup choices."))
			return
		}
		writeJSON(w, 200, info)
	}))
	mux.HandleFunc("GET /api/setup/status", guard(func(w http.ResponseWriter, r *http.Request) {
		status, err := m.Status()
		if err != nil {
			writeError(w, 500, errors.New("Could not read setup progress."))
			return
		}
		writeJSON(w, 200, status)
	}))
	mux.HandleFunc("POST /api/setup", guard(sameSite(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		t := now()
		if !perIP.Allow(ip, t) || !global.Allow("setup", t) {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, errors.New("Too many tries. Wait a minute, then try again."))
			return
		}
		req, err := setup.Decode(http.MaxBytesReader(w, r.Body, 8192))
		if err != nil {
			writeError(w, 400, err)
			return
		}
		if err := m.Submit(req); err != nil {
			code := http.StatusInternalServerError
			var invalid setup.ValidationError
			if errors.As(err, &invalid) {
				code = http.StatusBadRequest
			}
			if errors.Is(err, setup.ErrCode) || errors.Is(err, setup.ErrDone) {
				code = http.StatusForbidden
			}
			if errors.Is(err, setup.ErrBusy) {
				code = http.StatusConflict
			}
			if code == http.StatusInternalServerError {
				err = errors.New("Could not save setup. Please try again.")
			}
			writeError(w, code, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	})))
}
