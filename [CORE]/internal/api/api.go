// Package api exposes jenerd over HTTP for the dashboard and client apps.
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"sync"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/system"
	"github.com/PrimeExtremo/JenerOS/core/internal/transport"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

type Server struct {
	Fingerprint func() string
	SetupCode   func() (string, error)
	cat         *catalog.Catalog
	rt          runtime.Runtime
	updates     update.Paths
	actionMu    sync.Mutex
}

func New(cat *catalog.Catalog, rt runtime.Runtime, updates update.Paths) *Server {
	return &Server{cat: cat, rt: rt, updates: updates}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system", s.system)
	mux.HandleFunc("GET /api/store", s.store)
	mux.HandleFunc("GET /api/store/{id}/screenshots/{n}", s.screenshot)
	mux.HandleFunc("POST /api/apps/{id}/install", sameSite(s.install))
	mux.HandleFunc("DELETE /api/apps/{id}", sameSite(s.remove))
	mux.HandleFunc("GET /api/apps", s.apps)
	mux.HandleFunc("POST /api/apps/{id}/start", sameSite(s.appStart))
	mux.HandleFunc("POST /api/apps/{id}/stop", sameSite(s.appStop))
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
	Status  runtime.Status `json:"status"`
	Runtime *runtime.App   `json:"runtime,omitempty"`
}

func (s *Server) system(w http.ResponseWriter, r *http.Request) {
	info := system.Read()
	if s.Fingerprint != nil {
		info.CertificateFingerprint = s.Fingerprint()
	}
	if s.SetupCode != nil && transport.Local(r) {
		var err error
		info.SetupCode, err = s.SetupCode()
		if err != nil {
			writeError(w, 500, errors.New("Could not read setup code."))
			return
		}
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) store(w http.ResponseWriter, r *http.Request) {
	snapshot, err := s.rt.Read()
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err)
		return
	}
	apps := s.cat.Apps()
	out := make([]storeApp, len(apps))
	for i, m := range apps {
		out[i] = storeApp{Manifest: m, Status: runtime.NotInstalled}
		for j := range snapshot.Apps {
			if snapshot.Apps[j].ID == m.ID {
				out[i].Status, out[i].Runtime = snapshot.Apps[j].State, &snapshot.Apps[j]
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// screenshot serves an image named in the manifest. Only listed files inside
// the app folder are reachable (catalog.Load validates the names).
func (s *Server) screenshot(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	path, ok := s.cat.Screenshot(r.PathValue("id"), n)
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, path)
}

func (s *Server) install(w http.ResponseWriter, r *http.Request) {
	s.appAction(w, r, "install")
}

func (s *Server) remove(w http.ResponseWriter, r *http.Request) {
	s.appAction(w, r, "uninstall")
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
	if errors.Is(err, runtime.ErrBusy) {
		return http.StatusConflict
	}
	if errors.Is(err, runtime.ErrUnavailable) {
		return http.StatusServiceUnavailable
	}
	if errors.Is(err, runtime.ErrInvalid) {
		return http.StatusBadRequest
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
