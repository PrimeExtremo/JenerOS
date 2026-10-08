package system

import (
	"net"
	"os"
	"strconv"
	"strings"
)

// These are cumulative counters. The dashboard takes differences between
// polls; keeping Read stateless also keeps concurrent API requests independent.
type CPUTime struct {
	Total uint64 `json:"total"`
	Idle  uint64 `json:"idle"`
}

type NetworkInfo struct {
	Name      string   `json:"name"`
	Addresses []string `json:"addresses"`
	RXBytes   *uint64  `json:"rxBytes,omitempty"`
	TXBytes   *uint64  `json:"txBytes,omitempty"`
}

func readCPUTime(path string) *CPUTime {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	return parseCPUTime(string(b))
}

func parseCPUTime(data string) *CPUTime {
	line, _, _ := strings.Cut(data, "\n")
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return nil
	}
	times := make([]uint64, 8)
	for i := 1; i < len(fields) && i <= 8; i++ {
		value, err := strconv.ParseUint(fields[i], 10, 64)
		if err != nil {
			return nil
		}
		times[i-1] = value
	}
	// guest/guest_nice are already included in user/nice. Count only the
	// first eight fields. Treat I/O wait as idle; decreasing counters are
	// rejected by the dashboard and establish a fresh baseline.
	var total uint64
	for _, value := range times {
		if ^uint64(0)-total < value {
			return nil
		}
		total += value
	}
	return &CPUTime{Total: total, Idle: times[3] + times[4]}
}

func parseNetworkCounters(data string) map[string][2]uint64 {
	out := make(map[string][2]uint64)
	for _, line := range strings.Split(data, "\n") {
		name, values, ok := strings.Cut(line, ":")
		fields := strings.Fields(values)
		if !ok || len(fields) != 16 {
			continue
		}
		rx, rxErr := strconv.ParseUint(fields[0], 10, 64)
		tx, txErr := strconv.ParseUint(fields[8], 10, 64)
		if rxErr == nil && txErr == nil {
			out[strings.TrimSpace(name)] = [2]uint64{rx, tx}
		}
	}
	return out
}

func readNetwork(path string) []NetworkInfo {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var counters map[string][2]uint64
	if b, err := os.ReadFile(path); err == nil {
		counters = parseNetworkCounters(string(b))
	}
	var out []NetworkInfo
	for _, iface := range interfaces {
		if !homeInterface(iface) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		row := NetworkInfo{Name: iface.Name, Addresses: []string{}}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && homeAddress(ip) {
				row.Addresses = append(row.Addresses, ip.String())
			}
		}
		if len(row.Addresses) == 0 {
			continue
		}
		if counts, ok := counters[iface.Name]; ok {
			rx, tx := counts[0], counts[1]
			row.RXBytes, row.TXBytes = &rx, &tx
		}
		out = append(out, row)
	}
	return out
}
