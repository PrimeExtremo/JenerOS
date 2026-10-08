# JenerOS M4 installer brief

2026-10-07 · Design only. No installer code or image built.

Reference: [ZimaOS research](../zimaos/RESEARCH.md). Borrow the clear sequence,
not its artwork, logo, names or wording. This brief keeps the Debian + mkosi,
systemd-boot and verified A/B decisions.

## Look and feel

Cream `#F6F1E7`, brown `#1F1913`, warm orange `#D97757` for decoration,
`#B9562F` for filled buttons with white text. Use the approved angular v1 J
and local Bricolage headings. One calm card per screen. Wide spacing, clear
focus, large touch targets. Brown dark mode uses the dashboard's existing tokens.
No wallpaper from another OS. No network, account or telemetry step in the installer.
English is the only language initially; store strings by language key for expansion.

## Screens

| Screen | What Jener sees | Action |
|---|---|---|
| Welcome | J logo, “Welcome to JenerOS”, “Let's give this computer a new home.” | Start |
| Language | English selected; room for more languages later | Continue / Back |
| Step 1: Choose a disk | Disk cards with model, `/dev` path and size. Show connection type to help identify USB disks. | Select one card, then Continue |
| Step 2: Ready to install | Selected disk repeated, four checks below, partition sentence, erase warning and unchecked consent box | Install JenerOS / Back |
| Step 3: Making room for home | Named stage, overall percent, short explanation and “Keep this computer switched on.” | Wait |
| Done | “JenerOS is ready. Remove the installer media, then restart. We'll help you set up your box next.” | Restart |

On disk cards, use model, path and capacity together. Duplicate models need a
short serial hint for distinguishing disks. Installer media is excluded rather
than shown as a selectable card. No disk selected by default. An empty list says
“We couldn't find an available disk. Check the connection, then try again.”
Refresh discovery when devices change and clear a selection that disappears.

The Ready screen checks:

| Check | Required evidence |
|---|---|
| Install files verified | Bundled signed manifest and the digest/size of every payload match |
| Installer media excluded | Target is not the boot medium or any disk behind its filesystem |
| Target not mounted | No target partitions mounted; no swap, active holders, RAID/LVM or encrypted maps using it |
| Enough space | Actual target bytes and sector sizes satisfy the complete layout plus minimum writable space |

Use one sentence: “We'll make a small boot area, two system slots for safe
updates, and space for your data.” For M4 this data space is the existing writable
root/state partition, which grows to fill the target; verity metadata accompanies
each system slot. Do not silently introduce another data partition or format
separate storage disks. User storage pools remain M3 work.

Erase warning: “Everything on **[model · path · size]** will be erased.”
Checkbox: “I understand this will erase the selected disk.” Keep Install disabled
until every check passes and this is ticked. This is the final, concrete approval
for that disk. Never start writing from Welcome or by selecting a card.

## Progress and failure

| Stage | Suggested overall range | Evidence |
|---|---|---|
| Prepare disk | 0–5% | Revalidate target and remove old signatures only on that disk |
| Create partitions | 5–10% | GPT matches the planned layout |
| Write system | 10–75% | Actual payload bytes copied to the slot and verity partitions |
| Add boot files | 75–82% | ESP populated; systemd-boot fallback path and UKI present |
| Prepare data space | 82–90% | Clean writable state, filesystem and expansion settings |
| Check installation | 90–100% | Read back payloads, check verity pairing, GPT and boot files, flush writes |

Percent comes from work completed. Where a tool lacks byte progress, show a
named stage and keep the last measured percent; do not animate an invented timer.
100% means verification and flush finished. If repart combines stages in one
operation, show “Write system and boot files” until its result can be verified,
rather than claim independent stages have completed.

Back is available until Install. After the first write, navigation cannot start
another job. Failure names the failed stage and disk, explains that the target
may be incomplete, and offers a checked retry or shutdown. Never show Done after
an error or automatically try another disk. The source stays read-only and no
other disk is changed. Restart stays disabled until writes are flushed and all
target mounts are released; don't try to eject media that still backs the live OS.

## Proposed architecture

| Piece | Responsibility |
|---|---|
| Separate mkosi installer profile | Debian live runtime, GPU support, Cage/Cog, clean verified payload and manifest under `/usr/share/jeneros/installer`; no dev keys or setup-done marker in the installed payload |
| Cage + Cog on tty1 | Same non-root kiosk seat as first boot, opening the local installer page |
| `jenerd -installer` | New mode, proposed only: listen on loopback; serve installer assets, list approved disks, run read-only checks, queue one job, expose sanitized progress |
| Root path + oneshot worker | Own destructive operations. Validate again, lock one install, write only the approved whole disk, record progress atomically |
| Installed JenerOS | Boots its own systemd-boot/UKI, then the existing setup wizard; policy consent and owner creation happen there |

Installer APIs exist only in installer mode. Normal installed jenerd must not
register them. Bind to loopback, require the `X-JenerOS: 1` CSRF header plus a
per-boot local token. No remote installer QR. Queue a private request containing
a server-issued disk identity, expected major/minor, capacity and consent token,
never a shell command or user-supplied raw device path.

The worker resolves `/dev/disk/by-id` where available and pins major/minor plus
model/serial/size. Recheck identity, use, capacity and installer ancestry immediately
before erasing. A disk swap invalidates approval. Trace mount sources, loop backing
files and device-mapper slaves to their whole physical disks; this also handles
ISO files stored on a local disk. Reject complex/unknown ancestry. Exclude the
whole USB disk, including its apparently unused partitions.

USB first: produce a separate bootable raw live disk with the clean install
payload bundled on it. Flashing it and installing from it are separate operations.
ISO later: package the same runtime and payload with an EFI El Torito boot image;
prototype the ISO mastering step separately from mkosi's raw disk output. Do not
claim changing the filename to `.iso` creates a bootable ISO. Keep both artifacts,
VM disks and large build output off Windows C:, under `S:\[VMs]\...`.

## Writing the target

Recommend **systemd-repart**, matching the existing M4 plan. Debian trixie supports
`--copy-from=IMAGE`, which imports partition definitions and contents from a clean
disk image. It can be combined with explicit installer definitions. Use a tested
plan scoped to the selected whole disk, explicit destructive intent, and a dry
run before approval. Definitions and their tool version ship with the installer.

Important: `--copy-from` preserves source partition sizes. It does not by itself
promise the writable partition fills a bigger disk. Prototype either copying
the clean image followed by the installed `/usr/lib/repart.d/50-root.conf` growth
path, or explicit `CopyBlocks=` definitions for slots/verity/ESP with a separately
formatted writable partition sized to the remaining disk. Keep labels, UUID
relationships, verity root hashes and UKI kernel arguments consistent. New writable
state gets unique machine identity and no live-runtime accounts or network state.
Never clone the running installer's writable root.

| Method | Benefit | Work to prove |
|---|---|---|
| repart + clean payload (recommended) | Declarative partition plan, uses our existing tools and growth design | Two slots and verity pairing, preserved references, writable growth and truthful progress |
| `dd` clean full disk image + grow (fallback) | Exact image layout; byte count makes progress easier | Whole-disk erasure, source/target checks, GPT relocation, safe root growth, duplicate UUID avoidance and read-back verification |

`dd` has no disk-selection protection. If repart cannot preserve the current
verified layout reliably, document the reason before adopting the fallback.
Neither writer should accept an unchecked path or shell interpolation. A
successful copy is only one stage; verify the resulting installation before Done.

## M4 acceptance checks

- VM with installer media and two blank disks: only the selected disk changes.
- Also test an existing populated non-target disk; its table and sampled bytes stay identical.
- Mounted disk, active swap/mapper, too-small disk, unplug/swap and unknown source ancestry block installation.
- Damaged payload fails before erasure. Write/read-back failure never reaches Done.
- Remove media and restart: target boots offline, grows state space, shows setup,
  and later performs an A/B update and rollback with verity intact.
- USB and eventual ISO both reach the same kiosk. Review keyboard-only use,
  800×600 VM display and light/dark readability with Jener.

Source: [Debian trixie systemd-repart manual](https://manpages.debian.org/trixie/systemd-repart/systemd-repart.8.en.html),
[partition definitions](https://manpages.debian.org/trixie/systemd-repart/repart.d.5.en.html).
The architecture and stage ranges above are proposals, not verified installer behavior.
