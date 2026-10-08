package system

import (
	"net"
	"testing"
)

func TestHomeAddresses(t *testing.T) {
	for _, tc := range []struct {
		address string
		want    bool
	}{
		{"192.168.1.20", true},
		{"172.17.1.20", true}, // A home LAN may use Docker's common range.
		{"10.0.0.20", true},
		{"fd12::20", true},
		{"2001:db8::20", true},
		{"127.0.0.1", false},
		{"::1", false},
		{"169.254.10.20", false},
		{"fe80::20", false},
		{"0.0.0.0", false},
		{"224.0.0.1", false},
		{"invalid", false},
	} {
		t.Run(tc.address, func(t *testing.T) {
			if got := homeAddress(net.ParseIP(tc.address)); got != tc.want {
				t.Errorf("homeAddress(%q) = %v, want %v", tc.address, got, tc.want)
			}
		})
	}
}

func TestHomeInterfaces(t *testing.T) {
	for _, name := range []string{"eth0", "enp2s0", "wlan0", "br0"} {
		if !homeInterface(net.Interface{Name: name, Flags: net.FlagUp}) {
			t.Errorf("home interface %q was excluded", name)
		}
	}
	for _, name := range []string{"docker0", "br-123abc", "veth123", "virbr0", "incusbr0", "lxcbr0", "lxdbr0", "cni0", "flannel.1", "podman0"} {
		if homeInterface(net.Interface{Name: name, Flags: net.FlagUp}) {
			t.Errorf("container interface %q was included", name)
		}
	}
	if homeInterface(net.Interface{Name: "eth0"}) {
		t.Error("down interface was included")
	}
	if homeInterface(net.Interface{Name: "lo", Flags: net.FlagUp | net.FlagLoopback}) {
		t.Error("loopback interface was included")
	}
}
