package runtime

import "testing"

func TestIDMapPreservesExistingRanges(t *testing.T) {
	for _, tc := range []struct{ data, want string }{
		{"", "1000000-1000999999"},
		{"owner:100000:65536\n", "1000000-1000999999"},
		{"owner:2000000:65536\n", "2065536-1002065535"},
		{"root:1000000:65536\n", ""},
		{"0:1000000:65536\n", ""},
		{"# comment\nroot:1000000:1000000000\nowner:100000:65536\n", ""},
	} {
		got, err := idmapAllocation(tc.data)
		if err != nil || got != tc.want {
			t.Errorf("idmapAllocation(%q) = %q, %v; want %q", tc.data, got, err, tc.want)
		}
	}
	for _, data := range []string{"owner:bad:65536", "owner:1:0", "owner:1", ":1:65536", "owner:4294967290:65536", "owner:4000000000:65536"} {
		if _, err := idmapAllocation(data); err == nil {
			t.Errorf("unsafe ID allocation accepted: %q", data)
		}
	}
}
