# JenerOS — Handoff

Written by Claude for whoever picks this up next (Claude, ChatGPT, Codex, or Jener).
Last updated 2026-10-07. Read this file first, then [AGENTS.md](AGENTS.md).

## 1. Goal

JenerOS is an installable OS that replaces a pile of self-hosted apps with one system:
photos (Immich), files (Nextcloud), smart home (Home Assistant), TV (Jellyfin),
network ad-blocking (AdGuard Home / Pi-hole), VMs + storage (Proxmox + TrueNAS),
an optional router mode, and its own app store. One install, one login, one storage
pool, one dashboard. "iCloud, on your own hardware."

Runs on old PCs, mini PCs, Raspberry Pi 5/4 and VMs. Fire TV / Android TV get a
client app (they can't run the OS).

## 2. Who's who

| Who | Role |
|---|---|
| Jener (owner) | Decides direction, does installs/purchases/sign-ups, tests on real hardware |
| Claude (Claude Code) | Main builder: architecture, code, OS image, docs |
| ChatGPT / Codex | Reviewer and second builder: reviews changes, takes tasks from `[DOCS]/PHASE-1.md` |

The company is **Jener, Inc.** (not yet formed). Public site: **jener.dev** (owned,
Cloudflare Registrar, bought 2026-10-07; site intentionally offline for now).
Code will be public at **github.com/PrimeExtremo/jeneros** (Jener's own account).
Company socials planned as **@jener_inc**. Jener's personal accounts are NOT changing.

## 3. Current state (2026-10-07)

**Phase 0 (skeleton) — done, not yet committed.**
- `[CORE]/` — `jenerd` daemon in Go (stdlib only). Serves `/api/system`, `/api/store`,
  `POST /api/apps/{id}/install` (returns 501 until Phase 2), and the dashboard.
  **Never compiled yet** — Go isn't installed on Windows; first compile happens in the build VM.
- `[DASHBOARD]/` — static HTML/CSS/JS. Works with sample data when `jenerd` isn't
  running. Verified visually in a browser. Still the original blue/purple look;
  the arvey.co restyle hasn't happened yet.
- `[STORE]/apps/` — 5 manifests: photos, drive, home, tv, relay. Codex review fixes
  applied (Nextcloud `POSTGRES_DB`/`POSTGRES_USER`; Immich `IMMICH_MACHINE_LEARNING_URL`).
- `[SPEC]/app-manifest.md` — store manifest format v1.

**Phase 1 (bootable image) — M1 + M2 work (2026-10-07).** JenerOS boots in VMware (`S:\[VMs]\[JENEROS]`, currently 0.2.1 at http://192.168.27.134), read-only verified `/usr` in A/B slots, root grows to fill the disk, updates install from the build VM's update server (`[OS]/serve-updates.sh`, port 8000) and a broken update rolls back automatically. Commits on `main`. Codex review of M1+M2 pending.
- `[OS]/mkosi.conf` — Debian 13 trixie, amd64, UEFI + systemd-boot, DHCP, SSH, jenerd on :80.
- `[OS]/build.sh` — builds jenerd → mkosi image → VMware `.vmdk` in `S:\[VMs]\[JENEROS]`.
- `[OS]/setup-build-vm.sh` — installs mkosi, Go, qemu-utils in the build VM.
- `[OS]/vmware/jeneros.vmx` — VM definition (UEFI, 4 GB, 2 vCPU, NAT, nested virt on for Incus VMs later).
- **Build machine = a Debian 13 VM in VMware** (`S:\[VMs]\[JENEROS-BUILD]`), reached over SSH.
  WSL was tried and dropped (2026-10-07): WSL2 needs the Windows hypervisor, which slows VMware and Jener's lab VMs.
- **Blocked on:** Jener uninstalling WSL + rebooting, then installing the build VM.

## 4. Decisions (don't reopen without asking Jener)

| Decision | Choice | Why / where |
|---|---|---|
| Base OS | Debian 13 "trixie" | Same base as TrueNAS 26, Proxmox 9, umbrelOS. See `[DOCS]/OS-PLAN.md` §1–2 |
| Image build | mkosi | Reproducible disk images from a config file |
| Updates | Immutable root, A/B partitions, systemd-sysupdate, auto-rollback | Phase 1 milestone 2 |
| Apps + VMs | Incus 7.0 LTS (OCI app containers, LXC, KVM) | Replaces Docker AND Proxmox's engine. No Docker daemon on the OS |
| Storage | **Portable by design**: btrfs pools (single/mirror/raid1c3/raid10, never raid5/6) or "simple disks" (ext4/XFS per disk + mergerfs + SnapRAID). ZFS = import existing pools only | Jener's rule: data disks must work on any Linux without wiping. See `[DOCS]/STORAGE.md` |
| Core daemon | Go, stdlib only so far | Single static binary, easy arm64 cross-compile |
| Brand look | arvey.co's look (cream paper, charcoal ink, PLA-orange `#FF5A1F`, hard offset shadows, Lemon Milk wordmark) | Arvey **name and AV logo are retired** — never use them |
| Name | JenerOS by Jener, Inc. | "Labs" rejected; personal handles off-limits |

## 5. Hard rules

1. **Nothing goes on C: except programs.** VM disks, ISOs, build output for VMs →
   `S:\[VMs]\...`. (Jener's homelab rule.) The repo itself lives at `C:\Users\jener\jeneros`.
2. Folders on Jener's drives use `[BRACKET]` names. In PowerShell use `-LiteralPath`
   (brackets are wildcards); in bash, quote the path.
3. Jener does installs, purchases, account sign-ups and anything admin/system-level.
   AIs prepare commands and explain; they don't run them.
4. Don't commit or push unless Jener asks. Repo has **no commits yet**.
5. Don't use the Arvey name or logo anywhere in JenerOS.
6. Data disks must stay readable by any Linux: no ZFS by default, plain top-level folders, LUKS2 with a recovery key.
7. Router mode ships last (Phase 7) — a bug there takes the house offline.
8. After every change, append a short entry to `[DOCS]/AI-UPDATES.md` so the other AI knows.

## 6. Next steps (in order)

1. **Jener:** uninstall WSL, reboot, install the Debian build VM (`[DOCS]/PHASE-1.md` steps 0a–0b).
2. ~~Claude: first builds~~ done — M1 and M2 complete.
3. **Jener:** open `S:\[VMs]\[JENEROS]\jeneros.vmx` in VMware, boot it, confirm the
   console shows `Dashboard: http://<ip>` and the dashboard loads from Windows.
4. **Codex:** review the first working build (everything is still uncommitted).
5. Then Phase 1 milestones 2–5 in `[DOCS]/PHASE-1.md`.

## 7. Open questions for Jener

- First real hardware to test on after the VM (which spare PC / Pi)?
- Restyle the dashboard in the arvey.co look now, or after the image boots?
- Make the first git commit now so Codex can review a commit instead of a working tree?

## 8. File map

| Path | What |
|---|---|
| `handoff.md` | This file |
| `AGENTS.md` | Rules for any AI working here (Codex reads it automatically) |
| `CLAUDE.md` | Points Claude Code at AGENTS.md |
| `[DOCS]/ARCHITECTURE.md` | Full system design |
| `[DOCS]/BUILD-VM.md` | How the Debian build VM was set up + SSH access |
| `[DOCS]/STORAGE.md` | Portable storage design (btrfs / simple disks, no ZFS by default) |
| `[DOCS]/RESEARCH.md` | How other self-hosting OSes are built; IncusOS lessons |
| `[DOCS]/OS-PLAN.md` | OS base research + decisions, naming, brand tokens |
| `[DOCS]/PHASE-1.md` | Step-by-step Phase 1 task list with owners and "done" checks |
| `[DOCS]/ROADMAP.md` | All phases |
| `[DOCS]/AI-UPDATES.md` | Running log of what each AI changed (newest at bottom) |
| `[SPEC]/app-manifest.md` | Store app format |
| `[CORE]/` | `jenerd` (Go) |
| `[DASHBOARD]/` | Web UI |
| `[STORE]/apps/` | Store catalog |
| `[OS]/` | Image build (mkosi config, overlay files, scripts, VMware template) — runs in the build VM |
| `[BRAND]/` | Brand tokens + future logo files |
| `[CLIENTS]/` | Future TV / phone apps (empty for now) |
