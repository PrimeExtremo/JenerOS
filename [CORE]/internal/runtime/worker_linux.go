package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	goruntime "runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/system"
)

type worker struct {
	p      Paths
	c      *client
	snap   Snapshot
	health func(context.Context, string, catalog.Health) error
}

func Apply(p Paths) error {
	if os.Geteuid() != 0 {
		return errors.New("App worker requires root.")
	}
	lock, err := lockWorker(p, true)
	if err != nil {
		return err
	}
	defer lock.Close()
	w := worker{p: p, c: newClient(p.Socket)}
	w.snap, err = (&Incus{Paths: p}).Read()
	if err != nil {
		return err
	}
	return w.apply()
}

func (w *worker) progress(stage string, percent int, message string) error {
	w.snap.Progress.Stage, w.snap.Progress.Percent, w.snap.Progress.Message = stage, percent, message
	w.snap.Updated = time.Now().UTC()
	return atomicJSON(w.p.Public, w.snap, 0o644)
}

func (w *worker) apply() (err error) {
	changing := false
	defer func() {
		if err != nil {
			// Keep failures with their app, so a later job for another app cannot
			// turn an unhealthy install into an apparently healthy one.
			if changing {
				rec, readErr := readRecord(w.p, w.snap.Progress.App)
				if readErr == nil {
					rec.Message = err.Error()
					err = errors.Join(err, saveRecord(w.p, rec))
				} else if !errors.Is(readErr, os.ErrNotExist) {
					err = errors.Join(err, readErr)
				}
			}
			err = errors.Join(err, w.progress("failed", w.snap.Progress.Percent, err.Error()))
		}
		if e := os.Remove(w.p.Request); e != nil && !errors.Is(e, os.ErrNotExist) {
			err = errors.Join(err, e)
		}
	}()
	r, err := readRequest(w.p.Request)
	if err != nil {
		w.snap.Progress = Progress{}
		return err
	}
	w.snap.Progress = Progress{ID: r.ID, App: r.App, Action: r.Action}
	if _, err := os.Stat(w.p.SetupDone); err != nil {
		return ErrUnavailable
	}
	if _, err := os.Stat(w.p.Ready); err != nil {
		return ErrUnavailable
	}
	if err := w.progress("checking", 1, "Checking your app."); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	defer cancel()
	rec, err := readRecord(w.p, r.App)
	if r.Action == "install" {
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if err == nil && rec.State != "removed" {
			return errors.New("This app already has an install. Use Start or Uninstall first.")
		}
		if err != nil {
			c, err := catalog.Load(w.p.Catalog)
			if err != nil {
				return err
			}
			m, ok := c.Get(r.App)
			if !ok || !m.Available {
				return ErrNotImplemented
			}
			if err := catalog.ValidateRuntime(m); err != nil {
				return err
			}
			pool, err := choosePool(w.p, r.Pool)
			if err != nil {
				return err
			}
			rec = record{Manifest: m, Pool: pool, Secrets: map[string]string{}, Hosts: map[string]string{}}
		} else if r.Pool != "" && r.Pool != rec.Pool {
			return errors.New("Reinstall on the same storage to use the files you kept.")
		}
		changing = true
		if err := w.install(ctx, &rec); err != nil {
			return err
		}
	} else {
		if err != nil {
			return errors.New("No saved install was found for this app.")
		}
		switch r.Action {
		case "start":
			if rec.State != "installed" && rec.State != "stopped" {
				return errors.New("Finish installing this app first. Uninstall a failed install before trying again.")
			}
			if _, err := dataDir(w.p, rec); err != nil {
				return err
			}
			changing = true
			if err := w.start(ctx, rec); err != nil {
				return err
			}
			rec.State, rec.Message = "installed", ""
			if err := saveRecord(w.p, rec); err != nil {
				return err
			}
		case "stop":
			if rec.State != "installed" && rec.State != "stopped" {
				return errors.New("Uninstall the incomplete app first. Your files will be kept.")
			}
			changing = true
			rec.State, rec.Message = "stopped", ""
			if err := saveRecord(w.p, rec); err != nil {
				return err
			}
			if err := w.stop(ctx, rec); err != nil {
				return err
			}
			rec.State = "stopped"
			if err := saveRecord(w.p, rec); err != nil {
				return err
			}
		case "uninstall":
			changing = true
			if err := w.uninstall(ctx, rec, r.DeleteData); err != nil {
				return err
			}
		}
	}
	if err := w.refresh(ctx); err != nil {
		return err
	}
	return w.progress("done", 100, "Your app change is complete.")
}

func (w *worker) install(ctx context.Context, rec *record) error {
	m := rec.Manifest
	archOK := false
	for _, arch := range m.Arch {
		archOK = archOK || arch == goruntime.GOARCH
	}
	if !archOK || system.Read().MemTotalMB < m.Requirements.MemoryMB {
		return errors.New("This box does not meet the app's memory or processor requirements.")
	}
	dir, err := dataDir(w.p, *rec)
	if err != nil {
		return err
	}
	var disk syscall.Statfs_t
	if err := syscall.Statfs(dir, &disk); err != nil {
		return err
	}
	if disk.Bavail*uint64(disk.Bsize) < uint64(m.Requirements.DiskGB)<<30 {
		return errors.New("There is not enough free space on this storage.")
	}
	listener, err := net.Listen("tcp", ":"+strconv.Itoa(m.Web.Host))
	if err != nil {
		return errors.New("Another app is using this port.")
	}
	if err := listener.Close(); err != nil {
		return err
	}
	vars := regexp.MustCompile(`\$\{secret\.([a-z][a-z0-9-]*)\}`)
	for _, s := range m.Services {
		for _, value := range s.Env {
			for _, match := range vars.FindAllStringSubmatch(value, -1) {
				if rec.Secrets[match[1]] == "" {
					b := make([]byte, 32)
					if _, err := rand.Read(b); err != nil {
						return err
					}
					rec.Secrets[match[1]] = hex.EncodeToString(b)
				}
			}
		}
	}
	// Persist the exact manifest and secrets before any engine mutation. Failed
	// installs are visible and removable; never silently adopt existing objects.
	rec.State, rec.Message = "installing", ""
	if err := saveRecord(w.p, *rec); err != nil {
		return err
	}
	if err := w.c.call(ctx, "POST", "/1.0/projects", map[string]any{
		"name": project(m.ID), "description": "JenerOS app " + m.ID,
		"config": map[string]string{"features.images": "false", "features.profiles": "false", "features.storage.volumes": "false", "features.networks": "false"},
	}, nil); err != nil {
		return err
	}
	rec.OwnProject = true
	if err := saveRecord(w.p, *rec); err != nil {
		return err
	}
	network := "ja-" + m.ID
	address := rec.Subnet
	if address == "" {
		address = "auto"
	}
	if err := w.c.call(ctx, "POST", "/1.0/networks", map[string]any{
		"name": network, "type": "bridge", "description": "JenerOS app " + m.ID,
		"config": map[string]string{"ipv4.address": address, "ipv4.nat": "true", "ipv6.address": "none", "dns.domain": m.ID + ".internal"},
	}, nil); err != nil {
		return err
	}
	rec.OwnNetwork = true
	if err := saveRecord(w.p, *rec); err != nil {
		return err
	}
	var netInfo struct {
		Config map[string]string `json:"config"`
	}
	if err := w.c.call(ctx, "GET", "/1.0/networks/"+network, nil, &netInfo); err != nil {
		return err
	}
	ip, subnet, err := net.ParseCIDR(netInfo.Config["ipv4.address"])
	if err != nil || ip.To4() == nil {
		return errors.New("Could not prepare the app network.")
	}
	rec.Subnet = netInfo.Config["ipv4.address"]
	for i, s := range m.Services {
		address := append(net.IP(nil), ip.To4()...)
		address[3] = byte(10 + i)
		if !subnet.Contains(address) {
			return errors.New("App network has no free addresses.")
		}
		rec.Hosts[s.Name] = address.String()
	}
	if err := saveRecord(w.p, *rec); err != nil {
		return err
	}
	for i, s := range m.Services {
		if err := w.progress("pulling", 5+i*60/len(m.Services), "Downloading "+s.Name+"."); err != nil {
			return err
		}
		registry, alias, _ := strings.Cut(s.Image, "/")
		var image struct {
			Fingerprint string `json:"fingerprint"`
		}
		if err := w.c.call(ctx, "POST", "/1.0/images", map[string]any{"source": map[string]string{
			"type": "image", "mode": "pull", "protocol": "oci", "server": "https://" + registry, "alias": alias,
		}}, &image); err != nil {
			return err
		}
		if !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(image.Fingerprint) {
			return errors.New("The downloaded app image could not be identified.")
		}
		if err := w.progress("creating", 10+i*60/len(m.Services), "Preparing "+s.Name+"."); err != nil {
			return err
		}
		config := map[string]string{"boot.autostart": "false", "boot.autorestart": "true", "security.privileged": "false", "user.jeneros.app": m.ID}
		for key, value := range s.Env {
			for name, secret := range rec.Secrets {
				value = strings.ReplaceAll(value, "${secret."+name+"}", secret)
			}
			for name, host := range rec.Hosts {
				value = strings.ReplaceAll(value, "${service."+name+".host}", host)
			}
			config["environment."+key] = value
		}
		devices := map[string]map[string]string{
			"root": {"type": "disk", "pool": "jeneros", "path": "/"},
			"eth0": {"type": "nic", "network": network, "name": "eth0", "ipv4.address": rec.Hosts[s.Name]},
		}
		for j, mount := range s.Mounts {
			source := filepath.Join(dir, mount.Pool)
			if err := safeDir(source, 0o755); err != nil {
				return err
			}
			devices[fmt.Sprintf("data%d", j)] = map[string]string{"type": "disk", "source": source, "path": mount.Path, "shift": "true", "readonly": strconv.FormatBool(mount.ReadOnly)}
		}
		if s.Name == m.Web.Service {
			devices["web"] = map[string]string{"type": "proxy", "listen": fmt.Sprintf("tcp:[::]:%d", m.Web.Host), "connect": fmt.Sprintf("tcp:127.0.0.1:%d", m.Web.Port)}
		}
		if err := w.c.call(ctx, "POST", "/1.0/instances?project="+project(m.ID), map[string]any{
			"name": s.Name, "type": "container", "profiles": []string{}, "config": config, "devices": devices,
			"source": map[string]string{"type": "image", "fingerprint": image.Fingerprint},
		}, nil); err != nil {
			return err
		}
	}
	// Full creation is durable before Start. Retrying Start after a health failure
	// is safe and never generates a new database password.
	rec.State = "installed"
	if err := saveRecord(w.p, *rec); err != nil {
		return err
	}
	return w.start(ctx, *rec)
}

func (w *worker) start(ctx context.Context, rec record) error {
	if !rec.OwnProject || !rec.OwnNetwork {
		return errors.New("This app install is incomplete. Uninstall it before trying again.")
	}
	check := w.health
	if check == nil {
		check = healthy
	}
	for i, s := range rec.Manifest.Services {
		if err := w.progress("starting", 72+i*20/len(rec.Manifest.Services), "Starting "+s.Name+"."); err != nil {
			return err
		}
		var st instanceState
		if err := w.c.call(ctx, "GET", statePath(rec.Manifest.ID, s.Name), nil, &st); err != nil {
			return err
		}
		if st.Status != "Running" {
			if err := w.c.call(ctx, "PUT", statePath(rec.Manifest.ID, s.Name), map[string]any{"action": "start", "timeout": 60}, nil); err != nil {
				return err
			}
		}
		if err := w.progress("health", 74+i*20/len(rec.Manifest.Services), "Waiting for "+s.Name+" to be ready."); err != nil {
			return err
		}
		if err := check(ctx, rec.Hosts[s.Name], s.Health); err != nil {
			return fmt.Errorf("%s did not become ready. You can try Start again or check its logs.", s.Name)
		}
	}
	return nil
}

func healthy(ctx context.Context, host string, h catalog.Health) error {
	if net.ParseIP(host) == nil {
		return errors.New("Invalid saved app address.")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	httpClient := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	defer httpClient.CloseIdleConnections()
	for {
		address := net.JoinHostPort(host, strconv.Itoa(h.Port))
		if h.Path == "" {
			conn, err := (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "tcp", address)
			if err == nil {
				return conn.Close()
			}
		} else {
			req, err := http.NewRequestWithContext(ctx, "GET", "http://"+address+h.Path, nil)
			if err != nil {
				return err
			}
			res, err := httpClient.Do(req)
			if err == nil {
				res.Body.Close()
				if res.StatusCode >= 200 && res.StatusCode < 400 {
					return nil
				}
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (w *worker) stop(ctx context.Context, rec record) error {
	if !rec.OwnProject {
		return nil
	}
	for i := len(rec.Manifest.Services) - 1; i >= 0; i-- {
		s := rec.Manifest.Services[i]
		var st instanceState
		err := w.c.call(ctx, "GET", statePath(rec.Manifest.ID, s.Name), nil, &st)
		if missing(err) {
			continue
		}
		if err != nil {
			return err
		}
		if st.Status != "Stopped" {
			if err := w.c.call(ctx, "PUT", statePath(rec.Manifest.ID, s.Name), map[string]any{"action": "stop", "timeout": 60}, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

func (w *worker) uninstall(ctx context.Context, rec record, erase bool) error {
	rec.State = "removing"
	if err := saveRecord(w.p, rec); err != nil {
		return err
	}
	if err := w.progress("removing", 20, "Stopping your app. Your files will be kept unless you chose to delete them."); err != nil {
		return err
	}
	if err := w.stop(ctx, rec); err != nil {
		return err
	}
	for _, s := range rec.Manifest.Services {
		if !rec.OwnProject {
			break
		}
		if err := w.c.call(ctx, "DELETE", instancePath(rec.Manifest.ID, s.Name), nil, nil); err != nil && !missing(err) {
			return err
		}
	}
	paths := []string{}
	if rec.OwnProject {
		paths = append(paths, "/1.0/projects/"+project(rec.Manifest.ID))
	}
	if rec.OwnNetwork {
		paths = append(paths, "/1.0/networks/ja-"+rec.Manifest.ID)
	}
	for _, path := range paths {
		if err := w.c.call(ctx, "DELETE", path, nil, nil); err != nil && !missing(err) {
			return err
		}
	}
	rec.State, rec.Message = "removed", ""
	rec.OwnProject, rec.OwnNetwork = false, false
	if err := saveRecord(w.p, rec); err != nil {
		return err
	}
	if erase {
		dir, err := dataDir(w.p, rec)
		if err != nil {
			return err
		}
		if err := deleteData(dir); err != nil {
			return err
		}
		return os.Remove(filepath.Join(w.p.Private, rec.Manifest.ID+".json"))
	}
	return nil
}
