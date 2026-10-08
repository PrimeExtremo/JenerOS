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

## 2026-10-07 · Codex · Keep dashboard update polling alive (P2)

**Changed**: `[DASHBOARD]/app.js` only, plus this log. Update status now polls every 10 seconds while idle and every 3 seconds while requested, installing, rebooting, or reconnecting. One replaceable timer keeps clicks from creating extra polling loops; the existing 1.5-second check after an update POST remains. Only the first failed status request shows demo text. Later failures preserve the displayed version, hide the update button, show "Restarting into the new version…", and keep checking. A changed current version shows a short "Updated to JenerOS X" toast; the initial version and unchanged versions do not. Both update and app-install POSTs send `X-JenerOS: 1` for Claude's CSRF guard.

**Why**: fix the P2 finding "Keep checking update status through idle periods and reboots" so available updates appear without refreshing and the dashboard follows a reboot through to the new version.

**Checked**: `node --check` and scoped `git diff --check` pass. A temporary in-memory Node/DOM/fetch/timer harness passed idle and active polling, update availability, outages before and during reboot, first-request demo fallback, recovery, version-change toast without duplicates, a single polling timer, and both POST headers. No dependencies or test files added.

**Untested / for Claude to check**: a live VM update/reboot and the new server CSRF guard together. `[CORE]/`, `[OS]/`, handoff, and Phase 1 tasks were left untouched as requested. No commit or push.

## 2026-10-07 ? Codex ? Monochrome rounded JenerOS logos

**Changed**: overwrote all five SVGs in `[BRAND]/logo/`: `j-monogram.svg`, `j-monogram-light.svg`, `jeneros-wordmark.svg`, `jeneros-wordmark-light.svg`, and `splash-512.svg`. Added `[BRAND]/logo/README.md`. Updated handoff ?3 and ?6, and recorded Jener's explicitly requested brand change in ?4.

**Why / design**: v1 read like a mirrored C. The new J has a much shorter top bar, a tall right stem, a round bottom hook, and rounded ends drawn as filled B?zier paths. One small dot adds personality. The wordmark reads JenerOS in custom chunky rounded lettering, entirely paths. Ink is `#16161D`; light is `#F7F7F9`. The 512px splash is the same light monogram on transparency: no background rectangle and no orange. Monograms keep the 512 ? 512 canvas; wordmarks now use 1232 ? 240, so integrations should preserve their aspect ratio.

**Checked**: all five files parse as SVG XML and contain only SVG/title/desc/group/path elements, with no fonts, external references, runtime strokes, or raster images. Color variants have identical geometry; splash geometry matches the light monogram. Reviewed local System.Drawing raster previews on light and dark surfaces at 256px, 64px, and 32px, plus large and approximately 246px-wide wordmarks. Scoped `git diff --check` passed. Review preview and local rendering helper are in `.scratch/logo/`. No dependencies, installs, commits, or pushes. No files under `[DASHBOARD]/` were touched.

**Untested / for Claude to check**: browser-native rendering (no connected browser was available), favicon placement, and the regenerated Plymouth watermark in a live boot. Set the Plymouth theme background to `#16161D`; the current theme may still use `#16130F`. Align shared brand tokens/docs with the monochrome direction while redesigning the dashboard. Jener's brand approval remains pending, so Phase 1 checkboxes were left unchanged.

## 2026-10-07 · Codex · Restore approved angular v1 logos in monochrome

**Changed**: all five SVGs in `[BRAND]/logo/` and its `README.md`. Updated `handoff.md` sections 3 and 6 and the logo wording in the brand decision to reflect Jener's explicit direction.

**Why / design**: Jener said "I like this one, keep this style" about the first logo in git HEAD. Restored the exact heavy squared J path `M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z`, its 45-degree bevel, and square `M144 208H176V240H144Z`. Every asset includes the square in the same color as the J. Restored the original wide chamfered JENEROS capitals and 1472 x 320 wordmark canvas. Ink is `#16161D`; paper is `#F7F7F9`. All backgrounds are transparent; splash uses paper for both shapes. Rounded v2 is retired.

**Checked**: all five SVGs parse as XML; exact J and square paths occur once in each; only the intended color occurs in each; light/ink pairs are identical apart from color; the lettering group matches git HEAD exactly. SVGs contain only SVG/title/desc/group/path elements, with straight paths and no background rectangle. Scoped `git diff --check` passed. No dashboard, SSH, or other OS files changed. No installs, dependencies, commits, or pushes. Phase 1 boxes unchanged because integration checks remain pending.

**Untested / for Claude to check**: browser rendering at final sizes and regenerated Plymouth watermark in a live boot. Set the splash surface to `#16161D`. Preserve the restored wordmark aspect ratio. The separate SSH task currently draws a rounded text-art J in `[OS]/mkosi.extra/usr/lib/jeneros/hello`; update that to angular v1 within that task, respecting Jener's request that this logo task leave SSH files untouched.

## 2026-10-07 - Codex - Friendly monochrome SSH and console greeting

**Changed**: added `[OS]/mkosi.extra/usr/lib/jeneros/hello`, `hello-profile.sh`, and the zero-byte `empty-motd`; added `[OS]/mkosi.extra/usr/lib/tmpfiles.d/jeneros-hello.conf`. Added a chmod step to `[OS]/mkosi.postinst.chroot` so the two scripts are executable in the image even after Windows transfers. Updated handoff sections 3 and 6. Did not touch Claude's dashboard, core, update script, or update-check path unit. No commit or push.

**Why / behavior**: make login feel like the new cute monochrome brand. A five-line block-character J sits at the right edge with one column of wrap protection; tput cols falls back to 80. UTF-8 TTYs use only terminal bold/dim/reset capabilities, never colors. TERM=dumb and redirected output use a plain greeting with no art or escape sequences. The profile hook checks the shell's interactive flag, so command-mode SSH, SCP, and rsync produce no greeting. All lasting content is in /usr; L+ tmpfiles links refresh /etc/profile.d/jeneros-hello.sh and /etc/motd at boot, including after A/B updates.

**Summary**: IMAGE_VERSION from /usr/lib/os-release, first non-loopback IPv4 dashboard URL, uptime, memory used/total using MemAvailable, root disk used/total, update availability/server error/rollback from the known flat available.json fields via grep/sed, then one of six friendly tips by day of month. Status versions are sanitized before terminal output; files are never sourced or evaluated. Missing metrics and update files have friendly fallbacks. Test overrides: JENEROS_OS_RELEASE, JENEROS_UPDATE_AVAILABLE, JENEROS_PROC_ROOT.

**Checked locally**: sh -n passed for both new scripts and the modified build hook. A direct Bash run with fake os-release passed and emitted no terminal escapes with redirected stdout. Fixture checks in .scratch/hello/check.sh passed live summary values, first IPv4 selection, ready/up-to-date/rollback/error/missing/malformed update states, all six tips including days 08/09, interactive profile invocation and silent noninteractive invocation. Simulated TTY checks verified 80/120-column art, 80-column fallback for failed/invalid tput output, TERM=dumb and legacy-locale behavior, and bold/dim/reset-only escape codes. Verified LF/no BOM, empty MOTD target, and scoped git diff --check. No packages installed.

**For Claude to verify in the VM**: rebuild, then test both fresh boot and an A/B update on the existing writable root. Confirm the helper mode is 0755 and tmpfiles installs both symlinks even over the previous regular /etc/motd. Log in on console and via interactive SSH; check the tiny J on an 80-column terminal, actual dashboard IPv4, memory/disk/uptime, rotating tip, and update states. Confirm TERM=dumb is plain, ssh host command emits only command output, and SCP/rsync still work. Check Debian PAM does not supply any additional dynamic MOTD text. Local TTY checks were simulated; real Linux tmpfiles, SSH/PAM, console rendering, and A/B behavior were not exercised here.

## 2026-10-07 · Claude · Dashboard redesign (Apple + Claude/Zen palette), live stats, update center, /usr enablement fix

**Direction (Jener, final for now)**: Apple-style dashboard (frosted bar, soft cards, colorful squircle app icons) with Claude orange and a warm palette; light = arvey.co cream `#F6F1E7`, dark = warm brown `#16130F`. Logo, splash and SSH stay monochrome (angular v1 J). Contract: `.impeccable/surfaces/dashboard-index-html.md`; product facts: `PRODUCT.md`.

**Dashboard** (`[DASHBOARD]/`): hash-routed pages Home/Apps/Storage/Machines/System; live stats every 5 s (address, storage, memory, busy, awake); update center (check now, update, installing/restarting, failed, rolled back, server unreachable); honest "Coming soon" for app installs, pools, VMs; arrow-key spatial focus for TV remotes; big focus rings; corner J watermark; dark mode. Buttons use `#B9562F` (white text 4.7:1); `#D97757` only decorative. impeccable detector: 0 findings.

**Backend**: `/api/system` adds `load1`, `diskTotalB/diskFreeB` (root fs), `addresses`; `POST /api/update/check` (CSRF-guarded) → `/run/jeneros/check.request` → new `jeneros-update-check.path`; update script reports `rolledBack` (from `+0-` UKIs) and `error`. jenerd serves the dashboard with `Cache-Control: no-store` (same-mtime image files would otherwise keep a stale dashboard after updates).

**Bug fixed (same class as the Plymouth one)**: presets enable units via links in `/etc`, which A/B updates never touch → `jeneros-update-check.path` (new in this update) stayed disabled on the updated VM. `mkosi.postinst.chroot` now ships `.wants`/`.requires` links in `/usr/lib/systemd/system/` for all JenerOS units. Verified: VM updated 0.2.4 → 0.2.6 → 0.2.7, "Check now" works on a machine installed before the fix. **Rule: anything an update must change goes in /usr — config, theme, unit enablement.**

**Verified on VM 0.2.7** (http://192.168.27.134): CSRF guard 403 without header; check-now updates `available.json`; dashboard real data light + dark; SSH greeting prints.

**For Codex (your code)**: SSH greeting — (1) the corner text-art J does not appear in a 80-col `ssh -tt` session; (2) Debian's `Linux jeneros 6.12…` uname line still prints before it (`/etc/update-motd.d/10-uname`; disable it from /usr like the motd, e.g. tmpfiles); (3) wording "0.3 / 3.8 GiB used / total" → "0.3 of 3.8 GB".

## 2026-10-07 - Codex - Fix SSH corner J, Debian uname MOTD, and usage wording

**Changed**: `[OS]/mkosi.extra/usr/lib/jeneros/hello` and `[OS]/mkosi.extra/usr/lib/tmpfiles.d/jeneros-hello.conf`, plus this log. The greeting now draws an eight-column, five-line angular ASCII J with a squared hook, diagonal bevel, and square `[]` dot. It no longer requires SSH to send a UTF-8 locale or tput to supply a reset capability. Each art row ends one column before the terminal edge. Memory and Disk now say `0.3 of 3.8 GB used` (same rounded values as before). Removed the extra `ESC(B` ASCII-character-set selector from tput's reset string; bold/dim/reset styling stays monochrome.

**MOTD fix**: the /usr tmpfiles config creates `/etc/update-motd.d` if needed and uses `L+` to replace `/etc/update-motd.d/10-uname` with a link to the existing non-executable `/usr/lib/jeneros/empty-motd`. This silences Debian's dynamic uname producer, alongside the existing `/etc/motd` link. Boot-time replacement also applies to the persistent /etc on A/B updates. No PAM, SSH, build-hook, dashboard, core, handoff, or Phase 1 files changed. No dependencies, installs, commits, or pushes.

**Checked**: real local PTY with Git Bash's ncurses tput, `COLUMNS=80` and `120`, and `LANG=C`: exactly five art rows, each width minus one columns. Checked a real non-color `xterm-mono` terminfo entry (`tput colors` = -1), xterm's raw reset containing `ESC(B`, removal of that sequence from greeting output, and fallback when real tput fails for an unknown terminal. Redirected output and TERM=dumb contain no art or escapes. Reused existing summary/update/tip/profile fixtures in a temporary directory with the two wording expectations updated; all passed. `sh -n`, LF/no BOM, empty MOTD target, and scoped `git diff --check` pass. Temporary verification scripts were removed.

**Untested / for Claude to check**: Linux systemd-tmpfiles execution, PAM dynamic MOTD refresh, and actual SSH/console after both a fresh boot and an A/B update. This session could not access the VM SSH key/network, so no VM was changed. Rebuild and verify `/etc/update-motd.d/10-uname` points to the non-executable empty /usr file, no `Linux jeneros ...` line appears, and an 80-column `ssh -tt` login shows the J even without LANG/LC_* forwarding. Recheck quiet command-mode SSH, SCP, and rsync.

**Concurrent repo activity**: Claude's commit `6ec0f20` picked up these two OS edits during verification. Codex ran no commit or push commands; this log entry remains uncommitted.

## 2026-10-07 · Claude · Public release prep (GitHub PrimeExtremo/JenerOS)

- Jener: public repo `PrimeExtremo/JenerOS`, "early preview", license "same as the other Linux OSes" → **GPL-3.0-or-later** (`LICENSE`), commit email rewritten to GitHub noreply (history rewritten before first push; no Gmail left).
- `README.md` rewritten for the public: what works, preview warning (no login, LAN only), install from `.img.xz` (balenaEtcher/Rufus, Secure Boot off) and in VMs (qemu-img convert), updating, build from source.
- `build.sh`: `RELEASE=1` → no dev SSH key, `--autologin=no`, `UPDATE_URL=https://github.com/PrimeExtremo/JenerOS/releases/latest/download/`, output `~/jeneros-release/<ver>/` incl. flashable `jeneros_<ver>.img.xz`. All builds publish usr/verity as `.raw.xz` (2 GiB → ~170 MB; GitHub per-file limit is 2 GiB); transfers match `.raw.xz`; sysupdate decompresses.
- Verified: VM 0.2.7 → bridge 0.2.8 (raw + xz) → **0.2.9 from `.xz` only** (~20 s). Codex's SSH greeting fixes verified on 0.2.9: corner J shows, uname line gone, "0.3 of 3.8 GB used".
- New `[DOCS]/RELEASING.md` (build, test, publish with `gh release create`).
- Why `.img.xz` and not `.iso`: an ISO needs an installer (M4); the image is a ready-to-run disk like HAOS/Raspberry Pi OS. Plan: add `.iso` + installer next.

## 2026-10-07 - Codex - Dashboard finish-review fixes

**Changed**: `[DASHBOARD]/style.css`, `index.html`, `app.js`; added `fonts/bricolage-grotesque-700.woff2` and `fonts/OFL.txt`. Updated only the OWN-WORLD block in `.impeccable/surfaces/dashboard-index-html.md`, plus this log. Dark paper is `#1F1913`, card `#2B241C`, bar `rgba(31,25,19,.8)`; existing cream ink stays `#F6F1E7`. Storage now uses muted teal `#82AAA0` to `#527F76`; System uses sage green `#A3B58C` to `#74895F`. Apps and Machines keep their existing colors.

**Why / behavior**: finish Jener's warm brown dashboard review without changing routing, stats, or update logic. Headings load local Bricolage Grotesque 700 with `font-display: swap`; removed all Google Fonts links/preconnects. Apps now render `<span class="tag">Coming soon</span>` instead of a disabled button; badges stay compact in the store grid. Added the requested scrollbar/accent colors and 4px focus outline. Reduced tag background tint from 16% to 14% because the existing light tag on paper measured only 4.45:1.

**Font provenance**: unmodified upstream `fonts/webfonts/BricolageGrotesque-Bold.woff2` from https://github.com/ateliertriay/bricolage (Git blob `84b8225916508b9c05de1d60edaa2edd0479ebb1`, 47,044 bytes), bundled with that project's complete `OFL.txt`. The upstream license is SIL OFL 1.1. No packages or dependencies installed.

**Checked**: `node --check '[DASHBOARD]/app.js'` and `git diff --check` pass. An in-memory Node script checked 56 enabled text/background pairs in light and dark modes, including paper/card, alpha-composited bar and hover surfaces, tinted tags, inverse text, and filled buttons; all meet 4.5:1. Minimum is 4.53:1 (light tag on paper); white button text is 4.74:1. Dark primary/secondary text on card is 13.60:1 / 7.04:1. Disabled controls are exempt. Verified WOFF2 magic/declared length and exact upstream Git blob hash.

**Untested / exactly what Claude should verify**:
1. Open all five pages in a browser in light and dark mode; confirm dark reads brown (`#1F1913` / `#2B241C`) and frosted bar looks right, including scrolled content behind it.
2. Check Home on desktop and phone: Storage is teal, System is green, Apps and Machines retain their colors, and labels stay readable.
3. With an empty browser cache and internet disconnected, load from the LAN box: the local WOFF2 returns successfully, Bricolage Grotesque 700 actually renders headings, and there are no Google Fonts requests. Confirm the font and OFL file are included in the built dashboard.
4. Check Apps badges stay compact with no button appearance or keyboard stop; verify Tab and arrow-key navigation, the 4px focus outline, and scrollbar styling in a supporting browser.
5. Smoke-check live stats and System check/update controls; confirm the diff contains no behavior change outside the single renderApps markup replacement.

No browser or VM rendering was exercised in this session (no connected browser). No handoff or Phase 1 edits, commits, or pushes. Concurrent `[OS]/mkosi.conf` changes were observed and left untouched.

## 2026-10-07 - Codex - Graphical first boot, phone setup and local status screen

**Changed**: `[DASHBOARD]/setup.html`, `setup.js`, `screen.html`, `screen.js`, `box-ui.js`, `style.css`, and the original MIT `vendor/qrcode.js`; `[CORE]/internal/setup/{setup,apply,apply_test}.go`, `internal/api/{setup,setup_test}.go`, `cmd/jenerd/main.go`, and IPv6 fallback in `internal/system/system.go`; `[OS]/mkosi.conf`, `build.sh`, `mkosi.postinst.chroot`, `jenerd.service`, the new setup-apply helper/path/service, kiosk helper/service, kiosk sysusers config and setup tmpfiles config. Updated handoff sections 2, 3 and 6. Local review notes and QR fixtures are in `.scratch/setup/`. No commit or push; Phase 1 boxes unchanged.

**Cleanup**: removed the cancelled text wizard's `console`, `setup`, `setup-lib.sh`, `jeneros-console.service`, `jeneros-setup.service`, whiptail package and old hook/unit references. Kept Claude's `systemd.firstboot=off`, `Locale=C.UTF-8`, `Timezone=UTC`, `Keymap=us`. Replaced the cancelled build staging block with the requested dev-only setup-done tmpfiles marker; dev images mask the kiosk from `/usr`, preserving mkosi's existing tty1 autologin. Releases use Cage on tty1; password gettys remain available on tty2–6.

**Why / behavior**: one friendly, shared dashboard-style wizard on the box or phone. Eight progress steps; native forms; keyboard/remote focus; matching cream/brown modes and local Bricolage. Server-side hostname, username, password/match, keymap, timezone, interface, address/prefix, router and DNS validation. A cryptographically random six-digit code is generated at daemon startup, kept in memory and published only to the local `/run/jeneros/setup-code`; the page takes `?code=` or asks for the screen's code. Every POST needs that code and `X-JenerOS: 1`. Requests are atomic, mode 0600, and duplicate submissions return 409. Passwords are never in status, subprocess arguments or logs. Every setup endpoint returns 403 after the persistent marker exists. Before setup, `/` redirects to the wizard without revealing a code. Unprivileged local dashboard development can use `go run ./cmd/jenerd -setup=false`; installed jenerd enables setup by default.

**Root apply**: a separate Go subcommand runs from the path-triggered root service. Runs localectl, timedatectl, hostnamectl, useradd and chpasswd (stdin); writes the owner record and optional systemd-networkd fixed settings; reloads/reconfigures the connection; records status and marks completion. Removes the password request on success or failure. Retries reuse only an account created by this setup; existing accounts cannot be claimed. Switching a failed fixed attempt back to Automatic removes the setup override and reloads DHCP. Debian's `/etc/default/keyboard` and `setupcon --save-only --keyboard-only` preserve the layout at boot; `loadkeys` handles Debian builds that reject localectl changes. Cage gets its XKB layout from a small root-written environment file. After setup the kiosk page switches to the real status screen; the phone gets its dashboard link. A fixed-address change offers the new setup address in case the old connection is lost. The kiosk follows daemon restarts so it gets the current code.

**Packages / dependencies**: no Go or JS dependencies, installs, sign-ups or purchases on this PC. Added image packages `cage`, `cog`, `libgl1-mesa-dri`, `libegl-mesa0`, `fonts-dejavu-core`, `kbd`, `console-setup`, `console-data`, `tzdata`. Cage and Cog are available in Debian trixie; Cog is its small single-window WPE kiosk browser. Graphics libraries support hardware and VMware/software rendering; console-data supplies the ten named console layouts; console-setup preserves Debian's boot keyboard. Sources: https://packages.debian.org/trixie/amd64/cog and https://packages.debian.org/trixie/amd64/cage; keyboard behavior documented at https://manpages.debian.org/trixie/keyboard-configuration/keyboard.5.en.html and https://manpages.debian.org/trixie/console-setup/setupcon.1.en.html. All new unit activation links ship in `/usr`; the applier service is activated by its enabled path, not run unconditionally at boot.

**Checked here**: `node --check` for setup, screen, box-ui and vendor QR scripts; `sh -n` for setup-apply, kiosk and mkosi.postinst.chroot; `bash -n` for build.sh; `git diff --check`; LF/no BOM on 23 changed/new code and OS files; setup/screen script/style/logo targets exist; script DOM ID references match HTML with no duplicate IDs; a basic Go lexical delimiter check passes (not a compiler); no cancelled whiptail/console unit references remain in the OS files. `node .scratch/setup/check-qr.cjs` passes four independently generated qrcodejs matrix fixtures (Version 5-L, mask 0), including a leading-zero setup code, :8080 and an IPv6 URL, plus quiet zone and overflow checks. Reference blob: `5507c154ffc1b9d061c55d88268a26eeba49a36e`; upstream source was used only for fixture generation and removed. `go version` failed because Go is not installed. No connected browser was available. No Go formatting, compile, vet/tests, systemd validation, graphical rendering or VM tests ran here.

**Exact checklist for Claude (build VM + a fresh release VM)**:
1. In `[CORE]`, run `gofmt -w cmd/jenerd/main.go internal/api/setup.go internal/api/setup_test.go internal/setup/*.go internal/system/system.go`, then `go vet ./...`, `go test ./...`, `go build ./...`. The added httptest cases cover 403 without/wrong code and without the CSRF header, all endpoints returning 403 after done, bad hostname/short password/mismatched passwords and other validation, 202 on valid input, mode 0600, duplicate 409 and safe progress. Root tests use fake commands and cover stdin-only password handling, cleanup, failed retry, existing-user rejection, Debian keyboard fallback, fixed configuration and injection rejection. Optional: `go test -race ./...` if the build VM already supports it. Fix any failures before building.
2. Build `RELEASE=1 ./[OS]/build.sh`. Put the resulting VM disk under `S:\[VMs]\...`, never C:. Use a **fresh writable root/disk**, not the existing dev VM: its persistent dev setup-done marker intentionally skips this flow. Confirm no dev marker/key/autologin is shipped. Confirm `cog -P wl` and Cage are installed, helpers mode 0755, and `systemd-analyze verify` accepts the new units. Check activation links under `/usr/lib/systemd/system`, including the applier path and kiosk; the kiosk user must have no sudo or password.
3. Boot that release VM. Plymouth must quit and tty1 must show the graphical Welcome card, not a getty or Debian text questions. Check `systemctl status jenerd jeneros-kiosk jeneros-setup-apply.path` and their journals if it does not. Verify the kiosk runs as `jeneros-kiosk`, has a logind seat/session and usable GPU/EGL backend. Confirm the live LAN address and six-digit code/QR appear. No sample stats should appear. Check tty2 still offers a password login. Exercise a non-US keyboard, Tab/Enter/arrow keys and visible focus; review 360px phone and desktop layouts in light/dark modes, with internet disconnected.
4. Scan the setup QR with a phone on the same reachable LAN. VM NAT may need a network arrangement that the phone can reach. Confirm the encoded address is the VM's LAN IP, not 127.0.0.1, and includes the code. The phone should open the same wizard. Opening `/` directly must redirect to setup and ask for the screen code. Verify the browser timezone is preselected when listed, filtering/choosing works, Back preserves choices, passwords hide/show and do not appear in Summary. With the API httptest cases passing, additionally confirm a valid-shaped POST without the code cannot queue a request.
5. Finish with Automatic networking, using a fresh owner username and a password known only to the tester. Confirm 202, `/run/jeneros/setup.request` mode 0600, the applier's applying/done progression, request/code removal, `/var/lib/jeneros/owner`, root-private owner record, and `/var/lib/jeneros/setup-done`. Check no password in either journal or status JSON. The phone must show Done and a working dashboard link; the **box's original screen must switch to screen.html even when only the phone submitted**. Check status-screen QR, hostname, installed version, live stats and five-second refresh.
6. After completion, GET `/api/setup`, GET `/api/setup/status` and POST `/api/setup` must all return 403. Restart jenerd and reload an old setup link; setup must remain closed and the kiosk must still show screen.html. On a separate fresh VM, restart jenerd before completing setup and confirm the kiosk displays a fresh working code rather than its stale link.
7. SSH in as the created owner; check home directory, Bash shell, correct password authentication and `sudo -v`. Confirm root has no new password or dev key. Check `hostnamectl`, `timedatectl`, `/etc/default/keyboard`, the console map and Cage keyboard layout after reboot. Reboot twice: setup must remain done, the owner must still sign in, and tty1 must show the status page rather than the wizard.
8. On another fresh release VM, use a valid unused Fixed address on the VM's subnet. Verify `/etc/systemd/network/10-jeneros.network`, reload/reconfigure, router/DNS, persistence after reboot and dashboard/SSH at the new address. The phone must get the new-address link if disconnected; the loopback kiosk must finish and show the new address/QR. Test an intentional apply failure on a disposable fresh VM: status must say failed without a password, the request must be deleted, same-owner retry must work, an existing unrelated user must be rejected, and Automatic after a failed Fixed attempt must restore DHCP.
9. Build once without RELEASE. Confirm tmpfiles creates setup-done even with no dev SSH key, the kiosk is masked in `/usr`, tty1 autologin remains usable, setup APIs return 403, and the dashboard still works. Also smoke-test an A/B update with an existing owner: persistent owner/network/timezone/setup-done should survive, the new unit links should be present, and the status screen should start.

**Remaining scope**: browser owner sign-in, disk picking and storage/Incus are still later M3 work; this owner account is a real Linux/SSH/sudo account. These changes do not claim the full M3 milestone is complete. Fresh image build, hardware/VM display support and all VM checklist items remain untested until Claude runs them.

## 2026-10-07 - Codex - Reliable first-boot phone QR and mDNS

**Changed**: `[OS]/mkosi.conf` adds avahi-daemon; `mkosi.postinst.chroot` enables its service/socket using the existing /usr want() links. Added `mkosi.extra/usr/lib/jeneros/avahi/{avahi-daemon.conf,hosts,services/jeneros-http.service}` and `usr/lib/systemd/system/avahi-daemon.service.d/jeneros.conf`. Avahi gets a read-only service-local mount of those /usr defaults at its required /etc/avahi path; no JenerOS config is stored in persistent /etc. Publishes system-hostname.local (default jeneros.local) and _http._tcp on port 80 with path=/. The setup-apply service restarts Avahi after success to pick up the chosen hostname immediately. No mDNS reflection.

**Phone flow / review fixes**: `[DASHBOARD]/setup.js` refreshes /api/system every three seconds, keeps the code-bearing QR on the IP URL, shows large IP and hostname.local links under it, and gives a same-Wi-Fi hint. Missing usable addresses show a friendly cable message; connection failures hide stale QR/links; reconnection restores them. `box-ui.js` formats hostname.local with the current port. `setup.html` removes all uppercase heading kickers, retaining the Recommended network badge. `style.css` centers the card and phone panel in a 720px column, enlarges addresses and removes the orange programmatic heading-focus outline; control focus remains visible. Existing cream/brown/orange colors are preserved.

**Address selection**: `[CORE]/internal/system/system.go` uses active non-loopback interfaces and global-unicast addresses, excluding 169.254/16, IPv6 link-local, Docker/container bridges and veth peers. Real 10/8 and 172.16/12 home networks remain eligible; IPv4 is preferred with IPv6-only fallback. Added `system_test.go` for valid LAN ranges, invalid/link-local addresses and container/down/loopback interfaces. No Go dependencies added.

**Docs**: `[DOCS]/BUILD-VM.md` explains Bridged on the JenerOS test VM, active adapter selection, phone Wi-Fi and why VMware NAT cannot work for phone access. Updated handoff sections 3 and 6. Phase 1 boxes remain unchanged. Local phone fixture is `.scratch/setup/check-phone.cjs`.

**Checked**: node --check for setup.js and box-ui.js; phone-flow fixture covers offline/cable state, recovery, changed IP/hostname, leading-zero code, default hostname, IPv6, custom ports, invalid code and completion. Existing four independent QR matrix fixtures, quiet-zone/overflow checks, sh -n on mkosi.postinst.chroot, XML parsing of the service definition, code-file LF/no-BOM checks and git diff --check pass.

**Go checks blocked**: attempted gofmt, go vet and go test, but neither Go nor gofmt is installed/available here. SSH jeneros-build also failed because the alias cannot resolve. No installs, image builds, commits, pushes or git history changes were made. Claude should run in the build VM:

```sh
cd ~/jeneros/'[CORE]'
gofmt -w internal/system/system.go internal/system/system_test.go
go vet ./...
go test ./...
```

**Untested / for Claude to check**: live Avahi startup with its service mount, hostname.local and _http._tcp discovery from a phone on the Bridged LAN, hostname rename after setup, unplug/replug with QR disappearance/recovery, desktop and phone light/dark rendering (including the removed orange heading edge), and updated Avahi defaults/unit activation after A/B updates. Confirm both visible links include the setup code in their href while the QR still encodes the IP. Go tests and VM checks are pending; this does not claim NAT is reachable.

**References**: Avahi defaults and hostname behavior: https://manpages.debian.org/trixie/avahi-daemon/avahi-daemon.conf.5.en.html ; static HTTP service definitions: https://manpages.debian.org/trixie/avahi-daemon/avahi.service.5.en.html .

## 2026-10-07 - Codex - JenerOS box info, consent, previous-version restart and installer brief

**Changed**: `[DASHBOARD]/{setup.html,setup.js,screen.html,screen.js,privacy.html,rollback.js,index.html,app.js,style.css}`; `[CORE]/cmd/jenerd/main.go`, `internal/api/{api.go,setup_test.go,rollback_test.go}`, `internal/system/{system.go,facts.go,facts_test.go}`, `internal/setup/{setup.go,apply.go,apply_test.go,validation_test.go}`, `internal/update/{update.go,rollback.go,rollback_test.go}`; `[OS]/{build.sh,mkosi.postinst.chroot}`, `/usr/lib/issue`, getty tty2–6 drop-ins, SSH service/socket drop-ins, rollback helper/path/service and shared update lock. Removed the old `[OS]/mkosi.extra/etc/issue` overlay. Added `.scratch/setup/check-{validation,screen,rollback}.cjs` and design-only `.scratch/installer/BRIEF.md`. Updated handoff sections 3 and 6, and its brand decision to match Jener's explicit current palette request. No Phase 1 boxes ticked.

**Why / screens**: implement the requested clear console/setup sequence using JenerOS artwork and original copy. Existing cream `#F6F1E7`, brown `#1F1913`, orange `#D97757` decoration and `#B9562F` buttons remain; the angular v1 J path is reused. The seven-row kiosk table reads manufacturer/model from DMI, kernel from proc, and version/build date from `/usr/lib/os-release`. Missing DMI is shown as unavailable. SSH status detects actual port-22 listeners (IPv4 and IPv6) without privileges or subprocesses. IP + current hostname.local links and QR refresh; stale links disappear on connection failure. Default hostname gives jeneros.local; after setup the chosen hostname.local is the working name. No alias for every renamed box was invented.

**Text console**: the `/usr/lib/issue` template has a five-line JENEROS banner, ANSI orange/bold, version, agetty `\n`, `\r`, `\4`, current hostname.local and default jeneros.local. Version is inserted by build staging and finalized in postinst to avoid overlay-order assumptions. Tty2–6 explicitly use `--issue-file /usr/lib/issue`; no shipped persistent `/etc` banner/config. Debian trixie's agetty manual supports these paths/escapes but documents that older util-linux fallback behavior can be hidden by `/etc/issue`, hence the explicit drop-ins. S works on the graphical main screen; the text gettys still provide normal password login and point users to tty1.

**Previous version**: `POST /api/update/rollback` keeps `X-JenerOS: 1`, creates `/run/jeneros/rollback.request`, and returns 202. Duplicate/busy requests return 409. The API serializes update and rollback submissions; root update/rollback scripts share `/run/jeneros-update/action.lock` with flock. Root `.path` + oneshot call `/usr/lib/jeneros/rollback`, enabled through `want()` under `/usr`. `bootctl --json=short list` is parsed by a stdlib-only `jenerd rollback-entry` selector: require exactly one selected JenerOS Type #2 UKI and exactly one other JenerOS UKI, reject foreign/unsafe/ambiguous entries and exhausted boot tries. Systemd's JSON uses `type: type2`, `path`, normalized `id`, `isSelected`, optional `triesLeft`; it does not use the human display string or `source` as a path. The root script calls `bootctl set-oneshot` and only then reboots. No target comes from HTTP. Every handled failure consumes the request and writes readable rollback progress, so a missing second slot cannot cause a path-trigger loop. The confirmation explains that this changes the next boot only, not the persistent default. Shared dashboard/kiosk dialog, cancel, and local S shortcut all use the same endpoint. API is still LAN/CSRF protection only, like the existing update API; owner dashboard authentication remains later work.

**Privacy / owner checks**: first step selects English (`en`) and must tick “I accept the JenerOS Privacy Policy”; the page copies the provided `[DOCS]/PRIVACY.md` text and effective version `2026-10-08`, with local styling/assets. POST without acceptedPrivacy=true is rejected. The server replaces any supplied audit values with its UTC acceptance time and current policy version; the root applier verifies them and saves a root-private `/var/lib/jeneros/privacy.json` before setup-done. Consent stays in setup state through reboot/A/B updates. Reserved usernames are published by the API from the Go list. Both sides require a lowercase letter first, up to 32 lowercase letters/digits/dash/underscore, and reject root/service names. Existing-user rejection remains in the root applier. Passwords need eight Unicode characters, at most 256 UTF-8 bytes, valid Unicode and no CR/LF/NUL; confirmation must match. Field errors appear while typing, clear when corrected, and Continue stays disabled while the owner fields or welcome consent/code are invalid. Setup requests remain private/transient; persistent consent has no password.

**SSH change to make the requested note true**: releases gate both Debian `ssh.service` and `ssh.socket` with `/usr` drop-ins. They start only with persistent `/var/lib/jeneros/ssh-enabled` or the existing bundled dev/TEST_SSH key. Owner creation no longer automatically starts release SSH. No dashboard SSH toggle is claimed. The local owner can opt in with `sudo touch /var/lib/jeneros/ssh-enabled` then `sudo systemctl start ssh.service`. This supersedes the earlier first-boot checklist's immediate-SSH expectation. An already installed release may require this local opt-in after an update; do not use a remote-only box for the first test. Test images with bundled keys retain their existing access. No service was changed on Jener's Windows PC.

**Installer**: `.scratch/installer/BRIEF.md` covers Welcome → Language → disk cards → ready checklist and explicit erase consent → named progress stages/percent → remove-media/restart. Proposes a separate mkosi live profile, non-root Cage/Cog and loopback `jenerd -installer`, with a root worker that rechecks stable disk identity and excludes installer ancestry. Compares repart copy/explicit CopyBlocks definitions with dd + growth; notes that `--copy-from` preserves source sizes, so root growth must be explicitly tested. The “data” area follows the current writable root/state partition rather than silently changing the settled A/B layout. USB first, ISO mastering later. No installer code, image, disk write or build output created.

**Checked here**: Node syntax for setup/screen/rollback/app; Node fixtures for consent/inline validation (including reserved names, Unicode/byte limits, correction and confirmation), kiosk facts/SSH/IP/local/IPv6/QR/offline cleanup, rollback confirm/cancel/CSRF/double-submit/busy/old-failure/retry, existing phone links and four independent QR matrix fixtures; shell syntax for build/postinst/update/rollback; static HTML IDs/assets, copied policy text, banner bounds, LF/no BOM and `git diff --check`. Browser inventory returned no connected apps/browsers, so no rendering check ran. Go and gofmt are not installed on Windows; no Go compile, formatting, vet or tests ran. Go tests have been added, not claimed as passing. No Go/JS dependencies, installs, admin commands, images, commits, pushes or git history changes. Existing/concurrent `.gitignore` reference-screenshot ignore changes were observed and left untouched.

**Claude: required before image review**:

```sh
cd ~/jeneros/'[CORE]'
gofmt -w cmd/jenerd/main.go internal/api/*.go internal/setup/*.go internal/system/*.go internal/update/*.go
go vet ./...
go test ./...
go build ./...
```

1. Fix compile/test failures first. New Go tests cover DMI/release/kernel fallbacks, IPv4/IPv6 SSH listeners, strict owner rules/password boundaries, missing consent, server-overwritten audit data, persisted consent without passwords, root refusal of unstamped/old consent, CSRF, duplicate/busy rollback and normalized UKI selection/failures.
2. On a fresh release, verify welcome Continue is disabled before consent, English retained, policy opens without losing the original setup/code, inline errors work on phone/kiosk, username starts with a letter, and final POST cannot bypass consent. Check `/var/lib/jeneros/privacy.json` content/mode 0600 and persistence; invalid consent never runs system commands or marks setup done. Preserve the earlier phone/mDNS/setup checks.
3. Review kiosk and privacy in cream/brown at desktop, 800×600 and phone sizes, offline with local fonts. Table has Manufacturer/Model/OS/Build date/Hostname/Kernel/Uptime; SSH matches port 22, and IP/hostname links plus QR recover after reconnection. Test `BUILD_DATE`, including SOURCE_DATE_EPOCH for reproducible builds.
4. Run `systemd-analyze verify` on the new units/drop-ins. Confirm helper mode 0755 and `/usr` path activation links on fresh boot and A/B update. On tty2–6, `agetty --show-issue --issue-file /usr/lib/issue` and actual login show real version/hostname/kernel/IP, ANSI color, no literal @VERSION@, and fit 80×25 with login prompt. Existing `/etc/issue` must not hide the new banner.
5. On a disposable two-version VM, test dashboard confirmation and local S; cancel/Escape do nothing. Confirm unprivileged jenerd only writes the request and root sets the other normalized entry for one boot. Confirm no persistent boot default changes. Test one-slot, exhausted tries and ambiguous boot menus: readable failure, request removed, no reboot loop. Confirm concurrent update/check/rollback cannot modify slots/boot selection together; check shared lock and API 409 behavior. Check failure/retry and clear post-reboot UI state.
6. Verify SSH release service AND socket remain closed after setup/reboot; locally opt in, then confirm owner SSH/sudo and live on/off display. Verify dev/TEST_SSH access still works. Review the local opt-in migration before testing an existing release over A/B.
7. Review the M4 brief with Jener before implementation. Milestone checks remain open until real VM/hardware checks pass.

**References**: [Debian trixie agetty](https://manpages.debian.org/trixie/util-linux/agetty.8.en.html); [systemd v257 bootctl](https://github.com/systemd/systemd/blob/v257/man/bootctl.xml) and [boot-entry JSON source](https://github.com/systemd/systemd/blob/v257/src/shared/bootspec.c); [Debian trixie repart](https://manpages.debian.org/trixie/systemd-repart/systemd-repart.8.en.html). Reference research stays in `.scratch/zimaos/RESEARCH.md`; no ZimaOS branding or text was copied into product pages.

## 2026-10-07 - Codex - Style brief phase 1: desktop dashboard, settings and wallpaper

**Scope**: implemented phase 1 of .scratch/zimaos/STYLE-BRIEF.md and stopped. Opened reference shots 11, 12, 18-21 and 26. Setup cards, the App Store redesign and Storage creation were not started. Reference shots remain local and are not product assets.

**Changed**: [DASHBOARD]/index.html and app.js; new desktop.css, desktop-preferences.js, desktop-metrics.js and original wallpaper-{ribbon,dune}.svg. Read-only metrics in [CORE]/internal/system/{system.go,metrics.go,metrics_test.go}; exported observed SSH status in facts.go. New internal/access/{ssh.go,ssh_test.go}, internal/api/{ssh.go,ssh_test.go} and SSH registration in cmd/jenerd/main.go. New [OS]/mkosi.extra/usr/lib/jeneros/ssh-access and systemd jeneros-ssh.path/service; mkosi.postinst.chroot sets the helper mode and /usr activation links (including conditioned ssh.service for reboot persistence). Updated handoff sections 3 and 6 and removed the now-resolved dashboard restyle question. Review/checklist and local fixture runners are in .scratch/zimaos/; generated test sandboxes have their own local ignore. Shared style.css, setup/screen/privacy and store manifests were not changed by this phase; their earlier/concurrent working-tree changes were preserved.

**Dashboard / settings**: wallpaper desktop, left clock/system/storage/network widgets, CPU/RAM rings, live traffic graph, widget picker, right search, swipeable notices with responsive dots and large rounded app tiles. One rounded modal with General/Storage/Network/Apps/Account sidebar and bottom Power control. Original warm dark default and cream light theme, local Bricolage and monochrome angular J. Wallpaper, clock timezone/format, avatar color and widget choices persist in this browser, with safe blocked/corrupt-storage handling. Search filters apps; Files/Photos/Backup/Machines open honest coming-soon windows. App Store opens the existing simple catalog. Device/IP/facts and system space are real when available. Disk health says System disk/Almost full because SMART isn't implemented. No new-disk alerts, app-install percentages, app-data paths or resource usage are fabricated. Password/family accounts, disk standby, UPS, remote access and web power actions remain labelled future work.

**Live numbers**: /api/system adds cumulative CPU and home-interface RX/TX counters. UI takes differences using box uptime, excludes repeated guest-time fields and does not use load average as a CPU percentage. Missing/reset counters remain unavailable; disconnection clears CPU/traffic history and labels retained disk/RAM as the last reading. Existing update/check/rollback controls remain in General; network loss now claims a restart only when an update/recovery operation was already in progress. Native dialog focus/Escape, scoped arrow navigation, visible focus, large controls and reduced motion are retained.

**SSH toggle**: the brief was updated during the session to explicitly request its backend, so the switch is implemented. GET/POST /api/settings/ssh keep the existing X-JenerOS CSRF boundary; strict size-limited boolean input, finished-setup/helper gates, duplicate/busy protection and dev-key protection. The unprivileged daemon atomically publishes a complete 0600 enable/disable request. A fixed-action root worker updates /var/lib/jeneros/ssh-enabled, starts SSH, or stops BOTH socket and service before removing opt-in. Failed starts remove only newly created flags; failed stops retain the prior choice. Worker consumes requests, records atomic status, has a lock/signal cleanup and a service timeout. The switch follows actual port-22 status and displays queue/failure/retry in the window. No SSH/PC settings were actually changed in this session. This remains the project's LAN/CSRF-only API boundary; dashboard owner authentication is still unfinished, as with the pre-existing update API. New configuration/activation ships in /usr, not /etc.

**Checked here**: node --check on app.js and both new scripts; node .scratch/zimaos/check-desktop.cjs (DOM IDs/assets, escaping, search/settings, saved/blocked/corrupt preferences, counter differences/resets/missing/offline, SSH submission/observed status/dev/failure/retry and update offline state); node .scratch/zimaos/check-ssh-helper.cjs (eight rewritten workspace-only cases with fake systemctl/flock: enable, disable/socket stop, invalid request, setup/dev guards, new/existing flag on failed start, failed stop preservation); existing check-rollback.cjs and check-screen.cjs; sh -n for ssh-access and mkosi.postinst.chroot; git diff --check. SVG XML and new-file LF/no-BOM checks passed. Go tests were added for counter parsing and SSH API/queue validation but have NOT run. No dependencies, installs, purchases, builds, commits, pushes or git-history changes. No Phase 1 milestone boxes ticked.

**Untested / Claude should check**: no browser surfaces were connected, so no rendered comparison or responsive/focus visual check ran. Go/gofmt are absent here; go version confirms that. No impeccable detector was available among tools/skills. Full commands and review mapping are in .scratch/zimaos/PHASE-1-REVIEW.md. On the build VM:

~~~sh
cd ~/jeneros/'[CORE]'
gofmt -w cmd/jenerd/main.go internal/access/*.go internal/api/ssh*.go internal/system/*.go
go vet ./...
go test ./...
go build ./...
~~~

Then validate the new path/service with systemd-analyze verify and check mode 0755 plus /usr activation on fresh/reboot/A/B images. In a disposable updated release, check initial SSH-off, setup guard, on/off and owner login, socket+service stopped, reboot persistence, duplicate/failure/retry and dev/TEST_SSH exemption. Match CPU/traffic against live tools, unplug/reconnect and reboot. Compare dashboard/settings to shots 11/12/18-21/26 at desktop, 800x600, 390px and 320px, both themes and offline fonts; verify touch/resize notice dots, search, keyboard/remote focus, nested rollback cancel/confirm, reduced motion and reload persistence. Preserve earlier setup/kiosk checks. Do not start style phase 2 until Jener asks.

**Reference for counters**: [Linux kernel /proc documentation](https://www.kernel.org/doc/html/latest/filesystems/proc.html).


## 2026-10-07 - Codex - Phase 1 fixes, owner login and style phase 2

**Scope**: applied Jener's fixes after Claude's phase 1 live browser review (warm dark and cream light looked good; previous Go vet/tests passed), then implemented style-brief phase 2 and stopped. Read handoff, AGENTS, Phase 1 tasks, newest updates, agent conventions, STYLE-BRIEF including Claude's privacy.pdf note, and local setup reference shots 08-10. Applied apple-design principles. No web-interface-guidelines skill or impeccable detector was found. No connected browser was available for a new rendered review.

**Changed**: [DASHBOARD]/desktop.css (12px tile status, contrast, notice grid, solid accessibility surfaces), index.html/app.js (owner name, sign out, session-aware requests and introduction routes), setup.html/setup.js (three centered wallpaper cards), new onboarding.css/login.html/login.js/session.js, screen.html/screen.js/rollback.js (sign-in before kiosk actions). [CORE]/internal/auth/{auth.go,helper.go,auth_test.go}, internal/api/{auth.go,auth_test.go,api.go}, cmd/jenerd/main.go. [OS]/mkosi.conf, daemon unit and new jeneros-auth.socket/service under /usr. Updated handoff sections 3 and 6. New .scratch/zimaos/{PHASE-2-REVIEW.md,check-login.cjs,check-onboarding.cjs}; adapted existing desktop/setup/page/rollback fixtures. privacy.pdf and privacy.html content remain as supplied; no PDF generation was needed.

**Why / dashboard fixes**: status labels are 0.75rem (12px at default size), in foreground ink. Worst possible glass compositing over white/black still yields 7.86:1 dark / 12.93:1 light. Both reduced-transparency and increased-contrast preferences use solid card/bar surfaces and disable backdrop filters; high contrast also strengthens borders/secondary text. Notice body takes the full remaining grid column beside the button with no character-width cap; narrow cards stack the button below.

**Owner login / security**: /login uses the same wallpaper and centered card, username/current-password fields, inline errors, visibility control and retry feedback. A fixed-purpose root Go subcommand reads only the setup owner marker and verifies that account using Debian's existing unix_chkpwd nonull plus chkexpiry. No PAM conversation/cgo, shadow access in jenerd, default password, password argv, password logs or login request files. NUL-terminated password travels on stdin through the private inherited Unix socket. Socket is mode 0600 for the active DynamicUser, in root-owned /run outside the daemon's writable directory; systemd orders allocation/ownership and stops it with jenerd. Root helper has strict filesystem/home/device/capability limits. Core dumps are disabled for helper and daemon. All unit configuration ships in /usr. Explicit OS packages libpam-modules-bin and libnss-systemd supply the existing checker and DynamicUser NSS resolution; jenerd remains Go stdlib only, with no new module dependencies.

An outer middleware protects all current/future APIs: session plus X-JenerOS for mutations, including SSH/update/check/rollback/install/remove and all loopback actions. GET /api/system remains unauthenticated only for direct loopback peers. Forwarded addresses are ignored. First-boot setup keeps its code/consent/done-marker bootstrap guard; login/session inspection are bootstrap endpoints. 256-bit random cookies are HttpOnly, SameSite=Strict, expire in 8 hours and rotate on login. Server stores only token hashes, at most 128 active sessions; logout revokes the token and daemon restart revokes all sessions. Five attempts per peer/minute and 30 global/minute, reserved before verification; successful login resets the peer count. Root independently bounds checks. Missing helper/owner, invalid credentials and expired sessions fail closed. -setup=false never disables authentication. Kiosk S now leads to sign-in; a separate explicit confirmation is still required afterwards, with no automatic rollback on login.

**Phase 2**: Welcome to / JenerOS with English select, required privacy checkbox linking privacy.pdf in a new tab, explicit readable privacy.html fallback, code handling and round orange next control. Create / your account keeps strict live username/password/confirmation errors and password visibility; optional Box settings retain keyboard/timezone/hostname/network choices with defaults. Invalid collapsed settings open before browser validation focus. Existing setup worker/consent persistence are unchanged. Introducing / JenerOS has four original feature tiles with honest availability text, and Files/App Store/dashboard destinations preserved through login. Accepted requests clear form passwords; completion removes the code from the URL. Phone QR remains on the local screen; remote phones use their current origin or the chosen fixed address. Local setup can explicitly return to the box screen. No App Store redesign or Storage creation was started.

**Checked here**: Node syntax for setup/login/session/app/screen/rollback; new check-login.cjs (inline failure, password clearing, header, rate-limit retry, safe local destinations, expiry redirection and structure) and check-onboarding.cjs (welcome/account/apply/introduction, consent, submitted choices, CSRF, cleared password/code, fixed-address links). Existing check-desktop.cjs, setup check-validation/check-phone/check-rollback/check-screen/check-pages/check-qr all pass. Fake-service check-ssh-helper.cjs still passes; it changes workspace fixtures only. Contrast, LF/no BOM and whitespace checks passed on changed code. Go tests are added but NOT run or gofmt'd on Windows. No installs/admin commands, real account/password/service changes, images, commits, pushes or git commands. No bootable Phase 1 boxes ticked.

**Untested / Claude should check**: Go formatting/vet/tests/race tests, actual DynamicUser socket ownership and restart, helper sandbox/fd inheritance, real setup-owner yescrypt/locked/expired password handling, authorization action-file denial and authenticated queues, cookie expiry/logout/restart, throttle/retry, and rendered desktop/800x600/390px/320px light/dark, text zoom, keyboard/remote, transparency/contrast preferences and fixed-address failure/retry. Exact checklist and commands are in .scratch/zimaos/PHASE-2-REVIEW.md. Existing HTTP transport is unencrypted; Secure cookies apply only to direct HTTPS, not untrusted forwarding headers. TLS was not added. Older dev images with no setup owner marker intentionally cannot sign in; do not add a default account/bypass. New auth remains a release validation gate until Claude's checks pass.

~~~sh
cd ~/jeneros/'[CORE]'
gofmt -w cmd/jenerd/main.go internal/api/auth*.go internal/api/api.go internal/auth/*.go
go vet ./...
go test ./...
go test -race ./...
~~~

**Implementation references**: [Linux-PAM 1.7.0 password/expiry checker](https://github.com/linux-pam/linux-pam/blob/v1.7.0/modules/pam_unix/unix_chkpwd.c), [Debian checker files](https://packages.debian.org/trixie/amd64/libpam-modules-bin/filelist), [systemd socket ownership](https://github.com/systemd/systemd/blob/v257/man/systemd.socket.xml) and [DynamicUser/NSS](https://github.com/systemd/systemd/blob/v257/man/systemd.exec.xml). Browser/VM review stays pending, and work stops after style phase 2 as requested.
## 2026-10-08 - Claude cloud - GitHub checks on every pull request

**Changed**: new `.github/workflows/checks.yml` (branch `cloud/ci`). Jener asked for automated checks so `main` can require them before merging.

**What runs**: two jobs, on every pull request and on pushes to `main`/`zimaos-style`. `go`: gofmt (fails if any file needs formatting), `go vet`, `go test`, `go build` in `[CORE]`, using the Go version from `go.mod`. `dashboard`: `node --check` on every `[DASHBOARD]/*.js`, then the eight local fixtures in `.scratch/setup/` and `.scratch/zimaos/`. No images are built, and no secrets are used (read-only token).

**For any AI adding code**: new Go must be gofmt-clean, and new fixture scripts must be added to the list in the workflow. Browser checks that need a running jenerd (like `check-store.cjs` from the App Store PR) stay out of CI.

**Checked**: all steps ran locally on this branch and passed. The first real GitHub run happens on this PR.

**Not done**: branch protection on `main`. No tool in the cloud session can change repo settings, so Jener sets the ruleset by hand. Once this workflow has run once, its `go` and `dashboard` checks can be added as required.
## 2026-10-08 - Claude - Phone gauges no longer push the page sideways

**Changed**: [DASHBOARD]/desktop.css only, inside `@media (max-width: 680px)`. The CPU/RAM rings now size from their widget instead of the viewport: `.gauge-group` is `flex: 1 1 0; min-width: 0`, `.gauge` is `width: 100%; max-width: 72px; aspect-ratio: 1`, and the `.gauges` gap is 6px.

**Why**: at 320px the old `min(72px, 19vw)` rings plus gap didn't fit in one column of the two-column widget grid. The RAM ring stuck out 3px and the whole page scrolled sideways.

**Checked here**: local jenerd (`-addr 127.0.0.1:8099 -setup=false`) + Playwright Chromium, dark and light. `scrollWidth - innerWidth` is 0 at 320, 360 and 390px (was 3 at 320). Ring size: 54px at 320, 64px at 360, 72px at 390 (unchanged at 390). Numbers stay readable in a 320px screenshot. No widget control is under 44px (rings are not buttons). `node .scratch/zimaos/check-desktop.cjs` passes.

**Untested / Codex should check**: real phones and the kiosk screen; other narrow widths between 300 and 680px by eye.
## 2026-10-08 - Claude cloud - Style brief phase 3: App Store window

**Changed**: new `[DASHBOARD]/store.js` and `store.css`; `index.html` only loads them; `app.js` only opens/closes the new window (`openCatalog`, `route`) and drops the now-unused `catalogSample`. `[CORE]/internal/catalog/{catalog.go,catalog_test.go}`, `[CORE]/internal/api/api.go` and new `api/store_test.go`. All five `[STORE]/apps/*/app.json` gain `developer`, `added`, `description`, `whatsNew`; Photos moves to the new `photos` category. `[SPEC]/app-manifest.md` documents the fields. New browser check `.scratch/zimaos/check-store.cjs`. Did not touch setup.html/setup.js, the login screen or jenerd auth code (Codex is on those).

**Why**: phase 3 of `.scratch/zimaos/STYLE-BRIEF.md`. The App Store tile, "+" and `#/apps` now open a Settings-style window: sidebar with Discover, Search, My Apps, seven categories (Media, Photos, Files, Home, Network, AI, Tools) and Custom install at the bottom. Discover has a featured hero, Popular cards and a New list (sorted by `added`). The app page shows icon, name, tagline, Install button with a progress ring, chips (category, developer, min memory, disk use), screenshots, what's new and about. My Apps is a table (status, port, uptime, memory, CPU, start/stop) that turns into one card per app on phones. Custom install is a sheet with a Form/YAML toggle; the form writes the YAML until you edit the YAML by hand.

**Honest states**: Install really POSTs `/api/apps/{id}/install`; jenerd answers 501, so the button turns into "Coming soon" with "Nothing was changed on your box". If a later jenerd answers 202, the window shows "Installing…" and re-reads `/api/store` until the status flips. Start/stop and custom install say "coming soon" without calling anything (no endpoints yet). Uptime, memory and CPU show "—" ("Not measured yet" for screen readers). Without jenerd the window uses a labelled sample catalog and won't try to install. Art is original: each app's existing gradient plus a large faint copy of its own icon.

**Backend**: manifest gains optional `developer`, `added` (YYYY-MM-DD), `description`, `whatsNew`, `screenshots`. `requirements.memoryMB/diskGB` already existed and feed the chips. `catalog.Load` now rejects bad ids, unknown categories, bad dates, negative requirements, duplicate ids and screenshot paths that are absolute, escape the folder, use backslashes or aren't .png/.jpg/.webp (SVG left out: same-origin script risk). New `GET /api/store/{id}/screenshots/{n}` serves only listed files, with `nosniff`. Category list changed from `media|files|home|network|tools|dev` to `media|photos|files|home|network|ai|tools` (no app used `dev`). No dependencies added.

**Checked (in the cloud container, Go 1.24)**: `gofmt -l` clean, `go vet ./...`, `go test ./...` pass, including new tests for the store fields, bad manifests, the shipped catalog, screenshot serving/404s/traversal and the honest 501. `node --check` on store.js/app.js; `.scratch/zimaos/check-desktop.cjs` still passes. `check-store.cjs` ran in headless Chromium against a local jenerd at 1280×800, 800×600, 390×844 and 320×640, dark and light: no horizontal scroll from the store, focus moves to page titles, keyboard opens categories with `aria-current`, visible focus ring, 501 → coming soon, back button, empty AI category, search, custom form validation + YAML output, Escape closes only the sheet, search keeps focus while a slow catalog loads, populated My Apps table (mocked statuses) and offline sample mode. Screenshots were reviewed by eye.

**Untested / for the other AI**: no real screenshots exist yet, so the image strip only ran with broken placeholder files; `prefers-reduced-transparency` (solid backdrop, no art dots) and reduced motion (ring stops spinning) were not rendered; no TV-remote or screen-reader pass; not checked on the box's kiosk or a real phone. The 202 "Installing…" path can't run until jenerd installs apps. Pre-existing, not changed: at 320px the desktop's RAM gauge widget makes the page 3px wider than the screen (desktop.css). Codex: please glance at the category rename (`dev` gone) and keep `added` filled in for new apps.

## 2026-10-08 - Claude cloud - Motion spec across the dashboard, windows, login and setup

**Changed**: `[DASHBOARD]/desktop.css` (tokens on `:root`, keyframes, hover/press, toggles, toasts, load cascade, window open/close, wallpaper drift, success check, reduced-motion rules), `store.css`, `onboarding.css`, `index.html` (`is-arriving` body class; network lines wrapped in a clip group), `app.js` (new `JenerMotion` helpers plus wiring), `store.js`, `setup.js`, `login.js`. New browser check `.scratch/motion/check-motion.cjs`. Go untouched. Branch `cloud/motion`.

**What moves** (follows `.scratch/motion/BRIEF.md`): only the seven tokens are used for easing and the three standard durations; the literal times in the recipes (80, 180, 200, 220, 300, 320, 600ms) are used where the brief names them. Dashboard load cascades clock → widgets → search → notices → tiles (30ms steps, done by 390ms, plays once). Tiles: hover lift 2px + bigger shadow + icon 1.04 at 120ms; press 0.97 at 80ms, release 200ms (hover uses `translate`, press uses `scale`, so the two timings don't fight). Buttons press 0.97; orange buttons glow on hover. Settings/App Store/app/widget windows and the custom-install sheet: backdrop fade 200ms, window 0.96 → 1 + fade (380ms, ease-out); close buttons and Escape play 0.98 + fade (220ms, ease-in) and then call `close()`; reopening during the close cancels it; focus moves after the window settles (unless the user already moved it). Sidebars in both windows have one sliding active pill (desktop widths; phones keep the per-item highlight). Settings pages and App Store pages crossfade with an 8px slide. Notices slide one card with `--ease` in 320ms (touch/wheel stops it), dots stretch 8 → 20px, auto-advance every 8s, paused on hover/focus, open windows, hidden tabs and reduced motion. CPU/RAM rings sweep 600ms with the number counting along. A full network graph slides new points in from the right. SSH switch knob slides with `--ease-pop` 220ms, track fades 120ms. Toasts rise 16px, leave with an 8px drop. Login/setup cards rise in; setup steps slide out left (200ms) and in from the right (300ms), reversed for Back; a click or key during the slide finishes it instead of acting twice. Wrong password: three ±8px shakes in 320ms with the existing error text and orange border. Setup finished (only when it finished in this tab) and app installed: a check pops (300ms) and draws (250ms) with six cream/orange dots once; the check sits before "Your account is ready." Install ring breathes (opacity 0.7 ↔ 1, 1.2s) while waiting; it no longer shows a made-up 25% arc. Wallpaper drifts under 2% over a 60s loop, paused when the tab is hidden.

**Reduced motion**: no movement or scale anywhere; windows, cards, the cascade and step changes become 120ms opacity fades; no drift, confetti, shake, auto-advance or ring sweep. style.css's global `animation/transition: none !important` is overridden only for those fades. Arrow-key/TV focus is never animated (focused tiles lift instantly).

**Deviations to review**: the brief asks for sine easing on ambient loops but the token list has no sine, so the drift and pulse use `--ease` with `alternate`. The settings "crossfade" fades/slides the new page in while the old one disappears at once. Ring sweep, check draw and install progress animate SVG stroke dashes (the brief asks for strokes; no transform can do it). Dots are now 8px/20px as the brief says (were 5/18).

**Checked**: all ten fixtures in `.github/workflows/checks.yml`, `node --check` on every dashboard script. `.scratch/motion/check-motion.cjs` (Playwright, static server, faked API) passed for motion and reduced motion × dark and light × 1280 and 390px: tokens, cascade timing and once-only, drift on/off, tile lift, notice tween vs instant, Settings open/settle focus/pill/page crossfade/Escape close, App Store open/focus/reopen-cancels-close/close, instant arrow focus, login card + shake, setup slide + focus + celebration + confetti cleanup, no sideways scroll, no page errors. Screenshots reviewed by eye.

**Untested / for the other AI**: real TV remote, Safari/Firefox (individual `translate`/`scale` properties need Safari 14.1+), the 202 "Installing… → Installed" pop (jenerd can't install yet), a live network graph past 48 samples, toasts (none triggered in the check), kiosk performance of the wallpaper drift on low-end hardware. Pre-existing and not changed: `style.css` line 14 has a comment naming the retired brand; Codex may want to remove it.

## 2026-10-07 - Codex - Setup preview VM refresh blocked by session access

**Requested**: sync `zimaos-style`, build 0.3.1 with RELEASE=1 TEST_SSH=1, replace the approved disposable release-test disk while preserving its VMX, boot and report LAN IP, setup code, services and warnings. Never publish this image or complete setup.

**Attempted / evidence**: working tree started clean on `zimaos-style`. Git Bash sync failed: tar could not open the repo parent (`Permission denied`) and SSH could not resolve `jeneros-build`. Retried from an explicit Git Bash `/c/Users/jener/jeneros` working directory with the same failure. Direct `ssh -o BatchMode=yes jeneros-build 'true'` also failed to resolve the alias. Reading `C:\Users\jener\.ssh\config` returned access denied in this managed session; permission escalation is unavailable. Read-only check of the existing test VMX confirmed disk name `jeneros.vmdk` and MAC `00:0C:29:8F:74:0F`.

**Changed**: this log and handoff sections 3/6 only, to record the blocker and exact remaining work. No source fixes, builds, VM stop/start, disk copies, setup actions, publication, commits or pushes. No phase boxes ticked.

**Untested / next AI**: all requested build and live-VM checks remain. Resume the seven steps in a session that can use the existing SSH config/key and write the approved test disk on S:. Require `Done: JenerOS 0.3.1` before stopping/replacing the VM. Leave setup for Jener.

## 2026-10-07 - Codex - Fail-safe kiosk text screen

**Changed**: [OS]/mkosi.extra/usr/lib/systemd/system/jeneros-kiosk.service, new jeneros-kiosk-fallback.service and plymouth-quit.service.d/jeneros.conf; new /usr/lib/jeneros/kiosk-fallback helper; [OS]/mkosi.postinst.chroot; .scratch/setup/check-kiosk-fallback.cjs; .github/workflows/checks.yml; handoff sections 3/6.

**Why / behavior**: the box crash-looped with "Could not initialize renderer" and stayed black. StartLimitBurst=3 and StartLimitIntervalSec=120 bound kiosk starts; OnFailure activates the tty1 text fallback after retries are exhausted. The fallback is a root oneshot, independent of jenerd, with tty output and no VT disallocation. Its /usr boot want() link is guarded by ExecCondition=is-failed so it does not overwrite a healthy kiosk or dev autologin. OnFailure can activate it after the normal boot condition skipped it. It expands the existing /usr/lib/issue banner, removes its graphical-only S-key instructions, and shows LAN IP, jeneros.local, chosen hostname.local and the validated six-digit /run/jeneros/setup-code. Completed setup shows dashboard links without a stale setup code; offline/missing-code cases have explicit advice. Postinst sets the helper executable and enables the fallback from /usr for A/B updates.

**Splash handoff**: removed the kiosk's early plain Plymouth quit. The /usr drop-in replaces normal plymouth-quit.service's command with quit --retain-splash so even the earlier boot quit preserves the last frame. Kiosk and fallback do not disallocate tty1 on exit. Fallback quits any surviving Plymouth with retain-splash, switches to tty1, then draws text. This uses Jener's accepted retain-splash alternative, without assuming that a running Cage process has already drawn a frame.

**Checked here**: new Node fixture passes unit section/rate-limit/OnFailure checks, /usr want()/chmod wiring, retained splash override and shell syntax. It executes only an isolated helper with fake hostname/uname/IP against workspace files, checking banner expansion, live-style IP URLs, six-digit code, invalid/missing code, container/link-local exclusion, offline text and completed setup. No real tty, systemctl, chvt or Plymouth ran. No dependencies added, images built, VMs reached, commits or pushes. No Phase 1 boxes ticked.

**Untested / other AI should check**: actual systemd boot transactions, automatic restart exhaustion and fallback activation; force three renderer failures within two minutes in a disposable release VM, confirm no later automatic retry and readable tty1 banner/code/URLs. Review every frame from splash through healthy Cage boot and failed retries on the actual GPU; retain-splash cannot prove hardware scanout continuity in a file fixture. Check completed setup, no LAN/no code, dev autologin, and /usr links/drop-in arriving after an A/B update. Fallback is a snapshot: reconnecting a cable later does not refresh its IP; the .local link remains displayed.

**Final local validation**: all eleven fixtures listed in checks.yml passed, including the new kiosk fixture. git diff --check passed. OS changes use LF without BOM. Existing handoff/log edits from the prior session were preserved.

## 2026-10-08 · Claude · Splash stays until the kiosk draws
- Added `[OS]/mkosi.extra/usr/lib/systemd/system/plymouth-quit.service.d/jeneros-retain.conf`: Debian's plymouth-quit now runs `plymouth quit --retain-splash`, so the last splash frame stays on screen until cage (or the text fallback) takes over tty1. Complements Codex's kiosk fallback.
- Untested in a VM (all VMs were off). Check on the next build: no black gap between splash and setup screen.


## 2026-10-07 - Codex - Keep setup inside the kiosk; custom setup choices

**Changed**: [DASHBOARD]/setup.html, setup.js, new setup-controls.js, onboarding.css; new .scratch/setup/check-controls.cjs; .scratch/zimaos/check-login.cjs and check-onboarding.cjs; .github/workflows/checks.yml; handoff sections 3/6. Preserved the existing kiosk-fallback changes in the working tree. No Phase 1 boxes ticked.

**Why / behavior**: the Cog kiosk has no browser Back button. Privacy now opens a modal sheet on setup, fetches the article from privacy.html (one policy source), scrolls inside the card, and keeps a large Close button visible. Close/Escape returns focus to the consent checkbox. Loading failures show Try again. Download PDF uses href=privacy.pdf plus download; it starts hidden and is shown only when BoxUI.local is false. Local policy contact text has no outgoing link. Removed the separate webpage link.

**Choices**: English is a checked radio pill with More languages soon. Keyboard and network have page-owned button/listbox comboboxes: arrow keys, Home/End, type-ahead, Enter/Space/click selection, Tab commit and Escape cancellation. Outside click/focus closes the list. Timezone keeps search with a scrollable styled listbox; Down moves from search to the list and Escape returns to search. Filtering keeps the saved timezone, including no matches, until an option is chosen. List keys stop propagation before box-ui directional navigation. Hidden inputs keep keymap/timezone/interface IDs and values; language keeps en. Explicit choice validation replaces native select required validation, including an empty network list. Modal focus isolation comes from dialog.showModal; directional navigation stays inside the sheet. Colors use the existing card/paper/ink/accent palette, flexible widths and phone spacing. No dependencies added.

**Checked**: all twelve fixtures now listed in .github/workflows/checks.yml passed locally, including the new controls fixture and the existing kiosk-fallback fixture. node --check passed for every dashboard script; git diff --check passed. Controls fixture verifies list keyboard/type-ahead/click/Tab/Escape, ARIA/selected values, filter preservation/no results, empty network, shared article loading/retry, local download/contact guard and Close/Escape focus return. Onboarding checks the unchanged submitted language/keymap/timezone/interface values and missing-timezone submission guard. No Go/OS source changed in this task, and no builds, installs, commits or pushes ran.

**Untested / other AI should check**: actual Cog/WebKit, phone touch, rendered dark/light at 320/390px and desktop widths, modal scrolling/focus isolation with a screen reader, and remote PDF download behavior. No browser surface is enabled in this session, so fake-DOM checks do not establish visual or hardware behavior. Test all of these on the next requested image; do not navigate the kiosk away from setup to read the policy.

## 2026-10-08 · Claude · Boot ordering cycle dropped jenerd
- 0.3.2 booted with jenerd inactive: `jeneros-setup-apply.path` and `jeneros-auth.socket` were ordered After=jenerd.service, but path/socket units default to Before=paths/sockets.target < basic.target < jenerd. systemd deleted jenerd's start job to break the cycle (which job it drops varies per boot, so 0.3.1 looked fine).
- Fix: removed After=jenerd from the path unit; auth socket now has DefaultDependencies=no (+ shutdown ordering). Verified on the VM with runtime overrides: `systemd-analyze verify multi-user.target` went from 4 ordering cycles to 0.
- For Codex: never put After=jenerd.service on .path/.socket/.timer units without DefaultDependencies=no; consider a CI fixture that checks this.

## 2026-10-08 - Codex - Welcome card controls and WebKit compatibility

**Changed**: [DASHBOARD]/setup.html, setup.js, setup-controls.js, box-ui.js, onboarding.css, style.css; new ui-compat.js loaded by setup/login/index/screen HTML; app.js, store.js, login.js, rollback.js and desktop.css compatibility guards. New .scratch/setup/check-welcome.cjs and check-unit-ordering.cjs; existing controls/validation/rollback/desktop/login/onboarding fixtures extended; .github/workflows/checks.yml; handoff sections 3/6. No OS/Go source changes or dependencies. Claude's committed unit fix is preserved.

**Root-cause evidence / limits**:
- The old consent markup used a resized native checkbox (24px with a top margin), not a page-owned check. Native check painting is left to the engine theme, which can disagree with the resized CSS box. Now the real checkbox and decorative box share one grid cell; a centered SVG supplies the check without text/font offsets. Theme tokens and a forced-colors rule cover contrast; the real input preserves label, keyboard and accessibility behavior.
- The phone control had no JS click handler: it relied entirely on details/summary disclosure. style.css also makes setup-phone a flex container at widths <=800px, which relies on engine-specific disclosure layout. The new button explicitly opens a sheet; it retains the BoxUI.local guard, refreshed QR/LAN/hostname.local links and code. Close/Escape return focus. A missing-network/code state is visible; the code remains readable while offline. No native disclosure or dialog API is required.
- setup.js contained a regex lookbehind literal: an engine without it cannot parse any of setup.js. replaceAll during choice loading could also throw inside load's catch, disguising a client failure as a connection failure. The next button stayed natively disabled when choices/code were missing, so its explanatory submit checks could not run. These are file-level failure paths, not a confirmed trace from the current Cog VM. The existing novalidate form, checked non-required English radio, type=hidden pickers and step-scoped validation do not support blaming a hidden required language control. Removed lookbehind/TextEncoder dependence (Unicode/UTF-8 limits still enforced), replaced newer string/array APIs, scoped owner validation to the account step and guarded partial animation support. Invalid steps remain clickable and explain consent, code, unloaded choices, invalid fields or missing custom choices inline; applying setup still blocks duplicate submission. Welcome only checks consent and code.

**Shared compatibility**: ui-compat uses native showModal/close when both exist; otherwise it opens an in-page modal with a backdrop, focus trap, Escape/cancel/close lifecycle, focus return and method=dialog submission for rollback. BoxUI arrow navigation stays inside the open sheet. replaceChildren has a guarded fallback. AbortSignal.timeout is feature-checked in login/dashboard/store (older engines send the request without that optional timeout). Removed :has in setup/network/wallpaper selection in favor of selected classes. No structuredClone or CSS nesting exists in these dashboard sources. vh provides a fallback before dvh on onboarding/sheets.

**CI / checked**: all fourteen fixture scripts listed in checks.yml ran locally and passed; node --check passed for every dashboard script; git diff --check passed. The new Welcome fixture derives controls from setup.html, runs real startup with newer APIs missing, and checks consent-only advance despite empty required account fields, manual code/Enter path, exact inline consent/code/offline reasons, local-vs-remote guard, QR/IP/jeneros.local/code, native and fallback sheet Close/Escape/focus/Tab, policy fallback and checkbox grid/SVG markup. Password fixtures cover UTF-8 limits, emoji and lone high/low surrogates. Login sends its request without AbortSignal. Unit fixture checks activation-unit files and per-unit drop-ins (including drop-in-only distro units), section/continuation/reset semantics and requires DefaultDependencies=no (or an equivalent false value) whenever effective After includes jenerd.service. Synthetic positive/negative cases prove the condition detects the cycle risk. Existing shell fixtures only use fake services/workspace copies.

**Untested / other AI should check**: no VMs were reached and no OS image was built; no installs, admin commands, commits or pushes. File/fake-DOM fixtures do not prove rendered alignment or native engine behavior. Jener/Claude should test the actual Cog/WPE software-rendered 1280x800-ish kiosk and Chromium/Firefox in light/dark, keyboard/mouse, phone widths, live address refresh, policy scrolling and modal accessibility. Confirm Continue advances with only privacy ticked and the kiosk-provided code; confirm missing consent/code shows the stated reason. Review fallback dashboard/store/rollback dialogs too. Real systemd ordering verification remains a VM check (Claude's prior fix remains unchanged). No Phase 1 boxes ticked.

## 2026-10-08 - Codex - 0.3.4 Welcome follow-up and PC wallpapers

**Changed**: [DASHBOARD]/style.css, onboarding.css, setup.js, ui-compat.js; .scratch/setup/check-welcome.cjs and new check-welcome-browser.cjs / welcome-browser.js; .github/workflows/checks.yml; new [BRAND]/wallpapers/ (four SVGs, regenerate.cjs, README.md); handoff sections 3/6 and this log. No Phase 1 boxes ticked.

**Consent**: replaced the 24px grid overlap with an explicit positioned, transparent native 44x44 input covering the centered custom box. Pointer events are enabled on the input and disabled on the box, its SVG/path descendants and wrapper pseudo-elements. The containing label still toggles from text; the policy link keeps its separate policy action. No custom keyboard handler replaces native Space behavior.

**Phone sheet / evidence**: scripts already defer until markup exists. Inspection found renderPhone() invoked the real QR encoder before modal opening, without catching encoder errors. The encoder depends on TextEncoder; an unavailable encoder or oversized QR URL can throw and abort the click. Opening now happens first; QR failures leave the live addresses/code visible with a useful instruction. The shared modal helper clears hidden state, moves sheets to body to escape card transform/blur contexts, checks actual computed display/visibility and geometry after showModal, and falls back when it throws, does nothing or stays invisible. Closed setup sheets explicitly display none; open sheets explicitly restore flex/visibility/opacity. Close, cancel/Escape and focus return are preserved.

**Root-cause limit**: ran the rendered fixture against original HEAD assets as well as changed files. Original assets failed the 44px input-size assertion and failed visible-sheet assertions with the real QR encoder's TextEncoder removed. Normal original native/fallback/throwing-modal phone cases opened in local Chromium before failing on checkbox size. Thus the QR-error path is reproduced, but it is not a confirmed explanation for every failure Jener saw in Cog and desktop Chromium on image 0.3.4. No live 0.3.4 console, loaded-asset comparison or hardware trace was available; do not label hypothetical stacking/early-binding causes as confirmed.

**Rendered fixture**: stdlib-only HTTP runner launches an already installed browser, serves actual HTML/CSS/deferred scripts and QR encoder, and fakes only the API. CI uses preinstalled google-chrome; WELCOME_BROWSER selects a local executable. It checks computed display/visibility/opacity and onscreen geometry, elementFromPoint on the checkbox and Close button, addresses/code/real QR, focus entry/return and Close/cancel/fallback Escape. Twenty cases: dark/light x 1280/390px x native/missing/throwing/no-op showModal/real QR failure. It also tests opening from a leftover hidden state. Native Escape is tested through its cancel event; a physical key and trusted keyboard Space still need live review. An initial headless Zen attempt timed out; the installed EdgeCore Chromium executable ran every case successfully. No packages or browsers installed.

**Wallpapers**: exact 3440x1440 and 2560x1440 SVGs in warm dark and cream light. Embed and widen the setup ribbon art without crop; cream applies the same .23 ribbon opacity. The original monochrome angular J uses the wizard corner mark's 28px canvas scale and .7 opacity; accounting for logo canvas padding puts its painted right edge 40px from the right and painted bottom edge 80px above the bottom (48px taskbar + 32px gap). Self-contained backgrounds/gradients/paths, no external references. README gives sizes and the dependency-free Node regeneration command. PNG export is left to Claude on the build VM, with outputs on S:.

**Checked**: all fifteen fixture runners now in checks.yml passed, including all twenty rendered Chromium cases; node --check passed on dashboard JS; SVG XML parsed with declared sizes verified; git diff --check passed. Existing service fixtures ran only workspace copies/fake services. No Go/OS source or dependencies changed. Files only: no builds, VM actions, installs, commits or pushes.

**Other AI should check / untested**: actual Cog/WPE and physical mouse/touch/Space/Escape on the next authorized image, policy and other shared modal callers, live network refresh and screen-reader focus isolation. If the phone failure remains, collect its console exception and actual loaded setup/ui-compat/QR assets. Claude should render the four SVGs to PNG and check the two native-resolution screens and Windows taskbar clearance. No PNGs were rendered here.

## 2026-10-08 - Codex - Confirmed missing kiosk click; restrained setup/login shine

**Root cause (Claude's real-box trace, relayed by Jener)**: image 0.3.5, Cog 0.18.4 with libwpewebkit-2.0 2.48.3, inside Cage on tty1 in VMware. Both #acceptedPrivacy and #phoneCard receive pointerdown, mousedown, pointerup and mouseup on the correct element; elementFromPoint agrees. The browser never dispatches click. This explains the untoggled checkbox and uncalled button handlers. Earlier CSS, hit-area and dialog hypotheses were not the cause of this traced failure. No new VM investigation was performed here.

**Click fix**: [DASHBOARD]/ui-compat.js (already loaded by setup.html, login.html, screen.html and index.html) records primary pointer gestures lasting at most 600ms with movement below 10px throughout. The release must hit the same control or its associated label, including shared interactive ancestors. A setTimeout(0) gives native click dispatch time to cancel the fallback; a microtask would be too early. Otherwise element.click() preserves checkbox/radio/label, summary, link and form activation defaults. Capture-phase click matching prevents repair where native clicks work; a narrow trusted/coordinate/pointer/time guard consumes a late physical duplicate after repair. Keyboard and script activations remain available. Text entry, modifiers, disabled/inert controls, drags, scrolling, pointercancel, secondary buttons/pointers, removed controls and prevented pointer gestures are excluded. The visibility flag is initialized on load too.

**Shine**: new [DASHBOARD]/onboarding-shine.js and wallpaper-shine-mask.svg; onboarding.css; setup.html and login.html. The two-page wallpaper stays stationary. A 200x240 radial-gradient light passes over a static mask of the ribbon edges on a 16s loop; a 128x2 linear-gradient highlight moves along the card's top border on an 18s loop. Both use desktop.css's --ease and only change transform/opacity, at most about 29 updates/sec via a 34ms timer driving paused Web Animations. Peak opacity .12/.2; light wallpaper gets another .45 multiplier. Hidden documents stop the timer without accumulating elapsed time. Reduced motion/transparency, increased contrast and forced colors cancel and hide the lighting; preference changes are observed, with legacy addListener support. Missing/partial animation support falls back to static art. No GIF, animated blur, new dependency or layout animation. Motion brief and handoff sections 3/6 updated; Phase 1 boxes unchanged.

**Fixtures / checked**: added .scratch/setup/check-click-shim.cjs, click-shim-browser.js, check-shine.cjs and shine-browser.js to .github/workflows/checks.yml, reusing the stdlib check-welcome-browser.cjs runner. Runner now supplies an unauthenticated login API response and bounds each frame's wait (the first login fixture exposed its previous all-200 mock redirect). All seventeen workflow fixtures pass locally with installed Edge/Chromium; dashboard JS syntax and git diff --check pass. The 48 rendered cases comprise 20 existing Welcome cases, four click-shim theme/width cases and 24 setup/login shine cases (dark/light, 1280/390px, normal/reduced-motion/reduced-transparency at startup). Click checks dispatch pointer/mouse sequences with and without click, verify one default toggle/change, native-shim silence, controls/links/summary, drags/cancel/long press/disabled/detached targets, and the real consent/phone open/Close handlers. A separate modeled-trust check covers a delayed physical duplicate (browser JS cannot manufacture isTrusted). Shine checks cover bounds, timing/easing/properties, sampling cadence, hidden-tab pause/resume and live preference changes. Existing shell fixtures used only fake services/workspace copies.

**Untested / other AI should check**: on the next authorized image, repeat the Cog trace and confirm exactly one activation/change for mouse taps, labels, phone/policy sheets, Continue, custom choices and all shared dashboard/login/screen controls. Physical keyboard/touch, Firefox and phone browsers still need checks; synthetic Chromium events are not hardware traces. Review shine appearance and measure idle CPU/frame cost under WLR_RENDERER=pixman; the small animated layers and timer cap do not prove software-compositor cost. No builds (including Go), installs, admin commands, VM access, commits or pushes ran. Files only, as requested.

## 2026-10-08 - Codex - Near-free kiosk lighting after 0.3.6 CPU report

**Why**: Jener relayed Claude's measurement of 80-120% WPEWebProcess CPU while setup sat idle on image 0.3.6, Cog on tty1 with WLR_RENDERER=pixman. The old shine kept a 34ms JS clock and a full-screen masked wallpaper layer active. Small animated children did not make that software-rendered composition cheap enough.

**Changed**: [DASHBOARD]/onboarding-shine.js, onboarding.css, setup.js, setup.html, login.html and style.css; new .scratch/setup/check-kiosk-shine.cjs and kiosk-shine-browser.js; updated check-welcome-browser.cjs, .scratch/zimaos/check-onboarding.cjs and .github/workflows/checks.yml; handoff.md sections 3/6 and this log. No dependencies or Go/OS source changes. No Phase 1 boxes ticked.

**Behavior**: BoxUI.local selects a separate local path before any wallpaper light is created. Setup loads BoxUI before shine; login now also loads BoxUI. Local pages only animate the existing 128x2 top-border highlight, once for 1.8 seconds on load and once per actual setup step change. The finite Web Animation only changes transform/opacity, has no JS clock and cancels its effect on completion. Repeated requests cancel the previous effect. Hidden/pagehide and accessibility preference changes cancel it; resizing, returning or relaxing a preference do not restart it. Same-step input/rendering does not replay shine. Local CSS animations, including the applying pulse, are disabled. Remote setup/login retain the existing two continuous lights, timing and preference behavior. screen.html has no shine script/layers; its shared CSS now explicitly disables animations for that permanent status screen, including non-local viewing.

**Blur check**: source inspection found setup/login/screen cards already use opaque --card colors and do not currently apply backdrop-filter. Explicit local card/sheet and screen card/dialog rules now enforce opaque tint and no standard or WebKit backdrop filter. The kiosk border has no filter, blur or mask. No animated full-screen gradient or masked wallpaper layer remains locally. Existing status/network polling remains.

**Checked**: all 18 fixture runners listed in checks.yml passed locally using the installed Edge/Chromium, plus dashboard JavaScript syntax and git diff --check. The new fixture checks localhost/IPv4/IPv6 loopback detection against LAN names/addresses, rejects any lighting timeout/interval/requestAnimationFrame in an isolated controller, and verifies one-shot cleanup/replacement. Its 36 rendered cases cover setup/login/screen, two widths and initial normal/reduced-motion/reduced-transparency settings; setup/login use both themes (screen retains its system color scheme). Every element and pseudo-element is inspected for infinite CSS animations; all Web Animations must be finite; no animation effects remain after settling. Actual Continue starts one new sweep, ordinary input does not, and preference/visibility/page lifecycle checks leave the kiosk idle. The existing 24-case remote suite explicitly selects BoxUI.local=false on its loopback fixture server and preserves the continuous behavior. Original HEAD assets fail the new setup check because they create the full-screen masked light; baseline login lacks BoxUI, while baseline screen already settles without animation. The onboarding mock was extended with the optional shine callback and checks for one request per step. Shell fixtures used only fake services/workspace copies.

**Untested / other AI should check**: the under-5% idle CPU target is not yet measured on Cog/WPE/pixman. On the next separately authorized image, measure WPEWebProcess for at least 60 seconds after settling on Welcome, Create account and screen.html. Confirm the single gentle border sweep, stationary wallpaper and opaque cards in both themes; verify the existing mouse/consent/phone controls and remote continuous shine. Chromium lifecycle checks do not establish software-renderer CPU cost. Files only: no image or Go builds, installs, admin actions, VM access, commits or pushes.

## 2026-10-08 · Claude · Follow-ups after Codex hit its usage limit
- Updates: when the release feed answers 404 (nothing published yet), the root update script writes `noRelease:true` instead of an error; dashboard says "You're on the newest version. No updates have been published yet." and the SSH greeting says "No updates published yet". Real outages still show the offline message.
- Setup password fields now use the same in-field eye toggle as login (removed the "Show passwords" pill).
- Icons: login/setup loaded the sprite by fetching index.html, which redirects to /login when signed out, so their icons were blank. Added public `[DASHBOARD]/icons.svg` (mirror of the index.html sprite) and `.scratch/setup/check-icons-public.cjs` (in CI) to keep them identical.
- Notice "clipped card" was a mid-slide screenshot, not a bug.

## 2026-10-08 · Claude · Owner password minimum is 6 characters
- Jener asked for 6 instead of 8. Changed `[CORE]/internal/setup/setup.go` (server rule + message), `[DASHBOARD]/setup.js` (inline error), `setup.html` (help text), Go tests and `.scratch/setup/check-validation.cjs` (5 fails, 6 passes). Login has no minimum, so nothing else changes.

## 2026-10-08 · Claude · Phone settings sheet, badge, watermark, dashboard shine
- Phone Settings: tabs are one clean scrollable row of pills; Power is an icon at the end (label kept for screen readers).
- "Free, for everyone" tag now centered on the JenerOS line.
- Phone sheets get a real grabber (`phone-layout.js`); dragging it down >80px closes through the sheet's own close button.
- Phone: the corner J becomes a static footer under the page, so it never sits over cards (it was already click-through).
- Shine: moved to shared `shine.css`; `onboarding-shine.js` now also runs on the dashboard in remote browsers only. The box screen never loads it (and the kiosk shows screen.html).
- Hot-loaded onto the 0.3.8 test VM with a bind mount for Jener to try; next image build includes it.

## 2026-10-08 · Claude · PC Settings layout fix
- The phone grabber div was a grid child of the PC Settings window, pushing sidebar/body into the wrong cells. `.sheet-grabber` is now display:none outside the phone media query.
- index.html loaded ui-compat.js with defer, so it ran after app.js; opening /#/settings directly threw "JenerUI is not defined". It now loads before app.js.
- Seen in Chrome: before live data arrives, Settings briefly shows sample values (LAN 192.168.1.20). Should show neutral placeholders on a real box; small follow-up.
