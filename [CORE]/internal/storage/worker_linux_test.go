package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// All disk/command operations are fake. These tests need neither root nor disks.
func TestWorker(t *testing.T) {
	for _, scenario := range []string{"success", "disk-changed", "signature", "format-failed"} {
		t.Run(scenario, func(t *testing.T) {
			dir := t.TempDir()
			p := Paths{Request: filepath.Join(dir, "request"), Status: filepath.Join(dir, "status.json"), SetupDone: filepath.Join(dir, "done"), Pools: filepath.Join(dir, "pools"), Records: filepath.Join(dir, "records"), Units: filepath.Join(dir, "units")}
			if err := os.Mkdir(p.Units, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(p.SetupDone, nil, 0o644); err != nil {
				t.Fatal(err)
			}
			job := Job{Request: requestFor("raid1", 2), ID: strings.Repeat("a", 32)}
			if err := atomicJSON(p.Request, job); err != nil {
				t.Fatal(err)
			}
			var commands []string
			discoveries := 0
			ops := workerOps{
				discover: func(context.Context, Paths) ([]Disk, error) {
					discoveries++
					disks := testDisks()
					if scenario == "disk-changed" && discoveries > 1 {
						disks[0].Identity = "replacement"
					}
					return disks, nil
				},
				blank: func(context.Context, string) error {
					if scenario == "signature" {
						return errors.New("Disk contains data")
					}
					return nil
				},
				run: func(_ context.Context, program string, args ...string) ([]byte, error) {
					commands = append(commands, program+" "+strings.Join(args, " "))
					switch program {
					case "systemd-escape":
						return []byte("fixture.mount\n"), nil
					case "blkid":
						return []byte("12345678-abcd-abcd-abcd-123456789abc\n"), nil
					case "mkfs.btrfs":
						if scenario == "format-failed" {
							return nil, errors.New("format failed")
						}
					}
					return nil, nil
				},
			}
			err := apply(p, ops)
			if (err == nil) != (scenario == "success") {
				t.Fatalf("unexpected worker result: %v", err)
			}
			if _, err := os.Stat(p.Request); !os.IsNotExist(err) {
				t.Fatal("request was not consumed")
			}
			info, err := Read(p)
			if err != nil {
				t.Fatal(err)
			}
			if scenario == "success" {
				if info.Status.State != "done" || info.Status.Percent != 100 {
					t.Fatalf("unexpected status: %+v", info.Status)
				}
				joined := strings.Join(commands, "\n")
				if !strings.Contains(joined, "mkfs.btrfs -d raid1 -m raid1 -L family-files /dev/sdb /dev/sdc") {
					t.Fatal(joined)
				}
				if discoveries != 4 || strings.Count(joined, "wipefs --all") != 2 {
					t.Fatal("missing fresh disk checks")
				}
				unit, err := os.ReadFile(filepath.Join(p.Units, "fixture.mount"))
				if err != nil || !strings.Contains(string(unit), "What=/dev/disk/by-uuid/12345678-abcd-abcd-abcd-123456789abc") || !strings.Contains(string(unit), "WantedBy=local-fs.target") {
					t.Fatal("persistent UUID mount missing", err)
				}
				for _, folder := range []string{"Photos", "Files", "Media", "Backups", ".jeneros"} {
					if _, err := os.Stat(filepath.Join(p.Pools, job.Name, folder)); err != nil {
						t.Fatal(err)
					}
				}
			} else {
				if info.Status.State != "failed" {
					t.Fatalf("unexpected status: %+v", info.Status)
				}
				for _, command := range commands {
					if scenario != "format-failed" && (strings.HasPrefix(command, "wipefs ") || strings.HasPrefix(command, "mkfs.btrfs ")) {
						t.Fatal("unsafe command: " + command)
					}
					if strings.HasPrefix(command, "systemctl start") {
						t.Fatal("mounted a failed pool")
					}
				}
			}
		})
	}
}
