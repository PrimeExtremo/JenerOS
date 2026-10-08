package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFilter(t *testing.T) {
	root := Block{Name: "sda", Type: "disk", Size: 20 * MinDiskBytes, Children: []Block{{Name: "sda1", Type: "part", Mountpoints: []string{"/"}}}}
	for _, tc := range []struct {
		name             string
		block            Block
		eligible, system bool
	}{
		{"empty", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes}, true, false},
		{"system", root, false, true},
		{"mounted", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, Mountpoints: []string{"/media/files"}}, false, false},
		{"swap", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, Mountpoints: []string{"[SWAP]"}}, false, false},
		{"filesystem", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, FSType: "btrfs"}, false, false},
		{"small", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes - 1}, false, false},
		{"partitioned", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, Children: []Block{{Name: "sdb1", Type: "part"}}}, false, false},
		{"device mapper system", Block{Name: "nvme0n1", Type: "disk", Size: MinDiskBytes, Children: []Block{{Name: "nvme0n1p1", Type: "part", Children: []Block{{Name: "dm-0", Type: "crypt", Mountpoints: []string{"/usr"}}}}}}, false, true},
		{"system var", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, Mountpoints: []string{"/var"}}, false, true},
		{"data pool is not system", Block{Name: "sdb", Type: "disk", Size: MinDiskBytes, Mountpoints: []string{"/var/lib/jeneros/pools/files"}}, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := Filter([]Block{root, tc.block})[1]
			if got.Eligible != tc.eligible || got.System != tc.system {
				t.Fatalf("unexpected disk: %+v", got)
			}
		})
	}
	if got := Filter([]Block{{Name: "sdb", Type: "disk", Size: MinDiskBytes}}); got[0].Eligible {
		t.Fatal("missing system mount must fail closed")
	}
	if got := Filter([]Block{root, {Name: "loop0", Type: "loop", Size: MinDiskBytes}, {Name: "sda1", Type: "part", Size: MinDiskBytes}}); len(got) != 1 {
		t.Fatal("offered a virtual device or partition")
	}
}

func testDisks() []Disk {
	return []Disk{
		{Path: "/dev/sdb", Size: MinDiskBytes, Eligible: true, Identity: "one"},
		{Path: "/dev/sdc", Size: MinDiskBytes, Eligible: true, Identity: "two"},
		{Path: "/dev/sdd", Size: MinDiskBytes, Eligible: true, Identity: "three"},
		{Path: "/dev/sde", Size: MinDiskBytes, Eligible: true, Identity: "four"},
	}
}

func TestSysBlockChecks(t *testing.T) {
	dir := t.TempDir()
	sys := filepath.Join(dir, "sdb")
	if err := os.MkdirAll(filepath.Join(sys, "holders"), 0o755); err != nil {
		t.Fatal(err)
	}
	for key, value := range map[string]string{"ro": "0\n", "dev": "8:16\n", "diskseq": "10\n"} {
		if err := os.WriteFile(filepath.Join(sys, key), []byte(value), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	first, err := inspect(testDisks()[:1], dir)
	if err != nil || !first[0].Eligible {
		t.Fatalf("empty sysfs fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sys, "diskseq"), []byte("11\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	second, err := inspect(testDisks()[:1], dir)
	if err != nil || first[0].Identity == second[0].Identity {
		t.Fatal("reattachment reused disk identity", err)
	}
	if err := os.WriteFile(filepath.Join(sys, "ro"), []byte("1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	disks, err := inspect(testDisks()[:1], dir)
	if err != nil || disks[0].Eligible {
		t.Fatal("offered a read-only disk", err)
	}
	if err := os.WriteFile(filepath.Join(sys, "ro"), []byte("0\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sys, "holders", "dm-0"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	disks, err = inspect(testDisks()[:1], dir)
	if err != nil || disks[0].Eligible {
		t.Fatal("offered a held disk", err)
	}
	if err := os.Remove(filepath.Join(sys, "holders", "dm-0")); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(sys, "sdb1"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sys, "sdb1", "partition"), []byte("1"), 0o644); err != nil {
		t.Fatal(err)
	}
	disks, err = inspect(testDisks()[:1], dir)
	if err != nil || disks[0].Eligible {
		t.Fatal("offered a partitioned disk", err)
	}
	if err := os.Remove(filepath.Join(sys, "diskseq")); err != nil {
		t.Fatal(err)
	}
	if _, err := inspect(testDisks()[:1], dir); err == nil {
		t.Fatal("missing identity must fail closed")
	}
}

func requestFor(profile string, count int) Request {
	r := Request{Name: "family-files", Profile: profile, Erase: true, Identities: map[string]string{}}
	for _, d := range testDisks()[:count] {
		r.Disks = append(r.Disks, d.Path)
		r.Identities[d.Path] = d.Identity
	}
	return r
}

func TestProfiles(t *testing.T) {
	for _, tc := range []struct {
		profile string
		count   int
		valid   bool
	}{
		{"single", 0, false}, {"single", 1, true}, {"single", 2, false},
		{"raid1", 1, false}, {"raid1", 2, true}, {"raid1", 3, true},
		{"raid10", 3, false}, {"raid10", 4, true}, {"raid5", 4, false}, {"raid6", 4, false}, {"raid0", 2, false}, {"", 1, false},
	} {
		if err := Validate(requestFor(tc.profile, tc.count), testDisks()); (err == nil) != tc.valid {
			t.Errorf("%s/%d: %v", tc.profile, tc.count, err)
		}
	}
}

func TestValidation(t *testing.T) {
	for _, mutate := range []func(*Request){
		func(r *Request) { r.Name = "../bad" }, func(r *Request) { r.Name = "A name" },
		func(r *Request) { r.Name = strings.Repeat("a", 33) }, func(r *Request) { r.Name = "-option" },
		func(r *Request) { r.Erase = false }, func(r *Request) { r.Disks[1] = r.Disks[0] },
		func(r *Request) { r.Disks[0] = "/dev/disk/by-id/something" }, func(r *Request) { r.Disks[0] = "/dev/sdb;reboot" },
		func(r *Request) { r.Identities["/dev/sdb"] = "swapped" }, func(r *Request) { r.Identities = nil },
	} {
		r := requestFor("raid1", 2)
		mutate(&r)
		if Validate(r, testDisks()) == nil {
			t.Fatalf("accepted invalid request: %+v", r)
		}
	}
	for _, mutate := range []func(*Disk){
		func(d *Disk) { d.System = true }, func(d *Disk) { d.Eligible = false }, func(d *Disk) { d.Size = 0 },
	} {
		disks := testDisks()
		mutate(&disks[0])
		if Validate(requestFor("raid1", 2), disks) == nil {
			t.Fatal("accepted a newly unsafe disk")
		}
	}
}

func TestDecode(t *testing.T) {
	for _, body := range []string{`{`, `{"name":"a","command":"erase-all"}`, `{} {}`, strings.Repeat(" ", 16385) + `{}`} {
		var r Request
		if Decode(strings.NewReader(body), &r) == nil {
			t.Fatalf("accepted %q", body[:1])
		}
	}
}

func TestQueue(t *testing.T) {
	dir := t.TempDir()
	p := Paths{Request: filepath.Join(dir, "storage.request"), Status: filepath.Join(dir, "status.json"), Helper: filepath.Join(dir, "helper"), SetupDone: filepath.Join(dir, "done"), Pools: filepath.Join(dir, "pools"), Records: filepath.Join(dir, "records")}
	r := requestFor("raid1", 2)
	if _, err := Queue(p, r, testDisks()); err != ErrUnavailable {
		t.Fatalf("without setup: %v", err)
	}
	for _, file := range []string{p.Helper, p.SetupDone} {
		if err := os.WriteFile(file, nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	job, err := Queue(p, r, testDisks())
	if err != nil {
		t.Fatal(err)
	}
	if len(job.ID) != 32 {
		t.Fatal("missing request ID")
	}
	st, err := os.Stat(p.Request)
	if err != nil || st.Mode().Perm() != 0o600 {
		t.Fatal("request must be private")
	}
	if _, err := Queue(p, r, testDisks()); err != ErrBusy {
		t.Fatalf("duplicate request: %v", err)
	}
	info, err := Read(p)
	if err != nil || !info.Requested || info.Status.ID != job.ID || info.Status.State != "queued" {
		t.Fatalf("queued status: %+v %v", info, err)
	}
	if err := atomicJSON(p.Status, Status{ID: "older", State: "done"}); err != nil {
		t.Fatal(err)
	}
	info, err = Read(p)
	if err != nil || info.Status.State != "queued" {
		t.Fatal("old success hid the new request")
	}
	if err := os.Remove(p.Request); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(p.Pools, r.Name), 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := Queue(p, r, testDisks()); err == nil {
		t.Fatal("reused a pool name")
	}
	if err := atomicJSON(p.Status, Status{ID: job.ID, State: "working"}); err != nil {
		t.Fatal(err)
	}
	r.Name = "other"
	if _, err := Queue(p, r, testDisks()); err != ErrBusy {
		t.Fatalf("working status must block new requests: %v", err)
	}
	// Worker JSON uses the exact same strict schema plus its private job ID.
	b, err := json.Marshal(job)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Job
	if err := Decode(strings.NewReader(string(b)), &decoded); err != nil {
		t.Fatal(err)
	}
}
