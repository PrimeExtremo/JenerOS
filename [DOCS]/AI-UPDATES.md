# AI updates log

Every AI appends an entry here after a change (newest at the bottom).
Format: date · who · what changed · why · untested · what the other AI should check.

---

## 2026-10-07 · Claude · Project skeleton, OS plan, Phase 1 build files

**What changed**
- Created the repo at `C:\Users\jener\jeneros` (renamed Haven → ArveyOS → JenerOS during the session; old folders `haven` deleted, `C:\Users\jener\arveyos` is a stale copy Jener should delete).
- `[CORE]/`: `jenerd` Go daemon (stdlib only): `/api/system`, `/api/store`, `POST /api/apps/{id}/install` → 501, `DELETE /api/apps/{id}` → 501, serves dashboard. Module `github.com/PrimeExtremo/jeneros/core`.
- `[DASHBOARD]/`: static UI with sample-data fallback.
- `[STORE]/apps/`: photos (Immich), drive (Nextcloud), home (Home Assistant), tv (Jellyfin), relay (AdGuard Home).
- Applied Codex review: drive gets `POSTGRES_DB=nextcloud`, `POSTGRES_USER=postgres`; photos gets `IMMICH_MACHINE_LEARNING_URL=http://${service.ml.host}:3003`.
- `[OS]/`: mkosi config (Debian 13, amd64, systemd-boot, DHCP, SSH, jenerd on :80 via `DynamicUser` + `CAP_NET_BIND_SERVICE`), os-release branding, `/etc/issue` showing dashboard URL, `build.sh`, `setup-build-vm.sh`, VMware `.vmx` template.
- Docs: `handoff.md`, `AGENTS.md`, `CLAUDE.md`, `[DOCS]/PHASE-1.md`, `[DOCS]/OS-PLAN.md`, `[BRAND]/README.md`, `[CLIENTS]/README.md`.

**Why**: Jener asked for a full plan + handoffs before building so every AI knows the state.

**Untested**: `jenerd` has never been compiled (no Go on Windows). The mkosi image has never been built (no WSL yet). Dashboard was only checked with sample data.

**For Codex/ChatGPT to check**
- `[CORE]/` for compile errors or Go 1.22 mux misuse before Claude's first build.
- `[OS]/mkosi.conf` against current mkosi (Debian trixie ships mkosi 25.x): section/key names, `ToolsTree=default`, `ExtraTrees=build/staging:/`.
- `[OS]/build.sh`: paths with `[brackets]` under `/mnt/s/`, `qemu-img` vmdk options for VMware Workstation.
- Nothing is committed yet; review the working tree.

## 2026-10-07 · Claude · Folder style: top-level folders renamed to [BRACKET] names

**What changed**
- `brand clients core dashboard docs os spec store` → `[BRAND] [CLIENTS] [CORE] [DASHBOARD] [DOCS] [OS] [SPEC] [STORE]` (Jener's folder convention, same as arvey.co: only top-level folders are bracketed).
- Inner folders keep normal names on purpose: Go needs `cmd/`, `internal/`; mkosi needs `mkosi.extra/`, `mkosi.conf` and real Linux paths (`usr/lib/...`).
- Updated: `[OS]/build.sh` paths, `jenerd` default flags (`../[STORE]/apps`, `../[DASHBOARD]`), all doc links (encoded as `%5B…%5D` like arvey.co's README), `.gitignore`/`.gitattributes` (brackets escaped as `[[]OS]` because `[` is a glob character there — verified with `git check-ignore` / `git check-attr`).
- Go module path is unchanged (`github.com/PrimeExtremo/jeneros/core`); folder names don't affect imports.

**Untested**: still no compile/build (waiting on WSL).

**For Codex/ChatGPT to check**: any tool or script that assumes lowercase folder names. In bash, always quote paths containing `[...]`.

## 2026-10-07 · Claude · Research: how self-hosting OSes are built

**What changed**: new `[DOCS]/RESEARCH.md`. No code changes.

**Key finding**: IncusOS (lxc/incus-os, Apache-2.0) is built almost exactly like our plan: Debian 13 + mkosi + erofs/verity `/usr` + sysupdate A/B + sysext add-ons + seed partition, with Zabbly kernel/ZFS/Incus. Its `mkosi.repart/` and `mkosi.conf` are the best reference for Phase 1 M2–M3.

**Proposed plan changes (waiting on Jener)**: IncusOS-style partition layout in M2; Zabbly kernel+ZFS instead of zfs-dkms in M3; sysext "extensions"; seed partition; Secure Boot/TPM optional (IncusOS requires them, old PCs lack them); baseline x86-64 (IncusOS needs v3).

**For Codex/ChatGPT**: sanity-check the proposed changes in RESEARCH.md "What changes in our plan".

## 2026-10-07 · Claude · Storage decision: portable disks, ZFS is import-only

**Decision (Jener)**: data disks must stay usable by any other Linux without wiping. ZFS is out as the default (out-of-tree module, Debian contrib, not on Fedora).

**What changed**
- New `[DOCS]/STORAGE.md`: btrfs pools (single/raid1/raid1c3/raid10, **never raid5/6**), "simple disks" mode (ext4/XFS + mergerfs + SnapRAID), ZFS import-only, plain top-level folders (`Photos/ Files/ Media/ Backups/` + hidden `.jeneros/`), LUKS2 with mandatory recovery key, "leaving JenerOS" steps.
- Updated `handoff.md` (decision + new hard rule 6), `ARCHITECTURE.md`, `OS-PLAN.md`, `PHASE-1.md` M3 tasks (portability test on an Ubuntu live USB), `RESEARCH.md` (Zabbly ZFS item superseded).

**For Codex/ChatGPT**: when writing app manifests, user files must live in the shared pools (`photos`, `files`, `media`) as normal folders, not in opaque volumes.

## 2026-10-07 · Claude · WSL installed; nested virt removed from VM template

- Jener ran `wsl --install -d Debian` (WSL 3.0.1, VirtualMachinePlatform enabled). Reboot + Linux user creation pending.
- Removed `vhv.enable = "TRUE"` from `[OS]/vmware/jeneros.vmx`: with Hyper-V/VirtualMachinePlatform on, VMware Workstation can't expose VT-x to guests and the VM would refuse to power on. Nested virt is only needed for Incus VMs inside JenerOS (M3) — revisit then (test on real hardware instead, or a Linux host).

## 2026-10-07 · Claude · Build machine: VMware Debian VM instead of WSL

**Why**: `wsl --install` enabled VirtualMachinePlatform, but the Windows hypervisor isn't running on PrimePC (firmware VT-x is on; `HypervisorPresent=False`), so WSL2 couldn't start. Turning it on would make VMware run on top of Hyper-V and slow Jener's lab VMs. Jener chose a Debian build VM in VMware and asked to uninstall WSL.

**What changed**
- `[OS]/setup-wsl.sh` → `[OS]/setup-build-vm.sh`.
- `[OS]/build.sh`: default output now `~/jeneros-out` inside the build VM.
- New `[OS]/fetch-vm.ps1` (Windows): `scp jeneros-build:jeneros-out/jeneros.vmdk` → `S:\[VMs]\[JENEROS]`, copies the `.vmx` the first time.
- `[OS]/vmware/jeneros.vmx`: `vhv.enable = "TRUE"` restored (no Hyper-V → nested virt works again).
- Docs: PHASE-1 steps 0a (remove WSL) / 0b (build VM), handoff §3/§6, AGENTS build table, README, OS-PLAN workflow.

**Pending (Jener)**: `wsl --uninstall` + disable VirtualMachinePlatform + reboot; approve the Debian 13.7 netinst ISO download (756 MB → `S:\[ISOs]`); install the build VM.

**Untested**: `fetch-vm.ps1` (needs the VM + an SSH host alias `jeneros-build`).

## 2026-10-07 · Claude · Build VM created (not installed yet)

- Downloaded `S:\[ISOs]\debian-13.7.0-amd64-netinst.iso` (Jener approved; sha256 matches Debian's SHA256SUMS).
- Created `S:\[VMs]\[JENEROS-BUILD]\jeneros-build.vmx` + 80 GB growable `jeneros-build.vmdk` (vmware-vdiskmanager), 4 vCPU / 8 GB / UEFI / NAT, ISO attached.
- Generated SSH key `C:\Users\jener\.ssh\jeneros_build` (ed25519, no passphrase, used only for this VM); public copy in the VM folder.
- New `[DOCS]/BUILD-VM.md`: install steps for Jener + the two PowerShell commands that add the key and passwordless sudo.

## 2026-10-07 · Claude · VMX fix: PCIe slots

- VMware refused to power on the build VM: "No PCIe slot available for Ethernet0" (vmxnet3 needs PCIe root ports). Added `pciBridge0` + `pciBridge4..7` (`pcieRootPort`, 8 functions) to `S:\[VMs]\[JENEROS-BUILD]\jeneros-build.vmx` and `[OS]/vmware/jeneros.vmx`.
- Follow-up: VMware had pinned `ethernet0.pciSlotNumber = "21"` on the first power-on (before bridges existed). Removed that line (web + Codex agreed); bridges kept. Template `[OS]/vmware/jeneros.vmx` never powered on, so it has no slot numbers and is fine.

## 2026-10-07 · Claude · Build VM live; first jenerd compile; bracket-glob bug fixed

**State**: build VM `jeneros-build` (Debian 13.7, 192.168.27.132, user `jener`, key `~/.ssh/jeneros_build`, passwordless sudo). Tools: mkosi 25.3, Go 1.24.4, qemu-img 10.0.13.

**Fixed**
- **CRLF**: files written on Windows had CRLF, so `build.sh` failed (`env: 'bash\r'`). Converted all project text files to LF (except `.ps1`/`.vmx`). `.gitattributes` only helps after a commit/checkout — keep writing LF.
- **Bug in `catalog.Load`**: `filepath.Glob("../[STORE]/apps/*/app.json")` treats `[STORE]` as a character class → 0 apps loaded. Replaced with `os.ReadDir` + per-folder `app.json` (skips folders without one). Any future code that globs paths under `[BRACKET]` folders must escape them or avoid Glob.
- `setup-build-vm.sh` now installs `curl`.

**New**: `[OS]/sync-to-vm.sh` (tar over SSH → `~/jeneros` in the VM).

**Verified in the VM**: `gofmt -l` clean, `go vet` clean, build OK. `/api/system` real data; `/api/store` 5 apps; install → 501, unknown app → 404, DELETE → 501; dashboard + CSS 200.

**In progress**: first `[OS]/build.sh` (mkosi) running in the VM.

**For Codex**: add a `catalog` unit test that loads a temp dir named with brackets (regression test for this bug).

## 2026-10-07 · Claude · First JenerOS image built (M1 step 4)

- `[OS]/build.sh` succeeds end to end in the build VM in ~71 s: `jeneros_0.1.0.raw` (1.0 GB, 662 MB used) → `jeneros.vmdk` (479 MB sparse, 32 GB virtual) → copied to `S:\[VMs]\[JENEROS]` with `[OS]/fetch-vm.ps1`.
- Fix: `qemu-img resize` can't resize vmdk → build.sh now grows a sparse raw copy to 32G, then converts.
- Image inspected with `systemd-dissect`: os-release = JenerOS 0.1.0; `/usr/bin/jenerd`; 5 store apps; `jenerd`, `ssh`, `systemd-networkd` enabled; systemd-boot + kernel 6.12.111 + initrd on ESP; `/etc/issue` shows dashboard URL.
- Not yet booted. Root partition still 1 GB (doesn't grow into the 32 GB) — expected for M1, fixed in M2 (repart GrowFileSystem).
- Note for scripts: `pgrep -f` with a pattern that appears in your own ssh command matches itself — use a PID file.

## 2026-10-07 · Claude · ✅ Milestone 1: JenerOS boots

- `S:\[VMs]\[JENEROS]\jeneros.vmx` powers on, UEFI → systemd-boot → Debian 6.12 kernel → console shows "JenerOS 0.1.0" + `Dashboard: http://192.168.27.133`, autologin as root (dev build).
- From Windows: `/api/system` = hostname `jeneros`, 2 CPU, 3.9 GB, uptime live; `/api/store` = 5 apps; dashboard renders with real data (no sample-data note).
- PHASE-1 M1 steps 0b–6 ticked. Step 0a (WSL uninstall) unconfirmed by Jener. Step 7 = Codex review.
- Next: M2 (IncusOS-style partition layout, read-only /usr, A/B sysupdate, rollback test). Repo still uncommitted.

## 2026-10-07 · Claude · ✅ Milestone 2: A/B updates + automatic rollback

**Layout** (`[OS]/mkosi.repart/`, IncusOS-style): ESP 1G · usr-verity A 128M · usr A 2G (erofs, dm-verity) · usr-verity B · usr B (`_empty`) · root ext4 last, `GrowFileSystem=yes`, grown on first boot by `/usr/lib/repart.d/50-root.conf` (1G → 26.7G on a 32G disk). UKIs `jeneros_<ver>.efi` carry `usrhash=`; `/usr` mounts as `/dev/mapper/usr` erofs ro.

**Updates**: `[OS]/sysupdate.d/*.transfer` (rendered with `@UPDATE_URL@` by build.sh; `Verify=no` for now). New UKIs get `+3` tries. `jeneros-health.service` (Before/RequiredBy `boot-complete.target`) polls jenerd 60 s; on a counted boot that fails it runs `systemd-bless-boot bad` + reboot. Dashboard → `POST /api/update` → jenerd writes `/run/jeneros/update.request` (RuntimeDirectory) → `jeneros-update.path` → root `jeneros-update.service` → `/usr/lib/jeneros/update apply`. `jeneros-update-check.timer` writes `/run/jeneros-update/available.json`. jenerd never runs as root.

**New files**: `[OS]/mkosi.repart/*`, `[OS]/sysupdate.d/*`, `[OS]/serve-updates.sh`, `mkosi.extra/usr/lib/jeneros/{health-check,update}`, units `jeneros-health.service`, `jeneros-update.{path,service}`, `jeneros-update-check.{service,timer}`, `[CORE]/internal/update` (+ tests), `catalog_test.go` (bracket regression), dashboard System card. build.sh: `VERSION=`, `BROKEN=1`, `NO_VMDK=1`, `RELEASE=1`; generates os-release; publishes to `~/jeneros-updates` + SHA256SUMS; dev builds copy the build VM's authorized_keys to root (tmpfiles).

**Verified**
- 0.2.0 fresh disk boots; `/api/update` current=0.2.0; check timer ran.
- 0.2.0 → 0.2.1 via `POST /api/update`: installed into slot B, rebooted, back in ~20 s, `systemd-bless-boot status` = good.
- 0.2.1 → broken 0.2.2 (`jenerd` ExecStart=/bin/false): health check failed after 60 s, marked bad (`jeneros_0.2.2+0-1.efi`), rebooted, systemd-boot fell back to 0.2.1 — ~85 s total, no manual action.
- `/usr` write → "Read-only file system"; `/etc` writable. `go test ./...` passes.

**Known gaps / follow-ups**
1. Update files are uncompressed 2 GB `usr` images — compress (sysupdate supports `.raw.zst`/`.xz` sources; to verify).
2. `Verify=no`: sign SHA256SUMS (gpg) before any public update server.
3. After a rollback the dashboard says "Up to date" (0.2.2 is in a slot, so check-new finds nothing newer). Show "0.2.2 failed and was rolled back".
4. First boot of 0.2.0 took minutes before the dashboard answered; later boots are fast. Investigate with `systemd-analyze` on a fresh disk.
5. `UPDATE_URL` is hard-coded to the build VM (192.168.27.132:8000). Real server: jener.dev.
6. Test VM IP changes per fresh disk (new machine-id): now 192.168.27.134.

**For Codex**: review M2 (repart/sysupdate/health-check/update script/`internal/update`). Note: never use `pkill -f` patterns that also appear in your own SSH command line.

## 2026-10-07 · Codex · Hand-written JenerOS logo SVGs

**Files created**
- `[BRAND]/logo/j-monogram.svg`
- `[BRAND]/logo/j-monogram-light.svg`
- `[BRAND]/logo/jeneros-wordmark.svg`
- `[BRAND]/logo/jeneros-wordmark-light.svg`
- `[BRAND]/logo/splash-512.svg`

**Design choices**: the J uses 96-unit heavy straight strokes, a squared left hook, and one 45-degree bevel at the lower right turn. Its diagonal thickness is approximately 96 units. Both monograms have a transparent 512 × 512 viewBox. The wordmarks place the same monogram beside wide geometric JENEROS capitals, drawn by hand as paths with chamfered corners and transparent counters. No fonts, external references, or raster images. Ink is `#211C16`; the matching light versions use cream `#F6F1E7`. The 512 × 512 splash keeps the cream monogram on `#16130F`, with one small `#FF5A1F` square inside the open space of the J. This follows the existing brand palette and supplies reusable icon, header, and boot artwork.

**Checked**: all five files parse as SVG XML; only SVG/title/desc/group/path elements are present; path commands are straight-line geometry; ink and cream pairs have identical geometry. No installs, dependencies, commits, or pushes.

**Untested / for Claude to check**: browser rendering, readability at favicon sizes, and actual Plymouth/boot rendering. Jener should review the artwork before integration. Phase 1 boxes remain unchanged because the brand task includes Jener's approval and boot integration is separate. Updated `handoff.md` §3 and §6 with asset availability and follow-up.

## 2026-10-07 · Claude · Boot splash (Plymouth) + agent-skills setup

**Boot splash** — Mint-style (logo + spinner), built by reusing Debian's `spinner` theme instead of writing one:
- `[OS]/mkosi.postinst.chroot` copies `spinner` → `jeneros`, sets background `#16130F`, logo at 45% height, spinner at 75%.
- `build.sh` renders Codex's `[BRAND]/logo/splash-512.svg` → `watermark.png` (256 px, `rsvg-convert`; `librsvg2-bin` added to `setup-build-vm.sh`).
- `mkosi.conf`: `plymouth`, `plymouth-themes`, kernel cmdline `splash`.
- **Bug caught in 0.2.3**: `plymouth-set-default-theme` writes `/etc/plymouth/plymouthd.conf`, but `/etc` is on the root partition that A/B updates never touch → updated machines would keep the old theme. Fixed in 0.2.4 by setting `Theme=jeneros` in `/usr/share/plymouth/plymouthd.defaults`. **Rule for everyone: OS defaults go in `/usr`, never `/etc`.**
- Verified: test VM 0.2.1 → 0.2.4 via `POST /api/update` (~20 s, blessed good); `plymouth-start` ran with theme `jeneros` (shown ~0.8 s — the VM boots fast; also shows on shutdown/reboot).
- ponytail: splash starts after switch-root (mkosi can't add custom files to its default initrd); add plymouth + theme to the initrd only if the first ~2 s matter.

**Logo feedback for Codex/Jener**: the monogram reads closer to a mirrored "C" than a "J" (top bar as wide as the hook). Jener will refine; Codex may try a variant with a narrower top bar / longer stem.

**Agent skills (setup-matt-pocock-skills)**: issue tracker = local markdown in `.scratch/<feature>/`; default triage labels; single-context domain docs. Files: `[DOCS]/agents/{issue-tracker,triage-labels,domain}.md`, `## Agent skills` block in `CLAUDE.md`, pointer line in `AGENTS.md`.
