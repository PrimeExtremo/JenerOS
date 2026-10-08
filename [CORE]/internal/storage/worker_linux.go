package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

func atomicJSON(path string, value any) error {
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".storage-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err := f.Chmod(0o644); err != nil {
		f.Close()
		return err
	}
	if _, err := f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

// readPools counts only mounted filesystems. An unmounted directory must never
// look like a healthy pool by reporting the system disk's free space.
func readPools(p Paths) ([]Pool, error) {
	pools := []Pool{}
	entries, err := os.ReadDir(p.Records)
	if errors.Is(err, os.ErrNotExist) {
		return pools, nil
	}
	if err != nil {
		return nil, err
	}
	mounts, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(p.Records, e.Name()))
		if err != nil {
			return nil, err
		}
		var pool Pool
		if err := json.Unmarshal(b, &pool); err != nil {
			return nil, err
		}
		if !namePattern.MatchString(pool.Name) || pool.Path != filepath.Join(p.Pools, pool.Name) {
			return nil, errors.New("Invalid storage record")
		}
		for _, line := range strings.Split(string(mounts), "\n") {
			fields := strings.Fields(line)
			if len(fields) > 5 && fields[4] == pool.Path && strings.Contains(line, " - btrfs ") {
				pool.Mounted = true
			}
		}
		if pool.Mounted {
			var stat syscall.Statfs_t
			if err := syscall.Statfs(pool.Path, &stat); err != nil {
				return nil, err
			}
			pool.Total, pool.Free = stat.Blocks*uint64(stat.Bsize), stat.Bavail*uint64(stat.Bsize)
		}
		pools = append(pools, pool)
	}
	return pools, nil
}

// Apply is called only by the root oneshot, outside jenerd's mount namespace.
// Requests stay present until a terminal status is published. A root-owned flock
// serializes workers; O_EXCL pool reservations survive a crash/reboot and prevent
// automatic retries from overwriting a partly-created filesystem.
type workerOps struct {
	run      func(context.Context, string, ...string) ([]byte, error)
	discover func(context.Context, Paths) ([]Disk, error)
	blank    func(context.Context, string) error
}

func Apply(p Paths) error {
	if os.Geteuid() != 0 {
		return errors.New("Storage worker requires root.")
	}
	return apply(p, workerOps{Run, Discover, blankDevice})
}

func apply(p Paths, ops workerOps) (err error) {
	if err := os.MkdirAll(filepath.Dir(p.Status), 0o755); err != nil {
		return err
	}
	lock, err := os.OpenFile(filepath.Join(filepath.Dir(p.Status), "worker.lock"), os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0o600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return ErrBusy
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	var job Job
	status := Status{State: "working", Message: "Checking your disks…"}
	defer func() {
		if err != nil {
			status.State, status.Message = "failed", "Storage could not be created. "+err.Error()+" Check the disks before trying again."
			err = errors.Join(err, atomicJSON(p.Status, status))
		}
		// Consume even rejected requests so the path unit cannot spin forever.
		if e := os.Remove(p.Request); e != nil && !errors.Is(e, os.ErrNotExist) {
			err = errors.Join(err, e)
		}
	}()
	f, err := os.OpenFile(p.Request, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}
	if !st.Mode().IsRegular() || st.Size() > 16384 {
		f.Close()
		return errors.New("Invalid storage request file.")
	}
	err = Decode(f, &job)
	f.Close()
	if err != nil {
		return err
	}
	status.ID, status.Name = job.ID, job.Name
	if !regexp.MustCompile(`^[a-f0-9]{32}$`).MatchString(job.ID) {
		return errors.New("Invalid storage request ID.")
	}
	if _, err := os.Stat(p.SetupDone); err != nil {
		return ErrUnavailable
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	if err := atomicJSON(p.Status, status); err != nil {
		return err
	}
	if _, err := ops.run(ctx, "udevadm", "settle", "--timeout=10"); err != nil {
		return err
	}
	disks, err := ops.discover(ctx, p)
	if err != nil {
		return err
	}
	if err := Validate(job.Request, disks); err != nil {
		return err
	}
	for _, path := range job.Disks {
		if err := ops.blank(ctx, path); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(p.Pools, 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(p.Records, 0o755); err != nil {
		return err
	}
	pool := Pool{Name: job.Name, Profile: job.Profile, Path: filepath.Join(p.Pools, job.Name), State: "incomplete"}
	unitBytes, err := ops.run(ctx, "systemd-escape", "--path", "--suffix=mount", pool.Path)
	if err != nil {
		return err
	}
	unitName := strings.TrimSpace(string(unitBytes))
	if unitName == "" || filepath.Base(unitName) != unitName || !strings.HasSuffix(unitName, ".mount") {
		return errors.New("Invalid mount unit name.")
	}
	unitPath := filepath.Join(p.Units, unitName)
	if _, err := os.Lstat(unitPath); !errors.Is(err, os.ErrNotExist) {
		return errors.New("A mount with that name already exists.")
	}
	recordPath := filepath.Join(p.Records, job.Name+".json")
	reservation, err := os.CreateTemp(p.Records, ".reservation-*")
	if err != nil {
		return err
	}
	if err := reservation.Close(); err != nil {
		return err
	}
	defer os.Remove(reservation.Name())
	if err := atomicJSON(reservation.Name(), pool); err != nil {
		return err
	}
	if err := os.Link(reservation.Name(), recordPath); err != nil {
		return errors.New("That storage name is already in use.")
	}
	if err := os.Mkdir(pool.Path, 0o755); err != nil {
		return err
	}
	for _, path := range job.Disks {
		// Refresh the whole selection immediately before each destructive command.
		disks, err := ops.discover(ctx, p)
		if err != nil {
			return err
		}
		if err := Validate(job.Request, disks); err != nil {
			return err
		}
		if err := ops.blank(ctx, path); err != nil {
			return err
		}
		status.Message, status.Percent = "Preparing your empty disks…", 15
		if err := atomicJSON(p.Status, status); err != nil {
			return err
		}
		if _, err := ops.run(ctx, "wipefs", "--all", path); err != nil {
			return err
		}
	}
	// No --force: mkfs retains its own mounted-device and signature safeguards.
	disks, err = ops.discover(ctx, p)
	if err != nil {
		return err
	}
	if err := Validate(job.Request, disks); err != nil {
		return err
	}
	for _, path := range job.Disks {
		if err := ops.blank(ctx, path); err != nil {
			return err
		}
	}
	status.Message, status.Percent = "Making a home for your files…", 35
	if err := atomicJSON(p.Status, status); err != nil {
		return err
	}
	args := append([]string{"-d", job.Profile, "-m", job.Profile, "-L", job.Name}, job.Disks...)
	if _, err := ops.run(ctx, "mkfs.btrfs", args...); err != nil {
		return err
	}
	uuid, err := ops.run(ctx, "blkid", "-p", "-s", "UUID", "-o", "value", job.Disks[0])
	if err != nil {
		return err
	}
	pool.UUID = strings.TrimSpace(string(uuid))
	if !regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`).MatchString(pool.UUID) {
		return errors.New("Could not identify the new filesystem.")
	}
	if err := atomicJSON(recordPath, pool); err != nil {
		return err
	}
	status.Message, status.Percent = "Connecting your storage…", 75
	if err := atomicJSON(p.Status, status); err != nil {
		return err
	}
	unit := fmt.Sprintf("[Unit]\nDescription=JenerOS storage %s\nJobTimeoutSec=60s\n\n[Mount]\nWhat=/dev/disk/by-uuid/%s\nWhere=%s\nType=btrfs\nOptions=defaults\nTimeoutSec=60s\n\n[Install]\nWantedBy=local-fs.target\n", job.Name, pool.UUID, pool.Path)
	u, err := os.OpenFile(unitPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	_, err = u.WriteString(unit)
	if e := u.Close(); err == nil {
		err = e
	}
	if err != nil {
		return err
	}
	if _, err := ops.run(ctx, "btrfs", append([]string{"device", "scan"}, job.Disks...)...); err != nil {
		return err
	}
	if _, err := ops.run(ctx, "udevadm", "settle", "--timeout=10"); err != nil {
		return err
	}
	if _, err := ops.run(ctx, "systemctl", "daemon-reload"); err != nil {
		return err
	}
	if _, err := ops.run(ctx, "systemctl", "enable", unitName); err != nil {
		return err
	}
	if _, err := ops.run(ctx, "systemctl", "start", unitName); err != nil {
		return err
	}
	for _, dir := range []string{"Photos", "Files", "Media", "Backups", ".jeneros"} {
		if err := os.Mkdir(filepath.Join(pool.Path, dir), 0o755); err != nil {
			return err
		}
	}
	pool.State = "ready"
	if err := atomicJSON(recordPath, pool); err != nil {
		return err
	}
	status.State, status.Message, status.Percent = "done", "Your storage is ready.", 100
	return atomicJSON(p.Status, status)
}

func blankDevice(ctx context.Context, path string) error {
	st, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if st.Mode()&os.ModeDevice == 0 || st.Mode()&os.ModeCharDevice != 0 || st.Mode()&os.ModeSymlink != 0 {
		return errors.New("Choose a real whole disk.")
	}
	b, err := Run(ctx, "wipefs", "--no-act", "--json", path)
	if err != nil {
		return err
	}
	var report struct {
		Signatures *[]json.RawMessage `json:"signatures"`
	}
	if err := json.Unmarshal(b, &report); err != nil {
		return err
	}
	if report.Signatures == nil || len(*report.Signatures) != 0 {
		return errors.New("A selected disk contains a filesystem or partition table.")
	}
	return nil
}
