# Storage design — portable by default

**Rule (from Jener, 2026-10-07):** anyone can move from JenerOS to any other Linux and keep
their data disks **without wiping them**. No filesystem that needs extra software.

## Pool types

| Type | Filesystem | Redundancy options | Readable on other Linux | Best for |
|---|---|---|---|---|
| **Pool** (default) | btrfs | single · mirror (raid1) · 3 copies (raid1c3) · raid10 | ✅ Built into the Linux kernel; Ubuntu/Fedora/Arch/Mint mount it as-is | Photos, files, VMs, app data |
| **Simple disks** | ext4 or XFS per disk, shown as one folder by **mergerfs**, protected by **SnapRAID** parity | 1–2 parity disks | ✅ Every disk works alone, anywhere | Big media libraries, mixed disk sizes (Unraid style) |
| Imported ZFS | ZFS | whatever it already has | ⚠️ Needs ZFS tools | **Import only**, for people coming from TrueNAS. Never created by JenerOS |

**Never offered:** btrfs raid5/raid6. The btrfs project still marks it unstable;
3 copies (raid1c3) is the safe replacement.

## What's on a data disk

```
<pool>/
├─ Photos/      ← Immich library (original files, normal folders)
├─ Files/       ← Drive (Nextcloud) user files
├─ Media/       ← Movies/ Shows/ Music/ for TV (Jellyfin)
├─ Backups/
└─ .jeneros/    ← hidden: app databases, VM disks, app settings, snapshots
```

Plug the disk into another Linux → your stuff is in plain folders at the top.
Apps must be configured to keep user files in these folders, not inside container volumes.

## Encryption

- Standard **LUKS2** (supported by every Linux via `cryptsetup`).
- Setup always shows a **recovery key** once and asks the user to save it.
- TPM auto-unlock is a convenience on top, never the only key.

## Snapshots and backups

- btrfs pools: scheduled read-only snapshots in `.jeneros/snapshots/`, send to another disk/box with `btrfs send`.
- Simple disks: SnapRAID `sync` on a schedule + `scrub` weekly; file-level backups with restic to `Backups/` or off-site.

## Packages (all in Debian 13 main, except ZFS)

`btrfs-progs` · `xfsprogs` · `e2fsprogs` · `mergerfs` · `snapraid` · `cryptsetup` · `smartmontools` · (`zfsutils-linux` from contrib or Zabbly, import only)

## Leaving JenerOS (to be written as `LEAVING-JENEROS.md` in Phase 1 M3)

1. Boot any Linux (live USB is fine).
2. btrfs pool: it auto-mounts, or `sudo mount /dev/sdX /mnt` (mount any one disk of a mirror).
3. Simple disks: mount each disk on its own; install `mergerfs` if you want the combined view back.
4. Encrypted: `sudo cryptsetup open /dev/sdX jener` with the recovery key, then mount `/dev/mapper/jener`.
