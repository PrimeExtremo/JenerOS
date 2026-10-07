// Package system reports facts about the machine JenerOS runs on.
package system

import (
	"bufio"
	"os"
	goruntime "runtime"
	"strconv"
	"strings"
)

type Info struct {
	Hostname   string  `json:"hostname"`
	OS         string  `json:"os"`
	Arch       string  `json:"arch"`
	CPUs       int     `json:"cpus"`
	MemTotalMB int     `json:"memTotalMB"`
	MemFreeMB  int     `json:"memFreeMB"`
	UptimeSec  float64 `json:"uptimeSec"`
}

func Read() Info {
	host, _ := os.Hostname()
	info := Info{Hostname: host, OS: goruntime.GOOS, Arch: goruntime.GOARCH, CPUs: goruntime.NumCPU()}
	info.MemTotalMB, info.MemFreeMB = meminfo()
	if b, err := os.ReadFile("/proc/uptime"); err == nil {
		if f := strings.Fields(string(b)); len(f) > 0 {
			info.UptimeSec, _ = strconv.ParseFloat(f[0], 64)
		}
	}
	return info
}

// meminfo parses /proc/meminfo; it returns zeros off Linux.
func meminfo() (total, avail int) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		fields := strings.Fields(s.Text())
		if len(fields) < 2 {
			continue
		}
		kb, _ := strconv.Atoi(fields[1])
		switch fields[0] {
		case "MemTotal:":
			total = kb / 1024
		case "MemAvailable:":
			avail = kb / 1024
		}
	}
	return total, avail
}
