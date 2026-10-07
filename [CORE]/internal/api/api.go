// Package api exposes jenerd over HTTP for the dashboard and client apps.
package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/PrimeExtremo/jeneros/core/internal/catalog"
	"github.com/PrimeExtremo/jeneros/core/internal/runtime"
	"github.com/PrimeExtremo/jeneros/core/internal/system"
)

type Server struct {
	cat *catalog.Catalog
	rt  runtime.Runtime
}

func New(cat *catalog.Catalog, rt runtime.Runtime) *Server {
	return &Server{cat: cat, rt: rt}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system", s.system)
	mux.HandleFunc("GET /api/store", s.store)
	mux.HandleFunc("POST /api/apps/{id}/install", s.install)
	mux.HandleFunc("DELETE /api/apps/{id}", s.remove)
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
