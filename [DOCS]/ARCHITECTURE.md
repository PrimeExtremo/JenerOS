# JenerOS — Architecture

JenerOS is an installable OS that turns any spare machine into a personal cloud:
photos, files, home automation, TV/media, network-wide ad blocking, VMs and an
optional router — one install, one login, one storage pool, one dashboard, one store.

Think "iCloud + Apple TV + Proxmox + TrueNAS + Pi-hole", self-hosted.

## Guiding rules

1. **One of everything.** One account (SSO), one storage pool, one backup system,
   one update button, one dashboard. Apps never ask the user to configure these.
2. **Integrate first, replace later.** Each feature ships first as a store app wrapping
   a proven project (Immich, Home Assistant, …). JenerOS owns the glue. Any app can be
   swapped for a native JenerOS implementation later without the user noticing.
3. **No Docker for the user.** Apps run isolated, but the runtime is invisible.
4. **Router mode is opt-in.** A bug there takes down the internet; it ships last.

## Layers

```
┌────────────────────────────────────────────────────────────────┐
│  Clients: Web dashboard · Phone app · TV app (Fire TV/Android) │
├────────────────────────────────────────────────────────────────┤
│  jenerd (core daemon, Go)                                      │
│   ├─ API + dashboard server                                    │
│   ├─ Identity: one account → OIDC SSO for every app            │
│   ├─ Store: catalog, install/update/remove                     │
│   ├─ Storage manager: pools, shares, snapshots, disk health    │
│   ├─ Machines: VMs + containers                                │
│   ├─ Network: Relay (DNS/adblock), remote access, router mode  │
│   └─ Backup: snapshots + off-site copies                       │
├────────────────────────────────────────────────────────────────┤
│  Runtime: Incus  (OCI app containers · LXC · KVM VMs)          │
├────────────────────────────────────────────────────────────────┤
│  Storage: btrfs pools | ext4/XFS + mergerfs + SnapRAID        │
├────────────────────────────────────────────────────────────────┤
│  Base OS: Debian stable, read-only image, A/B updates          │
└────────────────────────────────────────────────────────────────┘
```

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Base OS | Debian stable, built with `mkosi` | Runs on amd64 + arm64 (Pi 4/5), huge hardware support |
| Updates | Immutable image + A/B partitions (`systemd-sysupdate`) | Update everything at once; roll back on failed boot |
| App + VM runtime | **Incus** | One engine for OCI app containers (no Docker daemon), system containers and KVM VMs. Replaces Docker *and* Proxmox's engine |
| Storage | btrfs, or ext4/XFS + mergerfs + SnapRAID | Disks stay readable by any Linux (see STORAGE.md); ZFS import-only |
| Core daemon | Go | Single static binary, trivial cross-compile to arm64 |
| Identity | Built-in OIDC provider (start with Authelia/Kanidm wrapped, replace later) | Every app gets SSO automatically |
| Relay (DNS/adblock) | AdGuard Home app, later native (`blocky`-style) | Pi-hole equivalent, DoH/DoT built in |
| Remote access | WireGuard mesh (Headscale-compatible) | "Works from anywhere" like iCloud, no port forwarding |
| Router mode | nftables + dnsmasq/Kea + WireGuard, managed by jenerd | Needs 2 NICs; opt-in |
| Dashboard | Web UI served by jenerd | Same UI on PC, phone, TV browser |

## Feature → implementation map

| JenerOS feature | iCloud/other equivalent | v1 backed by |
|---|---|---|
| Photos | iCloud Photos / Immich | Immich |
| Drive | iCloud Drive / Nextcloud | Nextcloud (or Seafile) + SMB shares |
| Home | Apple Home / Home Assistant | Home Assistant (VM or container) |
| TV | Apple TV / Plex | Jellyfin + TV client on Fire TV |
| Relay | Private Relay / Pi-hole | AdGuard Home |
| Machines | Proxmox | Incus VMs/containers |
| Storage | TrueNAS | ZFS/btrfs via jenerd |
| Store | App Store / Zima/CasaOS store | JenerOS store (this repo's `[STORE]/`) |

## App model

Every store app is a manifest (`[SPEC]/app-manifest.md`). jenerd reads it and:

1. Checks arch + RAM fit the machine.
2. Creates an Incus project for the app; runs each service (OCI image) inside it.
3. Mounts the shared pool paths it requests (`/jener/photos`, `/jener/media`, …).
4. Registers an OIDC client and injects credentials as env vars.
5. Puts it behind the built-in reverse proxy at `https://<app>.jener.local`.
6. Adds it to snapshot + backup schedules.

The user only sees: **Install → open**.

## Devices

| Device | Role |
|---|---|
| Old PC / mini PC / server | Full JenerOS node (all features, VMs) |
| Raspberry Pi 4/5 (64-bit) | JenerOS node (lighter apps, btrfs, small VMs) |
| VM on existing hypervisor | JenerOS node (for testing / migration) |
| HAOS box | Reinstall as JenerOS node; Home Assistant moves into it |
| Fire TV / Android TV | **Client only** (locked bootloader) — Jener TV app |
| Phones / PCs | Client: web dashboard now, apps later |

Multiple nodes join one JenerOS (clustering) — post-v1.
