// Package api exposes jenerd over HTTP for the dashboard and client apps.
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/system"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

type Server struct {
	cat      *catalog.Catalog
	rt       runtime.Runtime
	updates  update.Paths
	actionMu sync.Mutex
}

func New(cat *catalog.Catalog, rt runtime.Runtime, updates update.Paths) *Server {
	return &Server{cat: cat, rt: rt, updates: updates}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system", s.system)
	mux.HandleFunc("GET /api/store", s.store)
	mux.HandleFunc("POST /api/apps/{id}/install", sameSite(s.install))
	mux.HandleFunc("DELETE /api/apps/{id}", sameSite(s.remove))
	mux.HandleFunc("GET /api/update", s.updateInfo)
	mux.HandleFunc("POST /api/update", sameSite(s.updateStart))
	mux.HandleFunc("POST /api/update/check", sameSite(s.updateCheck))
	mux.HandleFunc("POST /api/update/rollback", sameSite(s.rollbackStart))
}

// sameSite rejects state-changing requests that lack the X-JenerOS header.
// Browsers won't attach a custom header cross-origin without a CORS preflight
// (which jenerd never answers), so other websites can't trigger these.
// OwnerOnly also requires the owner session across the production mux.
func sameSite(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-JenerOS") != "1" {
			writeError(w, http.StatusForbidden, errors.New("missing X-JenerOS header"))
			return
		}
		h(w, r)
	}
}

type storeApp struct {
	catalog.Manifest
	Status runtime.Status `json:"status"`
}

func (s *Server) system(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, system.Read())
}

func (s *Server) store(w http.ResponseWriter, r *http.Request) {
	apps := s.cat.Apps()
	out := make([]storeApp, len(apps))
	for i, m := range apps {
		out[i] = storeApp{m, s.rt.Status(m.ID)}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) install(w http.ResponseWriter, r *http.Request) {
	m, ok := s.cat.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, errors.New("unknown app"))
		return
	}
	if err := s.rt.Install(m); err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) remove(w http.ResponseWriter, r *http.Request) {
	if err := s.rt.Remove(r.PathValue("id")); err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) updateInfo(w http.ResponseWriter, r *http.Request) {
	info, err := update.Read(s.updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) updateStart(w http.ResponseWriter, r *http.Request) {
	s.actionMu.Lock()
	defer s.actionMu.Unlock()
	if err := update.Request(s.updates); err != nil {
		code := http.StatusInternalServerError
		if errors.Is(err, update.ErrBusy) {
			code = http.StatusConflict
		}
		writeError(w, code, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) rollbackStart(w http.ResponseWriter, r *http.Request) {
	s.actionMu.Lock()
	defer s.actionMu.Unlock()
	if err := update.RequestRollback(s.updates); err != nil {
		code := http.StatusInternalServerError
		if errors.Is(err, update.ErrBusy) {
			code = http.StatusConflict
		}
		writeError(w, code, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) updateCheck(w http.ResponseWriter, r *http.Request) {
	if err := update.RequestCheck(s.updates); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func statusFor(err error) int {
	if errors.Is(err, runtime.ErrNotImplemented) {
		return http.StatusNotImplemented
	}
	return http.StatusInternalServerError
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}
