package system

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

// Missing DMI is normal on non-PC hardware. Empty facts let the screen show
// "Not available" rather than inventing a model or exposing file errors.
func readBoxFacts(info *Info, dmi, proc, release string) {
	info.Manufacturer = factFile(filepath.Join(dmi, "sys_vendor"))
	info.Model = factFile(filepath.Join(dmi, "product_name"))
	info.Kernel = factFile(filepath.Join(proc, "sys/kernel/osrelease"))
	values := releaseValues(release)
	info.OSVersion = values["IMAGE_VERSION"]
	if info.OSVersion == "" {
		info.OSVersion = values["VERSION_ID"]
	}
	info.BuildDate = values["BUILD_DATE"]
	info.SSHStatus = sshStatus(proc)
}

func cleanFact(value string) string {
	return strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, value))
}

func factFile(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return cleanFact(string(b))
}

// Read key/value data, never execute os-release as a shell script.
func releaseValues(path string) map[string]string {
	values := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return values
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		key, value, ok := strings.Cut(s.Text(), "=")
		if !ok || strings.HasPrefix(strings.TrimSpace(key), "#") {
			continue
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		values[strings.TrimSpace(key)] = cleanFact(value)
	}
	return values
}

// Detect the actual port-22 listener, including socket activation. Reading
// /proc needs no root helper or systemd subprocess. Unknown stays unknown.
func SSHStatus() string {
	return sshStatus("/proc")
}

func sshStatus(proc string) string {
	known := false
	for _, name := range []string{"tcp", "tcp6"} {
		b, err := os.ReadFile(filepath.Join(proc, "net", name))
		if err != nil {
			continue
		}
		known = true
		for _, line := range strings.Split(string(b), "\n") {
			fields := strings.Fields(line)
			if len(fields) > 3 && strings.HasSuffix(fields[1], ":0016") && fields[3] == "0A" {
				return "on"
			}
		}
	}
	if known {
		return "off"
	}
	return "unknown"
}
