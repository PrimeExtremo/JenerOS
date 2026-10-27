package runtime

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/storage"
)

type record struct {
	Manifest   catalog.Manifest  `json:"manifest"`
	Pool       string            `json:"pool"`
	Secrets    map[string]string `json:"secrets"`
	Hosts      map[string]string `json:"hosts"`
	State      string            `json:"state"`
	Message    string            `json:"message,omitempty"`
	OwnProject bool              `json:"ownProject"`
	OwnNetwork bool              `json:"ownNetwork"`
	Subnet     string            `json:"subnet"`
}

func atomicJSON(path string, v any, mode os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".apps-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err := f.Chmod(mode); err != nil {
		f.Close()
		return err
	}
	err = json.NewEncoder(f).Encode(v)
	if err == nil {
		err = f.Sync()
	}
	if e := f.Close(); err == nil {
		err = e
	}
	if err == nil {
		err = os.Rename(f.Name(), path)
	}
	if err != nil {
		return err
	}
	d, err := os.Open(filepath.Dir(path))
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// Check every ancestor, including already-existing directories. Container data
// is below a root-only Apps directory and cannot replace its ancestors.
func safeDir(path string, mode os.FileMode) error {
	if path == "/" {
		return nil
	}
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return errors.New("Invalid app storage path.")
	}
	if err := safeDir(filepath.Dir(path), mode); err != nil {
		return err
	}
	st, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return os.Mkdir(path, mode)
	}
	if err != nil {
		return err
	}
	if !st.IsDir() || st.Mode()&os.ModeSymlink != 0 {
		return errors.New("App storage must use real directories.")
	}
	return nil
}

func lockWorker(p Paths, block bool) (*os.File, error) {
	if err := safeDir(p.Private, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(p.Private, 0o700); err != nil {
		return nil, err
	}
	if err := safeDir(filepath.Dir(p.Public), 0o755); err != nil {
		return nil, err
	}
	if err := os.Chmod(filepath.Dir(p.Public), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(filepath.Join(p.Private, "worker.lock"), os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0o600)
	if err != nil {
		return nil, err
	}
	flags := syscall.LOCK_EX
	if !block {
		flags |= syscall.LOCK_NB
	}
	if err := syscall.Flock(int(f.Fd()), flags); err != nil {
		f.Close()
		return nil, ErrBusy
	}
	return f, nil
}

func readRequest(path string) (Request, error) {
	var r Request
	f, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return r, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return r, err
	}
	if !st.Mode().IsRegular() || st.Size() > 4096 {
		return r, ErrInvalid
	}
	if err := Decode(f, &r); err != nil || !jobID.MatchString(r.ID) || Validate(r) != nil {
		return Request{}, ErrInvalid
	}
	return r, nil
}

func readRecord(p Paths, id string) (record, error) {
	var rec record
	b, err := os.ReadFile(filepath.Join(p.Private, id+".json"))
	if err != nil {
		return rec, err
	}
	if err := json.Unmarshal(b, &rec); err != nil {
		return rec, err
	}
	if rec.Manifest.ID != id || catalog.ValidateRuntime(rec.Manifest) != nil || (rec.Pool != SystemPool && !poolName.MatchString(rec.Pool)) {
		return rec, errors.New("Invalid saved app record.")
	}
	return rec, nil
}

func saveRecord(p Paths, rec record) error {
	return atomicJSON(filepath.Join(p.Private, rec.Manifest.ID+".json"), rec, 0o600)
}

func poolBase(p Paths, pool string) (string, error) {
	if pool == SystemPool {
		return filepath.Dir(p.Private), nil
	}
	if !poolName.MatchString(pool) {
		return "", ErrInvalid
	}
	sp := storage.DefaultPaths
	sp.Pools, sp.Records = p.Pools, p.Storage
	pools, err := storage.Pools(sp)
	if err != nil {
		return "", err
	}
	for _, item := range pools {
		if item.Name == pool && item.Mounted && item.State == "ready" {
			return item.Path, nil
		}
	}
	return "", errors.New("Your app storage is not connected. Reconnect it before continuing.")
}

func choosePool(p Paths, requested string) (string, error) {
	if requested != "" {
		_, err := poolBase(p, requested)
		return requested, err
	}
	sp := storage.DefaultPaths
	sp.Pools, sp.Records = p.Pools, p.Storage
	pools, err := storage.Pools(sp)
	if err != nil {
		return "", err
	}
	for _, item := range pools {
		if item.Mounted && item.State == "ready" {
			return item.Name, nil
		}
	}
	if len(pools) != 0 {
		return "", errors.New("Reconnect your storage or choose the system disk.")
	}
	return SystemPool, nil
}

func dataDir(p Paths, rec record) (string, error) {
	base, err := poolBase(p, rec.Pool)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "Apps", rec.Manifest.ID)
	if err := safeDir(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func deleteData(dir string) error {
	// Never descend into another filesystem, even if mounted inside app data.
	b, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) > 4 && (fields[4] == dir || strings.HasPrefix(fields[4], dir+"/")) {
			return errors.New("App folders still contain a mount. Data was kept.")
		}
	}
	return os.RemoveAll(dir)
}
