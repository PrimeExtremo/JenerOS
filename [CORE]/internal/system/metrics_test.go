package system

import "testing"

func TestCPUTime(t *testing.T) {
	for _, tc := range []struct {
		name string
		data string
		want *CPUTime
	}{
		{"normal excludes guest", "cpu 100 10 20 500 50 5 15 0 40 2\ncpu0 1 2 3 4", &CPUTime{700, 550}},
		{"old kernel", "cpu 10 0 5 85\n", &CPUTime{100, 85}},
		{"empty", "", nil},
		{"per core only", "cpu0 1 2 3 4", nil},
		{"truncated", "cpu 1 2 3", nil},
		{"invalid", "cpu 1 no 3 4", nil},
		{"negative", "cpu 1 2 3 -4", nil},
		{"overflow", "cpu 18446744073709551615 1 0 0", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := parseCPUTime(tc.data)
			if tc.want == nil {
				if got != nil {
					t.Fatalf("got %+v, want unavailable", got)
				}
			} else if got == nil || *got != *tc.want {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestNetworkCounters(t *testing.T) {
	data := "Inter-| Receive | Transmit\n  eth0: 100 2 0 0 0 0 0 0 80 2 0 0 0 0 0 0\n wlan0: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n bad0: nope 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0\n bad1: 1 2\n bad2: -1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0"
	got := parseNetworkCounters(data)
	if len(got) != 2 || got["eth0"] != [2]uint64{100, 80} || got["wlan0"] != [2]uint64{0, 0} {
		t.Fatalf("unexpected counters: %v", got)
	}
}
