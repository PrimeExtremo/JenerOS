package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Init applies the shipped preseed once. The selected source is persisted before
// creating the pool, so a missing disk after reboot never switches to the root disk.
func Init(p Paths) error {
	if os.Geteuid() != 0 {
		return errors.New("App initialization requires root.")
	}
	lock, err := lockWorker(p, true)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := os.Remove(p.Ready); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	selection := filepath.Join(p.Private, "incus-pool")
	b, err := os.ReadFile(selection)
	pool := strings.TrimSpace(string(b))
	if errors.Is(err, os.ErrNotExist) {
		pool, err = choosePool(p, "")
		if err != nil {
			return err
		}
		if err := os.WriteFile(selection, []byte(pool+"\n"), 0o600); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	base, err := poolBase(p, pool)
	if err != nil {
		return err
	}
	source := filepath.Join(base, ".jeneros", "incus")
	if err := safeDir(source, 0o700); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	c := newClient(p.Socket)
	marker := filepath.Join(p.Private, "incus-initialized")
	if _, err := os.Stat(marker); err == nil {
		var existing struct {
			Config map[string]string `json:"config"`
		}
		if err := c.call(ctx, "GET", "/1.0/storage-pools/jeneros", nil, &existing); err != nil {
			return err
		}
		if existing.Config["source"] != source {
			return errors.New("The app engine storage has changed. Check its saved source.")
		}
		return os.WriteFile(p.Ready, []byte("ready\n"), 0o644)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	for _, path := range []string{"/1.0/storage-pools/jeneros", "/1.0/networks/incusbr0"} {
		if err := c.call(ctx, "GET", path, nil, nil); !missing(err) {
			return errors.New("The app engine already has storage or a bridge. Review it before initializing JenerOS apps.")
		}
	}
	preseed, err := os.ReadFile("/usr/lib/jeneros/incus-preseed.json")
	if err != nil {
		return err
	}
	var config struct {
		Config       map[string]string `json:"config"`
		Networks     []map[string]any   `json:"networks"`
		StoragePools []map[string]any   `json:"storage_pools"`
		Profiles     []map[string]any   `json:"profiles"`
	}
	if err := json.Unmarshal(preseed, &config); err != nil {
		return err
	}
	if len(config.StoragePools) != 1 {
		return errors.New("Invalid app engine preseed.")
	}
	config.StoragePools[0]["config"] = map[string]string{"source": source}
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	// JSON is valid YAML. A fixed executable and fixed argv receive stdin only.
	cmd := exec.CommandContext(ctx, "/usr/bin/incus", "admin", "init", "--preseed")
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin", "HOME=/root", "LC_ALL=C"}
	cmd.Stdin = bytes.NewReader(data)
	if err := cmd.Run(); err != nil {
		return errors.New("Could not prepare the app engine. Check Incus and storage.")
	}
	if err := os.WriteFile(marker, []byte("initialized\n"), 0o600); err != nil {
		return err
	}
	return os.WriteFile(p.Ready, []byte("ready\n"), 0o644)
}
