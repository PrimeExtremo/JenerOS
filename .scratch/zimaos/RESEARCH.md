# ZimaOS 1.8.0-beta2 research (reference only, do not copy brand/text)

VM: S:\[VMs]\[ZIMAOS-TEST], http://192.168.27.140 (throwaway, user will delete).

## System
- Buildroot-based (from CasaOS), kernel 6.18, RAUC A/B "two system slots + overlay + data". UEFI only, Secure Boot off.
- Console screen: block-letter banner, facts table (manufacturer, model, OS, build date, serial, hostname, kernel, uptime), web URL with interface, "SSH off by default, enable in web UI", Alt+F2 root shell, "press s to switch to the other slot and reboot".
- Web UI: Vue single bundle (~200 KB). APIs: /v1/users, /v1/container, /v1/gateway, /v1/sys/*, /v2/app_management, /v2/local_storage, /v2/message_bus (socket.io live events), /v2/mod_management, /v2/installer, /v2/zimaos.

## Installer (USB/ISO) - user loved it
Welcome+Start -> Language -> 1/4 choose disk (cards: model, /dev path, size) -> 2/4 Ready to install (checklist: files verified, install media excluded, target not mounted, enough space; one sentence on partitions) -> progress (Erase, Partitions, Boot files, Write system, Format data, Verify + %) -> Done: remove media + Restart.

## Web setup
Welcome (language list ~30, Accept Privacy Policy checkbox) -> Create local account (username, password, confirm) -> dashboard.
Dark abstract wallpaper, small white rounded card, round blue next button.

## Features (from UI strings + docs)
- Storage: Storage Manager, RAID0/1/5 ("combine disks"), enable disks individually (retain data or format), expand RAID with new disk, damaged-storage alerts, "almost full" warnings, illustrated disk-insert guides, ZFS mentioned in dev docs.
- Accounts: local admin + separate "shared folder" member accounts; change username/password; reset password doc.
- Sharing: SMB (multi-user, pause sharing, IPv6/domain), share via link, Time Machine target, Thunderbolt direct connect.
- Remote: "Network ID" remote access (ZeroTier-like, own client "ZimaClient"), Tailscale/WireGuard docs.
- Backup: phone backup, computer backup, connect cloud drives (OneDrive etc.), connect another NAS, 3-2-1 backup, Zima Backup app, data migration.
- Photos app, search indexing service, encrypted folders (beta), local LLM inference ("new AI era").
- System: UPS setup, recovery, reset network, offline update, OTA update screens (/update, /update-failure), migration screen, network stats, multi-NIC/bonding ("faster with multiple networks").
- App Store: ~170 apps, docker-compose + `x-casaos` metadata (category, tagline, multi-language description, icon, screenshots, port_map, env/port descriptions). Custom compose install ("Merge own Apps"), native YAML edit, container logs + terminal, uninstall with "delete app data". VirtualMachineManager is an app.

## Logged-in tour (2026-10-08)
- After account: "Introducing" card with 4 feature tiles (combine drives, manage data, access anywhere, merge apps) + "Start from Files / Start from App Store / Dashboard". Then a 3-slide client tour.
- Dashboard: dark wallpaper, glassy dark cards. Left column widgets: clock+date, System (CPU/RAM ring gauges, watts, temp), Storage (Healthy badge, used/total bar), Network (eth0 live graph, up/down), Widget settings. Top: search bar, swipeable notice cards (Found a new device -> Manage, Remote Access -> Learn more, app install progress). Apps grid of big rounded tiles + "+" to add. Top-left icons: account, settings.
- Settings modal (sidebar General / Storage / Network / Apps, power button bottom):
  - General: device card (name, LAN IP, Device info), version, paid-tier limits (3 members, 4 disks free), wallpaper + login screen pickers, language, timezone, time format, search engine, disk standby, WebUI port, rendering mode (standard/performance), news feed, UPS, reset, developer mode.
  - Storage: "Bays" picture of drive slots, pool usage bar, system disk, "Create storage" -> Combine (RAID) or Enable (single disk). RAID picker is a comparison table: RAID5 "Balanced", RAID1 "Safe", JBOD soon; columns backup disks, min disks, speed bars, capacity, expandable, use case. Then disk checklist with "Use recommended option" + live "estimated available vs protection" bar, then summary (Btrfs, name, warning checkbox), then progress with "Continue in the background".
  - Network: port pictures, connections list (Ethernet speed/DHCP, ZeroTier virtual net, Thunderbolt bridge), Remote access toggle + Remote ID copy.
  - Apps: where app data/images/user DB live with usage, Docker cache cleanup.
  - Account: owner card (change password, cute avatar), Members (create member).
- App Store (Apple-style): Discover hero banner, Trending Now illustrated cards, New Arrivals, categories (Media, Productivity, Home, Networking, AI, Finance, Social, Developer, Others), community stores, Install Custom App, My Apps table (network, port, uptime, memory, CPU, start/stop all, Update tab). App page: install button with progress ring, chips (category, developer, min memory, disk), screenshots, what's new, intro, source link. Custom install: Form/YAML toggle, per-service tabs, image/tag, restart policy, network, ports, volumes, env.
- Files: Finder-like, light/dark/auto toggle, starred folders (Documents, Downloads, Gallery, Media, Backup), storage list incl. new RAID, external: Google Drive, Dropbox, OneDrive, iCloud Drive/Photos, LAN storage, USB. Right-click: download, copy path, info, migrate, copy/duplicate/cut, rename, star, share via Samba, trash, delete.
- Photos: PWA, pick source folders, search, appearance.
- Backup: 3-2-1 explainer; New backup = source (Cloud, LAN, USB, Zima storage) -> destination -> Start.
- ZVM: create VM with one-click OS downloads (Windows 11/10, Fedora, Debian, Mint, Arch, Ubuntu), URL, or ISO from Files.
- UI is built from "mods" (/v2/mod_management/modules): each built-in app is a module with entry page + icon, opened as a window.

## Build order for JenerOS (proposal)
1. Installer ISO (brief in progress) + setup privacy/validation (in progress).
2. Storage: disks page with bay picture, Combine (Btrfs RAID1/RAID5-ish) / Enable single, friendly comparison table, health + full alerts.
3. App Store v2: Discover/categories/app pages/My Apps table with resource use, Form/YAML custom install, import compose catalogs.
4. Files app + SMB sharing per folder + family member accounts.
5. Backup (USB/LAN/cloud via rclone) with 3-2-1 explainer.
6. Remote access (Tailscale/WireGuard first, no own relay).
7. VMs (QEMU/KVM) with one-click OS catalog.
8. Widgets: CPU/RAM rings, watts/temp, network graph, notice cards carousel.

## JenerOS today vs ZimaOS (gaps)
| Area | JenerOS | ZimaOS |
|---|---|---|
| Installer | flash .img.xz | graphical USB installer |
| Storage | planned (STORAGE.md) | RAID, per-disk, expand, alerts |
| Users | single owner | owner + share accounts |
| Shares | none | SMB, links, Time Machine |
| Apps | 5 curated (own manifest) | ~170 compose apps + custom |
| App mgmt | install | logs, terminal, YAML, delete data |
| Remote | none | Network ID, Tailscale |
| Backup | none | phone/PC/cloud/NAS |
| Updates | A/B + rollback (have) | A/B RAUC (have) |
| Live events | polling | socket.io bus |
