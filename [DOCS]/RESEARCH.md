# How self-hosting OSes are built (research, 2026-10-07)

## The four ways people build these

| Approach | Who uses it | How | Fit for JenerOS |
|---|---|---|---|
| **Buildroot appliance** | ZimaOS, Home Assistant OS | Compile every package from source into a tiny read-only image; RAUC A/B updates | ❌ Too much work for one person |
| **Debian + custom build scripts** | TrueNAS (`truenas/scale-build`) | debootstrap a Debian system, add their packages, pack into squashfs + boot environments | ⚠️ Works, but they wrote their own tooling over years |
| **mkosi image-based (systemd way)** | **IncusOS**, ParticleOS, GNOME OS | Config files → signed disk image. Read-only `/usr` + dm-verity, A/B via `systemd-sysupdate`, apps as `sysext` | ✅ **What we picked** |
| **bootc / bootable containers** | Unraid 8 (uCore), Fedora/RHEL image mode | Write a Containerfile; the OS *is* a container image; updates = pull new image | ⚠️ Good, but Fedora/RHEL-centric; ZFS lags new Fedora kernels |

## IncusOS — the closest existing project

Launched Nov 2025 by the Incus team. Apache-2.0: we can learn from it and reuse pieces with attribution.
Repo: github.com/lxc/incus-os

| Part | IncusOS does | JenerOS takeaway |
|---|---|---|
| Base | Debian 13 + **Zabbly** kernel, ZFS, Incus builds | Same. Zabbly ships ZFS modules prebuilt for its kernel → **no dkms build in our image** |
| Build | mkosi, `ToolsTree=default`, `SplitArtifacts=yes`, `UnifiedKernelImages` | Same pattern |
| Disk layout (`mkosi.repart/`) | `esp` 2 GB · `seed-data` 100 MB · `usr` 1 GB **erofs** + `usr-verity` + `usr-verity-sig`. Root is **not** in the image — created on first boot, encrypted | Copy this layout. 2 GB ESP fits several kernel images for A/B |
| Updates | `systemd-sysupdate`, A/B `usr` partitions, rollback | Same |
| Add-ons | Each app (incus, gpu-support, debug, ceph…) is a **sysext** image layered on the read-only `/usr` | JenerOS "extensions": router mode, GPU drivers, debug tools as sysexts → base stays small |
| First-boot config | A **seed partition** with config files → install with no screen/keyboard | Add a seed option next to the dashboard wizard (headless installs on Pis/old PCs) |
| Security | Secure Boot + **TPM 2.0 required**, encrypted root, signed verity | ⚠️ Old PCs often lack TPM 2.0 → JenerOS makes these **optional**, on when hardware supports them |
| CPU | Requires x86-64-**v3** (Haswell / 2013+) | ⚠️ JenerOS targets older machines → stay on baseline x86-64 |
| Access | **No shell at all**, API only | JenerOS keeps SSH for power users, but the dashboard/API is the main way |
| Kernel cmdline | `systemd.image_policy=esp=unprotected:usr=signed:root=encrypted+absent:...` | Use a relaxed policy when Secure Boot/TPM are absent |

## Building blocks (all part of systemd, all in Debian 13)

| Tool | Job |
|---|---|
| `mkosi` | Builds the image from config |
| `systemd-repart` | Partitions at build time **and** grows/creates partitions on first boot |
| erofs + dm-verity | Read-only, compressed, tamper-evident `/usr` |
| UKI (unified kernel image) | Kernel + initrd + cmdline in one file; one file per OS version on the ESP |
| systemd-boot boot counting | Tries a new version N times; falls back automatically if it never boots cleanly |
| `systemd-sysupdate` | Downloads the next `/usr` + UKI into the B slot |
| `systemd-sysext` | Layers extra read-only images on top of `/usr` (our extensions) |
| `systemd-firstboot` | Hostname, timezone, root setup on first boot |

## What changes in our plan (proposal — needs Jener's OK)

1. **Phase 1 M2**: switch the image to the IncusOS-style layout (usr-only image, erofs + verity, root made on first boot) instead of the default single root partition.
2. **Phase 1 M3**: get kernel + Incus from Zabbly. ~~ZFS~~ → **superseded**: data pools are btrfs or ext4/XFS + mergerfs + SnapRAID so disks work on any Linux (see STORAGE.md). ZFS import-only.
3. **New**: extensions as sysexts (router, GPU, debug).
4. **New**: seed partition for headless installs.
5. Secure Boot / TPM / disk encryption: supported, **not required** (differs from IncusOS on purpose).
6. M1 stays as is: a simple single-root image to prove the basics boot first.

## Sources
- IncusOS announcement: https://stgraber.org/2025/11/07/introducing-incusos/
- IncusOS repo: https://github.com/lxc/incus-os
- ParticleOS (systemd's reference image-based OS): https://itsfoss.com/news/systemd-particle-os/ · FOSDEM 2026 slides: https://fosdem.org/2026/events/attachments/DVVAV9-particle-os-from-trad-distro-to-immutable-image/slides/267652/fosdem_20_tcaoshr.pdf
- Signed image-based OS with updates (All Systems Go 2024): https://cfp.all-systems-go.io/all-systems-go-2024/talk/LJAYYL/
- systemd-sysupdate + repart walkthrough: https://x86.lol/generic/2024/08/28/systemd-sysupdate.html
- TrueNAS build system: https://github.com/truenas/scale-build
- bootc / image mode: https://developers.redhat.com/articles/2025/01/21/how-image-mode-rhel-simplifies-software-appliances
- Debian UKI: https://wiki.debian.org/UKI
