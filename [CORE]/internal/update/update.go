// Package update reports the installed JenerOS version and asks the system to
// update itself. jenerd never runs the update: it creates a request file that a
// root-owned systemd path unit (jeneros-update.path) acts on, and reads the
// status files that /usr/lib/jeneros/update writes.
package update

import (
	"bufio"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Paths are overridable for tests.
type Paths struct {
	OSRelease string // /usr/lib/os-release
	StatusDir string // /run/jeneros-update (written by the update script)
	Request   string // /run/jeneros/update.request (watched by jeneros-update.path)
	Check     string // /run/jeneros/check.request (watched by jeneros-update-check.path)
}

var DefaultPaths = Paths{
	OSRelease: "/usr/lib/os-release",
	StatusDir: "/run/jeneros-update",
	Request:   "/run/jeneros/update.request",
	Check:     "/run/jeneros/check.request",
}

type Info struct {
	Current   string          `json:"current"`
	Available json.RawMessage `json:"available,omitempty"`
	Status    json.RawMessage `json:"status,omitempty"`
	Requested bool            `json:"requested"`
}

func Read(p Paths) (Info, error) {
	cur, err := imageVersion(p.OSRelease)
	if err != nil {
		return Info{}, err
	}
	info := Info{Current: cur}
	if info.Available, err = readJSON(filepath.Join(p.StatusDir, "available.json")); err != nil {
		return Info{}, err
	}
	if info.Status, err = readJSON(filepath.Join(p.StatusDir, "status.json")); err != nil {
		return Info{}, err
	}
	_, err = os.Stat(p.Request)
	info.Requested = err == nil
	return info, nil
}

// Request asks the system to download and install the newest version.
func Request(p Paths) error {
	return os.WriteFile(p.Request, nil, 0o644)
}

// RequestCheck asks the system to look for a new version now.
func RequestCheck(p Paths) error {
	return os.WriteFile(p.Check, nil, 0o644)
}

func imageVersion(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if v, ok := strings.CutPrefix(s.Text(), "IMAGE_VERSION="); ok {
			return strings.Trim(v, `"`), nil
		}
	}
	return "", s.Err()
}

// readJSON returns nil when the file doesn't exist yet or isn't valid JSON.
func readJSON(path string) (json.RawMessage, error) {
	b, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !json.Valid(b) {
		return nil, nil
	}
	return json.RawMessage(b), nil
}
