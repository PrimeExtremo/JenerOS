// Package catalog loads store app manifests ([SPEC]/app-manifest.md).
package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
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
	Version      string       `json:"version"`
	Category     string       `json:"category"`
	Icon         string       `json:"icon"`
	Tagline      string       `json:"tagline"`
	Arch         []string     `json:"arch"`
	Requirements Requirements `json:"requirements"`
	Services     []Service    `json:"services"`
	Web          Web          `json:"web"`
	Auth         Auth         `json:"auth"`
}

type Catalog struct {
	apps map[string]Manifest
}

// Load reads every <dir>/<id>/app.json. It lists directories instead of using
// filepath.Glob, because dir may contain "[...]" (e.g. "[STORE]"), which Glob
// would treat as a character class.
func Load(dir string) (*Catalog, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	c := &Catalog{apps: map[string]Manifest{}}
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
		c.apps[m.ID] = m
	}
	return c, nil
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
