package api

import (
	"errors"
	"net/http"

	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
)

func (s *Server) apps(w http.ResponseWriter, r *http.Request) {
	snapshot, err := s.rt.Read()
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, snapshot)
}

func (s *Server) appStart(w http.ResponseWriter, r *http.Request) { s.appAction(w, r, "start") }
func (s *Server) appStop(w http.ResponseWriter, r *http.Request)  { s.appAction(w, r, "stop") }

func (s *Server) appAction(w http.ResponseWriter, r *http.Request, action string) {
	s.actionMu.Lock()
	defer s.actionMu.Unlock()
	id := r.PathValue("id")
	m, ok := s.cat.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, errors.New("Unknown app."))
		return
	}
	if !m.Available {
		writeError(w, http.StatusNotImplemented, runtime.ErrNotImplemented)
		return
	}
	var body struct {
		Pool       string `json:"pool,omitempty"`
		DeleteData bool   `json:"deleteData,omitempty"`
		Confirm    string `json:"confirm,omitempty"`
	}
	if r.ContentLength != 0 {
		if err := runtime.Decode(http.MaxBytesReader(w, r.Body, 4096), &body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
	}
	job, err := s.rt.Queue(runtime.Request{App: id, Action: action, Pool: body.Pool, DeleteData: body.DeleteData, Confirm: body.Confirm})
	if err != nil {
		writeError(w, statusFor(err), err)
		return
	}
	writeJSON(w, http.StatusAccepted, job)
}
