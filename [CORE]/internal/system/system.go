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
	Manufacturer string        `json:"manufacturer"`
	Model        string        `json:"model"`
	Kernel       string        `json:"kernel"`
	OSVersion    string        `json:"osVersion"`
	BuildDate    string        `json:"buildDate"`
	SSHStatus    string        `json:"sshStatus"`
	Hostname     string        `json:"hostname"`
	OS           string        `json:"os"`
	Arch         string        `json:"arch"`
	CPUs         int           `json:"cpus"`
	MemTotalMB   int           `json:"memTotalMB"`
	MemFreeMB    int           `json:"memFreeMB"`
	UptimeSec    float64       `json:"uptimeSec"`
	Load1        float64       `json:"load1"`
	DiskTotalB   uint64        `json:"diskTotalB"`
	DiskFreeB    uint64        `json:"diskFreeB"`
	Addresses    []string      `json:"addresses"`
	CPUCounters  *CPUTime      `json:"cpuCounters,omitempty"`
	Network      []NetworkInfo `json:"network,omitempty"`
}

func Read() Info {
	host, _ := os.Hostname()
	info := Info{Hostname: host, OS: goruntime.GOOS, Arch: goruntime.GOARCH, CPUs: goruntime.NumCPU()}
	readBoxFacts(&info, "/sys/class/dmi/id", "/proc", "/usr/lib/os-release")
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
	info.CPUCounters = readCPUTime("/proc/stat")
	info.Network = readNetwork("/proc/net/dev")
	return info
}

// Prefer IPv4 for home links; fall back to IPv6 on an IPv6-only network.
func addresses() []string {
	out := []string{}
	ipv6 := []string{}
	interfaces, err := net.Interfaces()
	if err != nil {
		return out
	}
	for _, iface := range interfaces {
		if !homeInterface(iface) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err != nil || !homeAddress(ip) {
				continue
			}
			if ip.To4() != nil {
				out = append(out, ip.String())
			} else {
				ipv6 = append(ipv6, ip.String())
			}
		}
	}
	if len(out) == 0 {
		return ipv6
	}
	return out
}

// Exclude container bridges and their virtual peers, not whole private ranges:
// a real home LAN can also use 172.16/12 or 10/8.
func homeInterface(iface net.Interface) bool {
	if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
		return false
	}
	for _, prefix := range []string{"docker", "br-", "veth", "virbr", "incus", "lxc", "lxd", "cni", "flannel", "podman"} {
		if strings.HasPrefix(iface.Name, prefix) {
			return false
		}
	}
	return true
}

func homeAddress(ip net.IP) bool {
	return ip.IsGlobalUnicast() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast()
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
