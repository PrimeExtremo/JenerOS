package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
)

func TestWorkerRejectsRequestFiles(t *testing.T) {
	dir := t.TempDir()
	regular := filepath.Join(dir, "regular")
	id := strings.Repeat("a", 32)
	if err := os.WriteFile(regular, []byte(`{"id":"`+id+`","app":"photos","action":"install"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := readRequest(regular); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "link")
	if err := os.Symlink(regular, link); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{link, dir} {
		if _, err := readRequest(path); err == nil {
			t.Fatal("non-regular request accepted")
		}
	}
	if err := os.WriteFile(regular, []byte(strings.Repeat(" ", 4097)), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := readRequest(regular); err == nil {
		t.Fatal("oversized request accepted")
	}
}

func TestInstallUsesOCIAndPersistsSecretsBeforeStart(t *testing.T) {
	p := testPaths(t)
	if err := safeDir(p.Private, 0o700); err != nil {
		t.Fatal(err)
	}
	cat, err := catalog.Load(p.Catalog)
	if err != nil {
		t.Fatal(err)
	}
	m, _ := cat.Get("photos")
	m.Requirements.MemoryMB, m.Requirements.DiskGB = 1, 1
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	m.Web.Host = l.Addr().(*net.TCPAddr).Port
	l.Close()
	rec := record{Manifest: m, Pool: SystemPool, Secrets: map[string]string{}, Hosts: map[string]string{}}
	created, pulled, checked := 0, 0, 0
	c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
		meta := any(map[string]any{})
		switch {
		case r.Method == "GET" && r.URL.Path == "/1.0/networks/ja-photos":
			meta = map[string]any{"config": map[string]string{"ipv4.address": "10.88.0.1/24"}}
		case r.Method == "POST" && r.URL.Path == "/1.0/images":
			pulled++
			var body struct {
				Source map[string]string `json:"source"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Source["protocol"] != "oci" || body.Source["mode"] != "pull" {
				t.Error("image was not pulled as OCI")
			}
			meta = map[string]string{"fingerprint": strings.Repeat("a", 64)}
		case r.Method == "POST" && r.URL.Path == "/1.0/instances":
			created++
			var body struct {
				Name    string                       `json:"name"`
				Config  map[string]string            `json:"config"`
				Devices map[string]map[string]string `json:"devices"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if r.URL.Query().Get("project") != "jener-photos" || body.Config["security.privileged"] != "false" || body.Config["boot.autostart"] != "false" {
				t.Error("missing privilege or boot controls")
			}
			if body.Name == "db" && len(body.Config["environment.POSTGRES_PASSWORD"]) != 64 {
				t.Error("missing generated database secret")
			}
			for _, dev := range body.Devices {
				if dev["source"] != "" && !strings.HasPrefix(dev["source"], filepath.Join(filepath.Dir(p.Private), "Apps", "photos")+"/") {
					t.Error("volume escaped selected storage")
				}
			}
		case strings.HasSuffix(r.URL.Path, "/state"):
			meta = map[string]string{"status": "Stopped"}
		}
		json.NewEncoder(w).Encode(map[string]any{"type": "sync", "metadata": meta})
	})
	w := worker{p: p, c: c, health: func(_ context.Context, host string, h catalog.Health) error {
		if created != 4 || host != "10.88.0."+strconv.Itoa(10+checked) {
			t.Error("started before creation or wrong dependency order")
		}
		checked++
		stored, err := readRecord(p, "photos")
		if err != nil || stored.Secrets["db"] == "" {
			t.Error("secret was not persisted before starting")
		}
		return nil
	}}
	if err := w.install(context.Background(), &rec); err != nil {
		t.Fatal(err)
	}
	if pulled != 4 || created != 4 || checked != 4 || rec.Subnet != "10.88.0.1/24" {
		t.Fatalf("incomplete install: %d %d %d", pulled, created, checked)
	}
	st, err := os.Stat(filepath.Join(p.Private, "photos.json"))
	if err != nil || st.Mode().Perm() != 0o600 {
		t.Fatal("secrets are not root-private")
	}
	public, _ := os.ReadFile(p.Public)
	if strings.Contains(string(public), rec.Secrets["db"]) {
		t.Fatal("secret in public status")
	}
}

func TestRejectedWorkerConsumesRequest(t *testing.T) {
	p := testPaths(t)
	if err := os.WriteFile(p.Request, []byte(`{"action":"exec"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	w := worker{p: p}
	if err := w.apply(); err == nil {
		t.Fatal("invalid request accepted")
	}
	if _, err := os.Stat(p.Request); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("rejected request left path worker spinning")
	}
	s, err := (&Incus{Paths: p}).Read()
	if err != nil || s.Progress.Stage != "failed" {
		t.Fatal("no honest failure status")
	}
}

func testRecord(t *testing.T, p Paths) record {
	t.Helper()
	c, err := catalog.Load(p.Catalog)
	if err != nil {
		t.Fatal(err)
	}
	m, _ := c.Get("tv")
	return record{Manifest: m, Pool: SystemPool, Secrets: map[string]string{"db": "private-value"}, Hosts: map[string]string{"server": "127.0.0.1"}, State: "installed", OwnProject: true, OwnNetwork: true}
}

func TestUninstallKeepsFilesAndSecrets(t *testing.T) {
	for _, erase := range []bool{false, true} {
		p := testPaths(t)
		if err := safeDir(p.Private, 0o700); err != nil {
			t.Fatal(err)
		}
		rec := testRecord(t, p)
		dir, err := dataDir(p, rec)
		if err != nil {
			t.Fatal(err)
		}
		photo := filepath.Join(dir, "photo.jpg")
		if err := os.WriteFile(photo, []byte("a saved photo"), 0o600); err != nil {
			t.Fatal(err)
		}
		var deleted []string
		c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "DELETE" {
				deleted = append(deleted, r.URL.Path)
			}
			json.NewEncoder(w).Encode(map[string]any{"type": "sync", "metadata": map[string]string{"status": "Stopped"}})
		})
		w := worker{p: p, c: c}
		if err := w.uninstall(context.Background(), rec, erase); err != nil {
			t.Fatal(err)
		}
		if len(deleted) != 3 {
			t.Fatalf("cleanup missing: %v", deleted)
		}
		_, dataErr := os.Stat(photo)
		kept, recordErr := readRecord(p, "tv")
		if erase {
			if !errors.Is(dataErr, os.ErrNotExist) || !errors.Is(recordErr, os.ErrNotExist) {
				t.Fatal("confirmed deletion did not remove data and secrets")
			}
		} else if dataErr != nil || recordErr != nil || kept.Secrets["db"] != "private-value" || kept.State != "removed" {
			t.Fatal("uninstall lost saved data")
		}
		b, _ := os.ReadFile(p.Public)
		if strings.Contains(string(b), "private-value") {
			t.Fatal("secret leaked to status")
		}
	}
}

func TestUninstallDoesNotTouchForeignObjects(t *testing.T) {
	p := testPaths(t)
	if err := safeDir(p.Private, 0o700); err != nil {
		t.Fatal(err)
	}
	rec := testRecord(t, p)
	rec.OwnProject, rec.OwnNetwork = false, false
	c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("foreign engine object touched") })
	w := worker{p: p, c: c}
	if err := w.uninstall(context.Background(), rec, false); err != nil {
		t.Fatal(err)
	}
}

func TestDataPathRejectsSymlink(t *testing.T) {
	p := testPaths(t)
	rec := testRecord(t, p)
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(filepath.Dir(p.Private), "Apps")); err != nil {
		t.Fatal(err)
	}
	if _, err := dataDir(p, rec); err == nil {
		t.Fatal("followed a data symlink")
	}
	rec.Pool = "missing"
	if _, err := dataDir(p, rec); err == nil {
		t.Fatal("missing data pool fell back to system disk")
	}
	if _, err := poolBase(p, "system"); err == nil {
		t.Fatal("a named pool was confused with the system disk")
	}
}

func TestStartFailurePersistsUntilSuccessfulRetry(t *testing.T) {
	p := testPaths(t)
	if err := safeDir(p.Private, 0o700); err != nil {
		t.Fatal(err)
	}
	rec := testRecord(t, p)
	if err := saveRecord(p, rec); err != nil {
		t.Fatal(err)
	}
	c := fakeClient(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"type": "sync", "metadata": map[string]string{"status": "Running"}})
	})
	w := worker{p: p, c: c}
	for _, fail := range []bool{true, false} {
		w.health = func(context.Context, string, catalog.Health) error {
			if fail {
				return errors.New("not ready")
			}
			return nil
		}
		request, err := json.Marshal(Request{ID: strings.Repeat("b", 32), App: "tv", Action: "start"})
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p.Request, request, 0o600); err != nil {
			t.Fatal(err)
		}
		if err := w.apply(); (err != nil) != fail {
			t.Fatalf("start fail=%v: %v", fail, err)
		}
		saved, err := readRecord(p, "tv")
		if err != nil || (saved.Message != "") != fail || saved.State != "installed" {
			t.Fatalf("health failure/recovery was not persisted: %+v %v", saved, err)
		}
		if _, err := os.Stat(p.Request); !errors.Is(err, os.ErrNotExist) {
			t.Fatal("completed request was not consumed")
		}
	}
}
