package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sync"

	"github.com/PrimeExtremo/JenerOS/core/internal/access"
	"github.com/PrimeExtremo/JenerOS/core/internal/system"
)

func RegisterSSH(mux *http.ServeMux, paths access.Paths) {
	var mu sync.Mutex
	mux.HandleFunc("GET /api/settings/ssh", func(w http.ResponseWriter, r *http.Request) {
		info, err := access.Read(paths)
		if err != nil {
			writeError(w, http.StatusInternalServerError, errors.New("Could not read developer access status."))
			return
		}
		writeJSON(w, http.StatusOK, struct {
			access.Info
			SSHStatus string `json:"sshStatus"`
		}{info, system.SSHStatus()})
	})
	mux.HandleFunc("POST /api/settings/ssh", sameSite(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Enabled *bool `json:"enabled"`
		}
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256))
		d.DisallowUnknownFields()
		if err := d.Decode(&req); err != nil || req.Enabled == nil {
			writeError(w, http.StatusBadRequest, errors.New("Choose whether SSH should be on or off."))
			return
		}
		if err := d.Decode(new(any)); err != io.EOF {
			writeError(w, http.StatusBadRequest, errors.New("Send one developer access choice."))
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if err := access.Request(paths, *req.Enabled); err != nil {
			code := http.StatusInternalServerError
			if errors.Is(err, access.ErrBusy) || errors.Is(err, access.ErrDevMode) {
				code = http.StatusConflict
			} else if errors.Is(err, access.ErrUnavailable) {
				code = http.StatusServiceUnavailable
			}
			writeError(w, code, err)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}))
}
