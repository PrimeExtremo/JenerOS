# Phase 1 — Bootable JenerOS

Goal: a JenerOS image that installs on a PC (and later a Pi), boots to a working dashboard,
updates itself safely, and can be rolled back.

Owners: **J** = Jener, **C** = Claude, **X** = Codex/ChatGPT.
Tick a box only when its **Done when** check really passed. Log every change in `[DOCS]/AI-UPDATES.md`.

---

## Milestone 1 — Boots in a VM

| # | Task | Owner | Done when |
|---|---|---|---|
| 0a | [ ] Remove WSL (it needs the Windows hypervisor, which slows VMware): admin PowerShell → `wsl --uninstall`, `dism /online /disable-feature /featurename:VirtualMachinePlatform /norestart`, reboot | J | `wsl --status` errors / not found |
| 0b | [x] Build VM: Debian 13 netinst in VMware at `S:\[VMs]\[JENEROS-BUILD]` (4 vCPU, 8 GB, 80 GB, NAT), SSH server, passwordless sudo, Claude's SSH key added | J + C | `ssh jeneros-build uname -a` works from Windows |
| 1 | [x] Copy repo into the build VM (`~/jeneros`), run `[OS]/setup-build-vm.sh` (mkosi, Go, qemu-utils) | C | `mkosi --version` and `go version` print |
| 2 | [x] First compile of `jenerd`; fix any Go errors | C | `go build ./...` and `go vet ./...` pass in `[CORE]/` |
| 3 | [x] Run `jenerd` in the build VM against real data | C | `curl localhost:8080/api/system` returns JSON with real memory numbers |
| 4 | [x] First `[OS]/build.sh`; fix mkosi errors | C | `[OS]/out/jeneros_0.1.0.raw` exists and `S:\[VMs]\[JENEROS]\jeneros.vmdk` is written |
| 5 | [x] Boot `S:\[VMs]\[JENEROS]\jeneros.vmx` in VMware Workstation | J | Console shows "JenerOS 0.1.0" and `Dashboard: http://<ip>` |
| 6 | [x] Open the dashboard from Windows | J + C | Dashboard loads from the VM with **real** hostname/memory (no "sample data" note) |
| 7 | [ ] Review the first working build | X | Review notes logged in AI-UPDATES.md |

Known gaps to accept for M1: root partition doesn't grow to the 32 GB disk yet; console autologin is on (dev only); no SSH login (no password set).

## Milestone 2 — Safe updates (A/B + rollback)

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | [ ] Partition layout in `[OS]/mkosi.repart/`: ESP (1 GB), `usr-A` + verity, `usr-B` (empty), writable root/`var` that grows to fill the disk | C | `lsblk` in the VM shows the layout; root fills the disk |
| 2 | [ ] Read-only `/usr` (erofs + dm-verity), state in `/etc` + `/var` | C | Writing to `/usr` fails; `/etc` changes survive reboot |
| 3 | [ ] Unified kernel images + systemd-boot boot counting (`+3` tries) | C | `bootctl list` shows the entry with a tries counter |
| 4 | [ ] `systemd-sysupdate` transfer files for `usr` + UKI; local update server = a folder served by `jenerd` or a static HTTP server | C | Build 0.1.1, run `systemd-sysupdate update`, reboot → `/usr/lib/os-release` says 0.1.1 |
| 5 | [ ] Rollback test: ship a deliberately broken 0.1.2 | C + J | VM boots 0.1.2 three times, fails, comes back on 0.1.1 by itself |
| 6 | [ ] "Update" button + status in dashboard (calls jenerd → sysupdate) | C | Click → updates → reboot prompt |
| 7 | [ ] Review update + rollback design | X | Notes in AI-UPDATES.md |

## Milestone 3 — Storage, Incus, first-boot wizard

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | [ ] btrfs-progs, xfsprogs, mergerfs, snapraid, cryptsetup in the image; ZFS tools for **import only** | C | Pool created in the VM mounts on a plain Ubuntu live USB with no extra software |
| 2 | [ ] Incus 7.0 LTS (Zabbly repo) in the image, preseeded storage pool + bridge | C | `incus launch images:debian/13 t1` and an OCI app container both start |
| 3 | [ ] jenerd: `/api/disks` (list disks, SMART basics), `/api/pool` (btrfs single/mirror/raid1c3/raid10, or simple disks + parity; never raid5/6) | C | Dashboard lists the VM's disks; both pool types create and survive a reboot |
| 3b | [ ] Plain folder layout (`Photos/ Files/ Media/ Backups/` + hidden `.jeneros/`); LUKS2 option with a recovery key shown once | C | Encrypted pool unlocks on Ubuntu with `cryptsetup` + the recovery key |
| 3c | [ ] `[DOCS]/LEAVING-JENEROS.md`: how to mount the disks on another Linux | C | Jener follows it on a live USB |
| 4 | [ ] First-boot wizard in dashboard: owner account (hashed password), device name, timezone, pick disks | C | Fresh VM → wizard → lands on home screen; wizard never shows again |
| 5 | [ ] Turn off console autologin; SSH key/password from wizard | C | Console asks for login; SSH works with wizard credentials |
| 6 | [ ] Go unit tests: `catalog.Load` (good + broken manifests), API handlers (`httptest`) | X | `go test ./...` passes |
| 7 | [ ] Manifest validator (`go run ./cmd/validate ../[STORE]/apps`) | X | Fails on a manifest missing `id`/`services`, passes on the 5 real ones |

## Milestone 4 — USB installer

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | [ ] The disk image boots from USB as a live system with an "Install to this PC" screen | C | Boots in VMware from the image attached as a second disk |
| 2 | [ ] Installer copies itself to the chosen internal disk (`systemd-repart --copy-from`), never touches other disks | C | VM with 2 blank disks: installs to the chosen one only |
| 3 | [ ] Flashing guide (Rufus / balenaEtcher) | C | `[DOCS]/INSTALL.md` exists and Jener follows it unaided |
| 4 | [ ] Install on a real spare PC | J | Real PC boots JenerOS from its own disk |

## Milestone 5 — Raspberry Pi 5 (arm64)

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | [ ] arm64 mkosi profile: Raspberry Pi kernel + firmware boot partition (Pi has no UEFI by default) | C | Image builds (cross-arch via qemu-user in the build VM) |
| 2 | [ ] Same storage options on Pi (btrfs default) | C | First-boot wizard works on Pi |
| 3 | [ ] Boot on a real Pi 5 from SD or NVMe | J | Dashboard reachable from PrimePC |

---

## Side tasks (any time, good for Codex)
- [ ] Restyle the dashboard with the brand tokens in `[BRAND]/README.md` (arvey.co look, no Arvey name/logo). Owner: C or X.
- [ ] JENER wordmark + "J" monogram (SVG) in `[BRAND]/`. Owner: C with Jener's approval.
