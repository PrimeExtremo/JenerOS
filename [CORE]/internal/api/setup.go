package api

import (
	"errors"
	"net/http"

	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

func RegisterSetup(mux *http.ServeMux, m *setup.Manager) {
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
