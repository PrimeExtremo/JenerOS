// Package catalog loads store app manifests ([SPEC]/app-manifest.md).
package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

type Mount struct {
	Pool     string `json:"pool"`
	Path     string `json:"path"`
	ReadOnly bool   `json:"readOnly,omitempty"`
}

type Port struct {
	Host      int    `json:"host"`
	Container int    `json:"container"`
	Protocol  string `json:"protocol"`
}

type Service struct {
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Env     map[string]string `json:"env,omitempty"`
	Mounts  []Mount           `json:"mounts,omitempty"`
	Ports   []Port            `json:"ports,omitempty"`
	Devices []string          `json:"devices,omitempty"`
	Network string            `json:"network,omitempty"`
}

type Requirements struct {
	MemoryMB int `json:"memoryMB"`
	DiskGB   int `json:"diskGB"`
}

type Web struct {
	Service string `json:"service"`
	Port    int    `json:"port"`
}

type Auth struct {
	Type string `json:"type"`
}

type Manifest struct {
	Manifest     int          `json:"manifest"`
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Upstream     string       `json:"upstream"`
	Developer    string       `json:"developer,omitempty"`
	Version      string       `json:"version"`
	Added        string       `json:"added,omitempty"`
	Category     string       `json:"category"`
	Icon         string       `json:"icon"`
	Tagline      string       `json:"tagline"`
	Description  string       `json:"description,omitempty"`
	WhatsNew     string       `json:"whatsNew,omitempty"`
	Screenshots  []string     `json:"screenshots,omitempty"`
	Arch         []string     `json:"arch"`
	Requirements Requirements `json:"requirements"`
	Services     []Service    `json:"services"`
	Web          Web          `json:"web"`
	Auth         Auth         `json:"auth"`
}

// Categories are the store sidebar groups. An empty category is allowed and
// shows up under Discover and Search only.
var Categories = []string{"media", "photos", "files", "home", "network", "ai", "tools"}

// Screenshots are plain images inside the app folder. SVG is left out on
// purpose: served from the dashboard origin, it could run script.
var screenshotExt = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}

var appID = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)

type Catalog struct {
	apps map[string]Manifest
	dirs map[string]string
}

// Load reads every <dir>/<id>/app.json. It lists directories instead of using
// filepath.Glob, because dir may contain "[...]" (e.g. "[STORE]"), which Glob
// would treat as a character class.
func Load(dir string) (*Catalog, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	c := &Catalog{apps: map[string]Manifest{}, dirs: map[string]string{}}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		f := filepath.Join(dir, e.Name(), "app.json")
		b, err := os.ReadFile(f)
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		var m Manifest
		if err := json.Unmarshal(b, &m); err != nil {
			return nil, fmt.Errorf("%s: %w", f, err)
		}
		if m.ID == "" || len(m.Services) == 0 {
			return nil, fmt.Errorf("%s: id and services are required", f)
		}
		if err := check(m); err != nil {
			return nil, fmt.Errorf("%s: %w", f, err)
		}
		if _, dup := c.apps[m.ID]; dup {
			return nil, fmt.Errorf("%s: duplicate app id %q", f, m.ID)
		}
		c.apps[m.ID] = m
		c.dirs[m.ID] = filepath.Join(dir, e.Name())
	}
	return c, nil
}

// check validates the store-facing fields. Service fields are checked by the
// runtime when installs arrive.
func check(m Manifest) error {
	if !appID.MatchString(m.ID) {
		return fmt.Errorf("id %q must be lowercase letters, digits or dashes", m.ID)
	}
	if m.Category != "" && !contains(Categories, m.Category) {
		return fmt.Errorf("unknown category %q", m.Category)
	}
	if m.Added != "" {
		if _, err := time.Parse(time.DateOnly, m.Added); err != nil {
			return fmt.Errorf("added must be YYYY-MM-DD: %w", err)
		}
	}
	if m.Requirements.MemoryMB < 0 || m.Requirements.DiskGB < 0 {
		return errors.New("requirements must not be negative")
	}
	for _, s := range m.Screenshots {
		if !filepath.IsLocal(s) || strings.Contains(s, `\`) || !screenshotExt[strings.ToLower(filepath.Ext(s))] {
			return fmt.Errorf("screenshot %q must be a .png, .jpg or .webp file inside the app folder", s)
		}
	}
	return nil
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func (c *Catalog) Apps() []Manifest {
	out := make([]Manifest, 0, len(c.apps))
	for _, m := range c.apps {
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (c *Catalog) Get(id string) (Manifest, bool) {
	m, ok := c.apps[id]
	return m, ok
}

// Screenshot returns the file path of an app's n-th screenshot.
func (c *Catalog) Screenshot(id string, n int) (string, bool) {
	m, ok := c.apps[id]
	if !ok || n < 0 || n >= len(m.Screenshots) {
		return "", false
	}
	return filepath.Join(c.dirs[id], filepath.FromSlash(m.Screenshots[n])), true
}
