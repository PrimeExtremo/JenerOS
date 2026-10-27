package runtime

import (
	"context"
	"errors"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/system"
)

// Refresh runs on a root timer. It skips a busy worker; the install itself owns
// the progress file then. A reboot interrupts old jobs but preserves records.
func Refresh(p Paths, restore bool) error {
	if os.Geteuid() != 0 {
		return errors.New("App status worker requires root.")
	}
	lock, err := lockWorker(p, false)
	if errors.Is(err, ErrBusy) {
		return nil
	}
	if err != nil {
		return err
	}
	defer lock.Close()
	w := worker{p: p, c: newClient(p.Socket)}
	w.snap, err = (&Incus{Paths: p}).Read()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	if restore {
		entries, err := os.ReadDir(p.Private)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			rec, err := readRecord(p, strings.TrimSuffix(e.Name(), ".json"))
			if err != nil {
				return err
			}
			if rec.State == "installed" {
				w.snap.Progress = Progress{App: rec.Manifest.ID, Action: "start"}
				_, err := dataDir(p, rec)
				if err == nil {
					err = w.start(ctx, rec)
				}
				if err != nil {
					rec.Message = err.Error()
					if e := saveRecord(p, rec); e != nil {
						return e
					}
					if e := w.progress("failed", 0, err.Error()); e != nil {
						return e
					}
				} else {
					rec.Message = ""
					if err := saveRecord(p, rec); err != nil {
						return err
					}
					if err := w.progress("done", 100, "Your app is ready."); err != nil {
						return err
					}
				}
			}
		}
	} else if active(w.snap.Progress.Stage) {
		// Holding the lock proves that no worker is still doing this job.
		// A queued request can legitimately be waiting for this same lock.
		_, requestErr := os.Stat(p.Request)
		if w.snap.Progress.Stage != "queued" || errors.Is(requestErr, os.ErrNotExist) {
			w.snap.Progress.Stage, w.snap.Progress.Message = "failed", "The app change was interrupted. Check My Apps before trying again."
		} else if requestErr != nil {
			return requestErr
		}
	}
	if err := w.refresh(ctx); err != nil {
		return err
	}
	w.snap.Updated = time.Now().UTC()
	return atomicJSON(p.Public, w.snap, 0o644)
}

func (w *worker) refresh(ctx context.Context) error {
	entries, err := os.ReadDir(w.p.Private)
	if err != nil {
		return err
	}
	before := w.snap
	w.snap.Apps = []App{}
	addresses := system.Read().Addresses
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(e.Name(), ".json")
		rec, err := readRecord(w.p, id)
		if err != nil {
			return err
		}
		a := App{ID: id, Pool: rec.Pool, Port: rec.Manifest.Web.Host, State: Stopped}
		if rec.State == "removed" {
			a.State, a.DataKept = NotInstalled, true
			w.snap.Apps = append(w.snap.Apps, a)
			continue
		}
		running := 0
		for _, s := range rec.Manifest.Services {
			var st instanceState
			sampleCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			err := w.c.call(sampleCtx, "GET", statePath(id, s.Name), nil, &st)
			cancel()
			if err != nil {
				a.State, a.Message = "error", "Some parts of this app are missing or unavailable."
				continue
			}
			if st.Status == "Running" {
				running++
				a.Memory += st.Memory.Usage
				a.CPUTime += st.CPU.Usage
				if !st.StartedAt.IsZero() {
					uptime := time.Since(st.StartedAt).Seconds()
					if a.Uptime == 0 || uptime < a.Uptime {
						a.Uptime = uptime
					}
				}
			}
		}
		if running == len(rec.Manifest.Services) {
			a.State = Running
			if len(addresses) > 0 {
				a.URL = "http://" + net.JoinHostPort(addresses[0], strconv.Itoa(a.Port))
			}
		} else if running > 0 {
			a.State, a.Message = "error", "Only part of this app is running. Try Start or check its logs."
		}
		if rec.State == "installing" || rec.State == "removing" {
			a.State, a.Message = "error", "The install did not finish. Uninstall it before trying again. Your files will be kept."
		}
		if rec.Message != "" {
			a.State, a.Message, a.URL = "error", rec.Message, ""
		}
		if a.State == Running {
			for _, old := range before.Apps {
				elapsed := time.Since(before.Sampled).Seconds()
				if old.ID == id && old.State == Running && !before.Sampled.IsZero() && elapsed > 0 && a.CPUTime >= old.CPUTime && a.Uptime >= old.Uptime {
					value := float64(a.CPUTime-old.CPUTime) / 1e9 / elapsed * 100
					a.CPU = &value
				}
			}
		}
		w.snap.Apps = append(w.snap.Apps, a)
	}
	w.snap.Sampled = time.Now().UTC()
	return nil
}
