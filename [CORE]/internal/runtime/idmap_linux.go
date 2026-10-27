package runtime

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// Prepare supplies the package's user-namespace setup on A/B upgrades too.
// Package postinst scripts run during image creation, not when /usr is updated.
func Prepare(_ Paths) error {
	if os.Geteuid() != 0 {
		return errors.New("App engine preparation requires root.")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	for _, kind := range []string{"uid", "gid"} {
		b, err := os.ReadFile("/etc/sub" + kind)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		allocation, err := idmapAllocation(string(b))
		if err != nil {
			return err
		}
		if allocation == "" {
			continue
		}
		// usermod locks and updates the account files. Existing allocations are
		// kept; the new range starts after all recorded users' ranges.
		cmd := exec.CommandContext(ctx, "/usr/sbin/usermod", "--add-sub"+kind+"s", allocation, "root")
		cmd.Env = []string{"PATH=/usr/sbin:/usr/bin", "LC_ALL=C"}
		if err := cmd.Run(); err != nil {
			return errors.New("Could not prepare app user namespaces. Check the root subordinate ID ranges.")
		}
	}
	return nil
}

func idmapAllocation(data string) (string, error) {
	next := uint64(1000000)
	found := false
	const count = uint64(1000000000)
	const limit = uint64(1<<32 - 1)
	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, ":")
		if len(fields) != 3 || fields[0] == "" {
			return "", errors.New("Invalid subordinate ID file.")
		}
		start, e1 := strconv.ParseUint(fields[1], 10, 32)
		size, e2 := strconv.ParseUint(fields[2], 10, 32)
		if e1 != nil || e2 != nil || size == 0 || start+size > limit {
			return "", errors.New("Invalid subordinate ID range.")
		}
		if (fields[0] == "root" || fields[0] == "0") && size >= 65536 {
			found = true
		}
		if start+size > next {
			next = start + size
		}
	}
	if found {
		return "", nil
	}
	if next+count > limit {
		return "", errors.New("No free subordinate ID range for apps.")
	}
	return fmt.Sprintf("%d-%d", next, next+count-1), nil
}
