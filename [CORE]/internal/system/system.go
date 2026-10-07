// Package system reports facts about the machine JenerOS runs on.
package system

import (
	"bufio"
	"net"
	"os"
	goruntime "runtime"
	"strconv"
	"strings"
	"syscall"
)

type Info struct {
	Hostname   string  `json:"hostname"`
	OS         string  `json:"os"`
	Arch       string  `json:"arch"`
	CPUs       int     `json:"cpus"`
	MemTotalMB int     `json:"memTotalMB"`
	MemFreeMB  int     `json:"memFreeMB"`
	UptimeSec  float64 `json:"uptimeSec"`
	Load1      float64 `json:"load1"`
	DiskTotalB uint64  `json:"diskTotalB"`
	DiskFreeB  uint64  `json:"diskFreeB"`
	Addresses  []string `json:"addresses"`
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
	if b, err := os.ReadFile("/proc/loadavg"); err == nil {
		if f := strings.Fields(string(b)); len(f) > 0 {
			info.Load1, _ = strconv.ParseFloat(f[0], 64)
		}
	}
	// ponytail: root filesystem only; per-pool numbers arrive with storage pools (M3).
	var st syscall.Statfs_t
	if syscall.Statfs("/", &st) == nil {
		info.DiskTotalB = st.Blocks * uint64(st.Bsize)
		info.DiskFreeB = st.Bavail * uint64(st.Bsize)
	}
	info.Addresses = addresses()
	return info
}

// addresses returns the box's IPv4 addresses, skipping loopback.
func addresses() []string {
	out := []string{}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return out
	}
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && !ipn.IP.IsLoopback() && ipn.IP.To4() != nil {
			out = append(out, ipn.IP.String())
		}
	}
	return out
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
