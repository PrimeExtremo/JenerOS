// Package access queues developer-access changes for a separate root service.
package access

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

type Paths struct {
	Request   string
	Status    string
	SetupDone string
	Helper    string
	DevKey    string
}

var DefaultPaths = Paths{
	Request: "/run/jeneros/ssh.request", Status: "/run/jeneros-ssh/status.json",
	SetupDone: "/var/lib/jeneros/setup-done", Helper: "/usr/lib/jeneros/ssh-access",
	DevKey: "/usr/share/jeneros/dev/authorized_keys",
}

var ErrBusy = errors.New("Developer access is already changing. Please wait.")
var ErrUnavailable = errors.New("Developer access can be changed after setup on an updated JenerOS box.")
var ErrDevMode = errors.New("This development image keeps SSH on for testing.")

type Status struct {
	State   string `json:"state"`
	Message string `json:"message"`
}

type Info struct {
	Available bool   `json:"available"`
	DevMode   bool   `json:"devMode"`
	Requested bool   `json:"requested"`
	Status    Status `json:"status"`
}

func exists(path string) (bool, error) {
	_, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return err == nil, err
}

func Read(p Paths) (Info, error) {
	var info Info
	done, err := exists(p.SetupDone)
	if err != nil {
		return info, err
	}
	helper, err := exists(p.Helper)
	if err != nil {
		return info, err
	}
	info.Available = done && helper
	info.DevMode, err = exists(p.DevKey)
	if err != nil {
		return info, err
	}
	info.Requested, err = exists(p.Request)
	if err != nil {
		return info, err
	}
	b, err := os.ReadFile(p.Status)
	if errors.Is(err, os.ErrNotExist) {
		return info, nil
	}
	if err != nil {
		return info, err
	}
	err = json.Unmarshal(b, &info.Status)
	return info, err
}

func Request(p Paths, enabled bool) error {
	info, err := Read(p)
	if err != nil {
		return err
	}
	if !info.Available {
		return ErrUnavailable
	}
	if info.DevMode {
		return ErrDevMode
	}
	if info.Requested || info.Status.State == "applying" {
		return ErrBusy
	}
	// Publish complete content atomically. PathExists must not wake the root
	// helper while the unprivileged daemon is still writing the request.
	f, err := os.CreateTemp(filepath.Dir(p.Request), ".ssh-request-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	action := "disable\n"
	if enabled {
		action = "enable\n"
	}
	if _, err := f.WriteString(action); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Link(f.Name(), p.Request); err != nil {
		if errors.Is(err, os.ErrExist) {
			return ErrBusy
		}
		return err
	}
	return nil
}
