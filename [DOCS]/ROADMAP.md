# Roadmap

Each phase ends with something usable.

## Phase 0 — Skeleton (done, uncommitted)
- [x] Architecture + manifest spec
- [x] jenerd: system info API, store catalog API, serves dashboard
- [x] Dashboard shell (works with mock data when jenerd isn't running)
- [x] Five starter manifests: Photos, Drive, Home, TV, Relay

## Phase 1 — Bootable OS (in progress — tasks in [PHASE-1.md](PHASE-1.md))
- [x] M1: boots in a VM, jenerd serves the dashboard on :80 (2026-10-07; review pending)
- [x] M2: read-only system, A/B updates, automatic rollback (2026-10-07; review pending)
- [ ] M3: ZFS/btrfs, Incus 7, first-boot wizard
- [ ] M4: USB installer
- [ ] M5: Raspberry Pi 5 image

## Phase 2 — Store works
- [ ] Incus runtime: install/remove OCI apps from manifests
- [ ] Reverse proxy + `*.jener.local` names
- [ ] Shared pool mounts
- [ ] Photos, TV, Relay installable in one click

## Phase 3 — One account
- [ ] Built-in OIDC; apps auto-registered
- [ ] Drive + Home with SSO

## Phase 4 — Storage (TrueNAS part)
- [ ] Pools, disk health (SMART), SMB shares, snapshots, scheduled backups

## Phase 5 — Machines (Proxmox part)
- [ ] Create/console/start/stop VMs and containers from the dashboard
- [ ] Import an existing HAOS install as a VM

## Phase 6 — Anywhere access
- [ ] WireGuard mesh; phone apps reach JenerOS away from home

## Phase 7 — Router mode
- [ ] WAN/LAN setup, firewall, DHCP, Relay as DNS, VPN

## Phase 8 — Clients
- [ ] Jener TV (Fire TV / Android TV)
- [ ] Phone app (photo backup, files, home controls)
