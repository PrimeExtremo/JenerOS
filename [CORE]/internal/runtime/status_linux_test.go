package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func TestAppReadingsAndDurableHealthFailure(t *testing.T) {
	p := testPaths(t)
	if err := safeDir(p.Private, 0o700); err != nil {
		t.Fatal(err)
	}
	rec := testRecord(t, p)
	if err := saveRecord(p, rec); err != nil {
		t.Fatal(err)
	}
	c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"type": "sync", "metadata": map[string]any{
			"status": "Running", "started_at": time.Now().Add(-time.Hour),
			"cpu": map[string]uint64{"usage": 1000000000}, "memory": map[string]uint64{"usage": 104857600},
		}})
	})
	w := worker{p: p, c: c, snap: Snapshot{
		Sampled: time.Now().Add(-10 * time.Second),
		Apps:    []App{{ID: "tv", State: Running, CPUTime: 500000000, Uptime: 3500}},
	}}
	if err := w.refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	a := w.snap.Apps[0]
	if a.State != Running || a.Memory != 104857600 || a.Uptime < 3590 || a.CPU == nil || *a.CPU < 4 || *a.CPU > 6 {
		t.Fatalf("incorrect live readings: %+v", a)
	}
	rec.Message = "server did not become ready."
	if err := saveRecord(p, rec); err != nil {
		t.Fatal(err)
	}
	w.snap.Progress = Progress{App: "photos", Stage: "done"}
	if err := w.refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	a = w.snap.Apps[0]
	if a.State != "error" || a.Message != rec.Message || a.URL != "" || a.CPU != nil {
		t.Fatalf("another app's job hid a health failure: %+v", a)
	}
}
