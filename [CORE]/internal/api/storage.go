package api

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/storage"
)

// RegisterStorage is protected by OwnerOnly at the production mux boundary.
func RegisterStorage(mux *http.ServeMux, paths storage.Paths) {
	registerStorage(mux, paths, storage.Discover, storage.Inventory)
}

func registerStorage(mux *http.ServeMux, paths storage.Paths, discover func(context.Context, storage.Paths) ([]storage.Disk, error), inventory func(storage.Paths) (storage.Info, error)) {
	var mu sync.Mutex
	mux.HandleFunc("GET /api/storage", func(w http.ResponseWriter, r *http.Request) {
		info, err := inventory(paths)
		if err != nil {
			writeError(w, 503, errors.New("Could not check your disks. Refresh to try again."))
			return
		}
		writeJSON(w, 200, info)
	})
	mux.HandleFunc("POST /api/storage/create", sameSite(func(w http.ResponseWriter, r *http.Request) {
		var req storage.Request
		if err := storage.Decode(http.MaxBytesReader(w, r.Body, 16384), &req); err != nil {
			writeError(w, 400, err)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		disks, err := discover(ctx, paths)
		if err != nil {
			writeError(w, 503, errors.New("Could not check your disks. Refresh to try again."))
			return
		}
		if err := storage.Validate(req, disks); err != nil {
			writeError(w, 400, err)
			return
		}
		job, err := storage.Queue(paths, req, disks)
		if err != nil {
			code := 409
			if errors.Is(err, storage.ErrUnavailable) {
				code = 503
			}
			writeError(w, code, err)
			return
		}
		writeJSON(w, 202, storage.Status{ID: job.ID, Name: job.Name, State: "queued", Message: "Waiting to begin…"})
	}))
}
