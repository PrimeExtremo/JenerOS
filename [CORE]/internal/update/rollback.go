package update

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

var ErrBusy = errors.New("Your box is already updating or restarting. Please wait.")

// RequestRollback has no target argument: the root helper selects the other
// installed JenerOS entry itself, never an entry provided over HTTP.
func RequestRollback(p Paths) error {
	if err := actionAvailable(p); err != nil {
		return err
	}
	f, err := os.OpenFile(p.Rollback, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if errors.Is(err, os.ErrExist) {
		return ErrBusy
	}
	if err != nil {
		return err
	}
	return f.Close()
}

func actionAvailable(p Paths) error {
	for _, file := range []string{p.Request, p.Rollback} {
		if file == "" {
			continue
		}
		if _, err := os.Stat(file); err == nil {
			return ErrBusy
		} else if !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	for _, name := range []string{"status.json", "rollback.json"} {
		b, err := readJSON(filepath.Join(p.StatusDir, name))
		if err != nil {
			return err
		}
		var state struct {
			State string `json:"state"`
		}
		if len(b) > 0 {
			if err := json.Unmarshal(b, &state); err != nil {
				return err
			}
			if state.State == "installing" || state.State == "rebooting" || state.State == "selecting" {
				return ErrBusy
			}
		}
	}
	return nil
}

type bootEntry struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Path      string `json:"path"`
	Selected  bool   `json:"isSelected"`
	TriesLeft *uint  `json:"triesLeft"`
}

// Bootctl emits normalized IDs without boot-count suffixes; path retains
// them. Require a known selected entry and exactly one other UKI (InstancesMax=2).
// An exhausted boot-count entry is deliberately excluded.
func OtherEntry(r io.Reader) (string, error) {
	var entries []bootEntry
	d := json.NewDecoder(io.LimitReader(r, 1<<20))
	if err := d.Decode(&entries); err != nil {
		return "", errors.New("Could not read the installed boot entries.")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return "", errors.New("Could not read the installed boot entries.")
	}
	selected := ""
	for _, e := range entries {
		if e.Selected {
			if selected != "" || !jenerosEntry(e) {
				return "", errors.New("Could not identify the running JenerOS slot.")
			}
			selected = e.ID
		}
	}
	if selected == "" {
		return "", errors.New("Could not identify the running JenerOS slot.")
	}
	target := ""
	for _, e := range entries {
		if e.ID == selected || !jenerosEntry(e) || (e.TriesLeft != nil && *e.TriesLeft == 0) {
			continue
		}
		if target != "" {
			return "", errors.New("More than one other JenerOS version is installed. No restart was requested.")
		}
		target = e.ID
	}
	if target == "" {
		return "", errors.New("There isn't another bootable JenerOS version on this box yet.")
	}
	return target, nil
}

var ukiID = regexp.MustCompile(`^jeneros_[A-Za-z0-9][A-Za-z0-9._-]*\.efi$`)
var ukiSource = regexp.MustCompile(`^jeneros_[A-Za-z0-9][A-Za-z0-9._-]*(\+[0-9]+(-[0-9]+)?)?\.efi$`)

func jenerosEntry(e bootEntry) bool {
	return e.Type == "type2" && ukiID.MatchString(e.ID) && ukiSource.MatchString(path.Base(e.Path)) && strings.Contains(e.Path, "/EFI/Linux/")
}
