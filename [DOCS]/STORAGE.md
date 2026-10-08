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

## Storage wizard (style phase 4, 2026-10-08)

The first creation flow supports **One disk** (`single`, exactly one disk),
**Safe** (`raid1`, two or more), and **Fast and safe** (`raid10`, four or more).
RAID5/6 appear only as disabled "Coming later" information. There is no parity
creation endpoint. Import, grow, encryption, simple disks and three-copy mirrors
remain future work; the design above still applies.

| Interface | Behavior |
|---|---|
| `GET /api/storage` | Owner session required. Disks, eligibility reasons, recorded pools, usage, current job and helper availability. |
| `POST /api/storage/create` | Owner session and `X-JenerOS: 1` required. Accepts `name`, `profile`, `disks`, `identities`, and `erase: true`. Returns a job ID with HTTP 202. |
| `/run/jeneros/storage.request` | Atomic, private JSON request for the root path worker. Names and profiles are allowlisted; disk identities must match the selection. |
| `/run/jeneros-storage/status.json` | Root-written atomic progress with job ID, state, message and milestone percentage. The browser polls; closing the sheet does not cancel. |
| `/var/lib/jeneros/pools/<name>` | Persistent mount point, with `Photos`, `Files`, `Media`, `Backups` and `.jeneros` folders. |
| `/var/lib/jeneros/storage/<name>.json` | Root-owned pool record. A reserved name survives an interrupted creation; no automatic destructive retry. |
| `/etc/systemd/system/*.mount` | Generated user state, mounted by filesystem UUID and enabled for `local-fs.target`. OS-supplied units still ship under `/usr`. |

Discovery uses `/sys/block` and the explicit lsblk JSON columns. It rejects the
system disk, mounted disks (including swap), filesystems, partitions, read-only
disks, disks with holders, and disks smaller than 1 GiB. It fails closed when the
root filesystem cannot be identified. This first flow accepts only blank whole
disks; even an empty partition table is rejected by the root signature check.
It does not import or erase an existing filesystem.

Disk identity includes the kernel disk sequence number, so reattachment changes
the selection even for disks without serial numbers. The separate root worker
repeats discovery and validates the same disk identity
before erasure and formatting. It also probes signatures with read-only wipefs,
refuses symlinks/non-block devices, serializes jobs with a root lock, and does not
pass `--force` to mkfs. It uses the selected profile for both data and metadata.
The daemon remains unprivileged and does not mount or format disks.

Capacity in the wizard is an estimate before filesystem overhead. Mirror
capacity is capped by the space on the other disks; stripe + mirror uses a
conservative estimate based on the smallest disk. Extra copies are protection,
not a separate backup. Bays are illustrative, not physical slot detection.

VM acceptance and recovery checks: `.scratch/zimaos/PHASE-4-REVIEW.md`.

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
