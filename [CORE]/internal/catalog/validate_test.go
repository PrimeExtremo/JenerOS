package catalog

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func executable(t *testing.T) Manifest {
	t.Helper()
	c, err := Load(filepath.Join("..", "..", "..", "[STORE]", "apps"))
	if err != nil {
		t.Fatal(err)
	}
	m, _ := c.Get("photos")
	return m
}

func TestRuntimeManifests(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "..", "[STORE]", "apps"))
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	ports := map[int]bool{}
	for _, m := range c.Apps() {
		if !m.Available {
			continue
		}
		count++
		if err := ValidateRuntime(m); err != nil {
			t.Errorf("%s: %v", m.ID, err)
		}
		if ports[m.Web.Host] {
			t.Fatal("duplicate LAN ports")
		}
		ports[m.Web.Host] = true
	}
	if count != 4 {
		t.Fatalf("got %d runnable apps", count)
	}
}

func TestRuntimeRejectsUnsafeManifest(t *testing.T) {
	base, _ := json.Marshal(executable(t))
	cases := map[string]func(*Manifest){
		"future schema":      func(m *Manifest) { m.Manifest = 2 },
		"coming soon":        func(m *Manifest) { m.Available = false },
		"traversal id":       func(m *Manifest) { m.ID = "../app" },
		"floating image":     func(m *Manifest) { m.Services[0].Image = "docker.io/library/postgres:latest" },
		"untrusted registry": func(m *Manifest) { m.Services[0].Image = "127.0.0.1/x:1.2.3" },
		"option image":       func(m *Manifest) { m.Services[0].Image = "--privileged" },
		"duplicate service":  func(m *Manifest) { m.Services[1].Name = m.Services[0].Name },
		"unknown reference":  func(m *Manifest) { m.Services[0].Env["TEST"] = "${service.missing.host}" },
		"unknown variable":   func(m *Manifest) { m.Services[0].Env["TEST"] = "${oidc.clientSecret}" },
		"bad secret":         func(m *Manifest) { m.Services[0].Env["TEST"] = "${secret.../x}" },
		"malformed variable": func(m *Manifest) { m.Services[0].Env["TEST"] = "${secret.x" },
		"env newline":        func(m *Manifest) { m.Services[0].Env["TEST"] = "a\nb" },
		"env key":            func(m *Manifest) { m.Services[0].Env["bad key"] = "x" },
		"host networking":    func(m *Manifest) { m.Services[0].Network = "host" },
		"host device":        func(m *Manifest) { m.Services[0].Devices = []string{"/dev/sda"} },
		"extra port":         func(m *Manifest) { m.Services[0].Ports = []Port{{Host: 22}} },
		"folder escape":      func(m *Manifest) { m.Services[0].Mounts[0].Pool = "../../etc" },
		"system mount":       func(m *Manifest) { m.Services[0].Mounts[0].Path = "/etc" },
		"unclean mount":      func(m *Manifest) { m.Services[0].Mounts[0].Path = "/data/../etc" },
		"web service":        func(m *Manifest) { m.Web.Service = "missing" },
		"reserved port":      func(m *Manifest) { m.Web.Host = 80 },
		"health URL":         func(m *Manifest) { m.Services[0].Health.Path = "http://other/" },
		"bad arch":           func(m *Manifest) { m.Arch = []string{"unknown"} },
		"bad backup":         func(m *Manifest) { m.Backup.Pools = []string{"missing"} },
		"pretend SSO":        func(m *Manifest) { m.Auth.Type = "oidc" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			var m Manifest
			if err := json.Unmarshal(base, &m); err != nil {
				t.Fatal(err)
			}
			change(&m)
			if err := ValidateRuntime(m); err == nil {
				t.Fatal("unsafe manifest accepted")
			}
		})
	}
}

func TestLoadRejectsUnknownAndTrailingFields(t *testing.T) {
	for _, body := range []string{`{"id":"tv","privileged":true,"services":[{"name":"s","image":"x"}]}`, `{"id":"tv","services":[{"name":"s","image":"x"}]} {}`} {
		dir := t.TempDir()
		writeApp(t, dir, "tv", body)
		if _, err := Load(dir); err == nil {
			t.Fatal("unexpected manifest input accepted")
		}
	}
}
