package catalog

import (
	"errors"
	"fmt"
	"path"
	"regexp"
	"strings"
)

var token = regexp.MustCompile(`^[a-z][a-z0-9-]{0,23}$`)
var envKey = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,63}$`)
var imageRef = regexp.MustCompile(`^(docker.io|ghcr.io)/[a-z0-9][a-z0-9._/-]*(:[a-zA-Z0-9][a-zA-Z0-9._-]*)?(@sha256:[a-f0-9]{64})?$`)
var variable = regexp.MustCompile(`\$\{([^}]+)\}`)

// ValidateRuntime is deliberately narrower than the future store format.
// Only reviewed OCI manifests are executable; host networking/devices and SSO
// are not silently accepted before their implementations exist.
func ValidateRuntime(m Manifest) error {
	if err := check(m); err != nil {
		return err
	}
	if m.Manifest != 1 || !m.Available || !token.MatchString(m.ID) || len(m.ID) > 12 || len(m.Services) == 0 || len(m.Services) > 8 {
		return errors.New("This app is not ready to install.")
	}
	for _, s := range []string{m.Name, m.Version, m.Developer, m.Tagline, m.Upstream} {
		if s == "" || len(s) > 256 || strings.ContainsAny(s, "\x00\r\n") {
			return errors.New("Invalid app details.")
		}
	}
	if len(m.Description) > 16384 || len(m.WhatsNew) > 8192 || len(m.Screenshots) > 20 || !token.MatchString(m.Icon) || m.Auth.Type != "none" {
		return errors.New("Unsupported app details or sign-in method.")
	}
	if len(m.Arch) == 0 || len(m.Arch) > 2 || m.Requirements.MemoryMB < 1 || m.Requirements.MemoryMB > 1048576 || m.Requirements.DiskGB < 1 || m.Requirements.DiskGB > 1048576 {
		return errors.New("Invalid app requirements.")
	}
	for _, arch := range m.Arch {
		if arch != "amd64" && arch != "arm64" {
			return errors.New("Unsupported app architecture.")
		}
	}
	names := map[string]bool{}
	for _, s := range m.Services {
		if !token.MatchString(s.Name) || names[s.Name] {
			return errors.New("Invalid or repeated service name.")
		}
		names[s.Name] = true
	}
	if !names[m.Web.Service] || m.Web.Port < 1 || m.Web.Port > 65535 || m.Web.Host < 1024 || m.Web.Host > 65535 || m.Web.Host == 8080 || m.Web.Host == 8443 {
		return errors.New("Invalid app web port.")
	}
	volumes := map[string]bool{}
	for _, s := range m.Services {
		if !imageRef.MatchString(s.Image) || strings.Contains(s.Image, "..") || len(s.Image) > 256 {
			return errors.New("Use a pinned image from a supported registry.")
		}
		if !strings.Contains(s.Image, "@sha256:") {
			tag := s.Image[strings.LastIndex(s.Image, ":")+1:]
			if !regexp.MustCompile(`^v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9._-]+)?$`).MatchString(tag) {
				return errors.New("Use an exact image version.")
			}
		}
		if s.Network != "" || len(s.Devices) != 0 || len(s.Ports) != 0 || len(s.Env) > 64 || len(s.Mounts) > 16 {
			return errors.New("Unsupported service options.")
		}
		if s.Health.Port < 1 || s.Health.Port > 65535 || len(s.Health.Path) > 256 || (s.Health.Path != "" && (!strings.HasPrefix(s.Health.Path, "/") || strings.ContainsAny(s.Health.Path, "\r\n?#"))) {
			return errors.New("Invalid health check.")
		}
		for k, v := range s.Env {
			if !envKey.MatchString(k) || len(v) > 4096 || strings.ContainsAny(v, "\x00\r\n") {
				return errors.New("Invalid app setting.")
			}
			for _, match := range variable.FindAllStringSubmatch(v, -1) {
				parts := strings.Split(match[1], ".")
				if len(parts) == 2 && parts[0] == "secret" && token.MatchString(parts[1]) {
					continue
				}
				if len(parts) == 3 && parts[0] == "service" && names[parts[1]] && parts[2] == "host" {
					continue
				}
				return fmt.Errorf("Unknown variable in %s.", k)
			}
			if strings.Contains(variable.ReplaceAllString(v, ""), "$") {
				return errors.New("Invalid app variable.")
			}
		}
		paths := map[string]bool{}
		for _, mount := range s.Mounts {
			if !token.MatchString(mount.Pool) || !strings.HasPrefix(mount.Path, "/") || path.Clean(mount.Path) != mount.Path || strings.ContainsAny(mount.Path, "\x00\r\n\\") || len(mount.Path) > 256 || paths[mount.Path] {
				return errors.New("Invalid app folder.")
			}
			for _, denied := range []string{"/", "/proc", "/sys", "/dev", "/etc", "/run"} {
				if mount.Path == denied || strings.HasPrefix(mount.Path, denied+"/") {
					return errors.New("App folder overlaps a system folder.")
				}
			}
			paths[mount.Path], volumes[mount.Pool] = true, true
		}
	}
	for _, s := range m.Backup.Services {
		if !names[s] {
			return errors.New("Unknown backup service.")
		}
	}
	for _, p := range m.Backup.Pools {
		if !volumes[p] {
			return errors.New("Unknown backup folder.")
		}
	}
	return nil
}
