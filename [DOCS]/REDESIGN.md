# JenerOS redesign: the Green and everything else

Status: plan, 2026-10-27. Nothing below is built yet.

## Goal

One JenerOS that installs on a Home Assistant Green, any ARM64 board with UEFI, and
any x86-64 PC or VM, and that is good enough to share: it boots on real hardware,
apps really install, it is secure by default, and it looks as calm and minimal as
ZimaOS or Umbrel.

## What stays

The base is sound and is kept: Debian 13, mkosi, A/B read-only `/usr` with
dm-verity, systemd-sysupdate with rollback, `jenerd` (Go, stdlib), Incus for apps
and VMs, the static dashboard. The redesign changes how it boots on more hardware,
finishes what is half-done, and rebuilds the look.

## Phases

Each phase ends with something tested on a real machine before the next starts.

### 1. Builds for ARM64 (no hardware risk)

- `mkosi.conf`: per-architecture sections; `linux-image-arm64` on arm64.
- `build.sh`: `GOARCH` from the target; one command builds `x86-64` or `arm64`.
- Incus: check Zabbly's arm64 packages for trixie; keep the pinned key check.
- Done when an arm64 image builds and boots in QEMU (`qemu-system-aarch64`, UEFI).

### 2. Boots on the Green from microSD (eMMC untouched)

What the UmbrelOS port proved (see the umbrelos-green repo):
- Nabu Casa's Green U-Boot at sector 64.
- U-Boot did not run GRUB's EFI config. systemd-boot under U-Boot's EFI is untested;
  extlinux is the known-good fallback.
- Kernel argument `gpt`, because Windows rewrites the SD card's primary GPT.
- No `sd-uhs-sdr104` on the SD controller.

Open question: A/B slots with extlinux. With systemd-boot working, the existing UKI +
boot counting carries over unchanged. With extlinux, use U-Boot's `bootcount` and two
labels. Decide after testing systemd-boot first.

Done when JenerOS boots from SD on the Green, the dashboard opens over the network,
and a sysupdate + rollback cycle works.

### 3. Finish the half-built parts (on the Green and in a VM)

- Go: compile, vet, test (never run yet for the Codex security/app pass, commit 63eacc9).
- Run `.scratch/apps/VM-CHECKS.md`: real app installs through Incus.
- Security: review the Codex pass, then the defaults (HTTPS on first boot, login rate
  limits, firewall, no default passwords, automatic updates).
- Fix broken icons and dead controls in the dashboard.

### 4. New look

Rebuild the dashboard's visual layer around one quiet home screen: app grid, storage
and health at a glance, settings in one place. Brand assets stay (never Arvey).
Mockups first, approved by Jener, then code.

Direction from Jener (2026-10-27), in the spirit of UmbrelOS and iOS 26, not copies:
- Animated boot/splash screen with the JenerOS mark.
- Rounded everything; frosted "liquid glass" panels with backdrop blur over a
  colourful wallpaper; a fine nano-grain texture on surfaces.
- On the Green, the home screen IS the smart home: Home Assistant (installed as the
  Home app) is surfaced through JenerOS-style glass cards (rooms, lights, climate,
  energy) via HA's API, with the full HA UI one tap away. Other apps sit below.
- Mockup: https://claude.ai/artifact/HTJpucMUNrvZptTyVptxPr

### 5. Installer and sharing

- Green: SD installer that writes the eMMC and verifies it, as in umbrelos-green.
- PCs and VMs: ISO/USB image.
- Public docs, release images, checksums.

## Later

UEFI firmware for the Green (port of jaredmcneill/quartz64_uefi), which would let
generic Linux ISOs, and experimentally Windows 11 on ARM, boot on it. Separate
project; JenerOS does not depend on it.

## Rules

Builds and VM disks go to `S:\[VMs]`, never C:. Jener does installs and admin actions.
No commits or pushes without asking. The Green's eMMC is written only by a tested
installer, with Jener's go-ahead.
