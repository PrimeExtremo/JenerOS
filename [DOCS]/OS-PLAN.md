# OS plan (planning only, nothing built yet)

Product: **JenerOS** by **Jener, Inc.** — see §7.

## 1. What the others are built on (October 2026)

| OS | Base | How it updates | Apps / VMs | Lesson for us |
|---|---|---|---|---|
| TrueNAS 26 | Debian, Linux 6.18 LTS, OpenZFS 2.4 | Whole-image updates, boot environments | Docker apps; **Incus** for VMs + LXC (since 25.04) | Debian + ZFS + Incus is a proven NAS stack |
| Proxmox VE 9.1 | Debian 13 "trixie", own 6.17 kernel | apt (mutable) | KVM/QEMU, LXC, now LXC from OCI images | Debian is the hypervisor standard; apt-updates are fragile for non-experts |
| ZimaOS | Buildroot, read-only root | OTA image updates | Docker | Appliance feel is great, but they hand-maintain every package |
| Home Assistant OS | Buildroot | RAUC A/B slots | Docker (Supervisor) | A/B updates with rollback = safe for non-experts |
| umbrelOS | Debian | Image updates | Docker | Debian works fine for a "home cloud" product |
| Unraid 8 | Moving Slackware → Fedora uCore (immutable) | Atomic image | Docker Compose | Even Unraid is moving to an immutable, mainstream base |

Everyone serious is converging on: **mainstream distro + read-only image + atomic/A-B updates.**

## 2. Decision: base OS

**Debian 13 "trixie", built into an immutable image with mkosi, A/B updates.**

| Option | Verdict | Why |
|---|---|---|
| **Debian 13 + mkosi image** | ✅ Pick | Same base as TrueNAS + Proxmox + Umbrel; amd64 + arm64; ZFS packaged; Incus packaged; 5-year support; one person can maintain it |
| Buildroot (ZimaOS, HAOS) | ❌ | You maintain every package and driver yourself — a team job |
| Fedora uCore (Unraid 8) | ⚠️ Backup option | Nice immutable tooling, but ZFS often lags new Fedora kernels; 6-month churn |
| NixOS | ⚠️ Backup option | Best rollback story, but steep learning curve and harder to make "appliance-simple" |
| Alpine | ❌ | musl breaks too many apps/drivers |

## 3. The stack

| Part | Choice | Replaces |
|---|---|---|
| Kernel | Debian 6.12 LTS; backports kernel for very new hardware | — |
| Updates | `systemd-sysupdate` A/B root partitions, auto-rollback via `systemd-boot` boot counting | apt upgrades |
| Root FS | Read-only erofs/squashfs + dm-verity (tamper-proof) | — |
| Storage | btrfs pools or ext4/XFS + mergerfs + SnapRAID — any Linux can read the disks (see STORAGE.md). ZFS import-only | TrueNAS |
| Apps + VMs | **Incus 7.0 LTS** (supported to June 2031): OCI app containers, LXC, KVM VMs | Docker, Proxmox |
| Network | systemd-networkd, nftables, WireGuard | pfSense / router firmware |
| DNS / adblock (Relay) | AdGuard Home app first → native later | Pi-hole |
| Remote access | WireGuard mesh, Tailscale-compatible (Headscale) | wg-easy, port forwards |
| Reverse proxy + TLS | Caddy (automatic HTTPS) | Nginx Proxy Manager |
| Core | `jenerd` (Go) | CasaOS/ZimaOS UI |

## 4. Disk layout

```
Boot disk (SSD / USB / SD card, ≥32 GB)
├─ ESP          512 MB   systemd-boot + kernels (A and B)
├─ root-A       4 GB     read-only system image
├─ root-B       4 GB     next update is written here
└─ var          rest     settings, app data, Incus storage if no pool disks

Data disks (optional, any number)
└─ pool  btrfs mirror/raid1c3, or simple disks (ext4/XFS + parity)
   ├─ Photos/  Files/  Media/  Backups/   ← plain folders any Linux can open
   └─ .jeneros/   app databases, VM disks, settings
```

The OS can be wiped and reinstalled without touching your data disks.

## 5. Hardware targets

| Target | Image | Notes |
|---|---|---|
| x86-64 PC / mini PC / old OptiPlex | USB installer (ISO) + raw image | Main target, full features |
| VM (VMware, Proxmox, Hyper-V) | `.vmdk` / `.qcow2` | Dev testing on PrimePC; keep VM files on `S:\[VMs]`, never C: |
| Raspberry Pi 5 / 4 (64-bit) | SD/NVMe image | Pi 5 needs the Raspberry Pi kernel + firmware; btrfs; light VMs only |
| Home Assistant Green / HAOS box | Not targeted at first | Locked-ish ARM board; move Home Assistant into the main box instead |
| Fire TV / Android TV | **Client app**, not the OS | Locked bootloader |

## 6. Build + test workflow (on PrimePC)

1. A Debian 13 build VM in VMware (`S:[VMs][JENEROS-BUILD]`) → `mkosi` builds the image. (WSL was dropped: it needs the Windows hypervisor, which slows VMware.)
2. VMware disk goes to `S:\[VMs]\[JENEROS]` (HDD, per the homelab rule).
3. Boot it in VMware Workstation → dashboard at `http://<vm-ip>`.
4. When stable: flash to USB → test on a spare PC → then a Pi 5.
5. CI later: GitHub Actions builds amd64 + arm64 images on every tag.

## 7. Naming — decided 2026-10-07

| Layer | Name | Notes |
|---|---|---|
| Company | **Jener, Inc.** | "Inc." requires forming a Maryland corporation; an LLC would be "Jener LLC" until converted |
| Handle | **@jener_inc** on TikTok, Instagram, YouTube, X · GitHub: founder account **PrimeExtremo** (repo PrimeExtremo/JenerOS) · Bluesky: **@jener.dev** (domain as handle) | Bluesky does not allow underscores; @jenerinc is taken on TikTok and X |
| Website | **jener.dev** (owned, Cloudflare Registrar, 2026-10-07) — the only domain for now; JenerOS lives at jener.dev/os | jeneros.org (still free) only if the project takes off; jeneros.com is taken |
| Product | **JenerOS** | |
| Founder's personal accounts | unchanged | Promote the company from them (Omarchy/DHH model) |

All of the above were unregistered/free when checked on 2026-10-07. Before buying: USPTO search for "Jener" (classes 9 and 42) and Maryland SDAT name search.

## 8. Brand (look carried over from arvey.co; Arvey name and AV monogram retired)

| Token | Light | Dark | From arvey.co |
|---|---|---|---|
| Background | `#F6F1E7` paper | `#16130F` | `--cream` |
| Ink | `#211C16` | `#F6F1E7` | `--ink` |
| Accent (one only) | `#FF5A1F` PLA-orange | same | `--coral` |
| Hairline | `#DCD3C2` | `#3A3226` | `--border` |
| Shadow | `3px 3px 0 ink` hard offset | orange or none | `--sh` |
| Wordmark | Lemon Milk | | `--logo` |
| UI text | Quicksand / Baloo 2 headings | | `--font`, `--display` |

New mark: a JENER wordmark in Lemon Milk + a "J" monogram, drawn in the same style as the old AV monogram.

## 9. Phase 1 milestones (OS only)

1. `mkosi` config: Debian trixie, amd64, boots in VMware, `jenerd` starts, dashboard on :80.
2. Read-only root + A/B partitions + one test update + forced rollback.
3. Portable storage (btrfs / simple disks, see STORAGE.md) + Incus 7 in the image; first-boot wizard (account, disks, network).
4. USB installer ISO.
5. arm64 / Pi 5 image.

Also fix before Phase 2 (from the Codex review): Drive manifest needs `POSTGRES_DB`/`POSTGRES_USER`; Photos needs `IMMICH_MACHINE_LEARNING_URL` pointing at the `ml` service.

## 10. Tools that will help

| Tool | Use |
|---|---|
| Cloudflare MCP | Project site on Workers (like arvey.co), DNS for the new domain |
| Creative MCP (image gen) | Logo concepts for the new name |
| `impeccable` skill | Dashboard redesign in the arvey.co style |
| `archify` skill | Architecture diagrams for the [DOCS]/site |
| Codex plugin | Second-opinion reviews (already used once) |
| Built-in browser | Testing the dashboard inside the VM |
