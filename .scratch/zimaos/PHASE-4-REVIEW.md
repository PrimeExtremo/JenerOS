# Storage wizard review

2026-10-08 · Codex · branch `zimaos-style`

Files only. No installs, disk operations, OS images, commits or pushes.
References 12–17 were viewed locally; no reference assets or wording were copied.

## Delivered

- Storage overview with detected bays, empty placeholders, pool usage, system disk and Create storage.
- Combine / Use one disk, layout comparison, disk selection and recommendation, live usable/protection/leftover estimate, name and explicit erase consent, progress and background continuation.
- Shared window motion, modal fallback, keyboard focus, light/dark themes and phone sheets. Native inputs and scrollable tables. No simulated creation in static preview.
- Go stdlib storage package and owner-protected API. The root worker repeats disk and identity checks, probes signatures, formats only blank whole disks, creates a UUID mount unit and plain folders, and publishes progress.
- Root `.path` and oneshot under `/usr`, enabled by `want()`. Persistent pool records and generated units are user state in `/var` and `/etc`.
- `btrfs-progs` plus explicit `util-linux` image packages; no Go dependencies added.
- Go tests for filtering, profile/count/name/identity/consent rules, strict JSON, atomic queue/busy behavior, owner/CSRF checks and fake worker success/failure paths.
- `.scratch/zimaos/check-storage.cjs` is in CI. Its browser fixture mocks all storage API calls; it cannot format disks.

## Local verification

All **32 Storage browser cases passed** in installed Edge/Chromium: dark/light,
360×780, 390×844, 780×360 and 1280×800, with native/fallback dialogs,
reduced-motion JavaScript preference and 200% text. Rendered previews were
inspected locally. Separate browser media emulation verified the actual reduced
motion CSS uses the shared fade on comparison, disk selection and summary.

All **21 workflow fixture runners were run: 20 passed**. The existing phone-polish
runner reports 66 failures around App Store grabbers, enlarged-text Settings,
and other existing phone checks. A baseline run against HEAD produces the exact
same 66 failure strings; this change adds none. Dashboard/fixture JavaScript
syntax, changed shell syntax and `git diff --check` passed. Full logs and local
previews are in the ignored `shots/storage-check-results` folder / `shots/storage-*.png`.

`go` and `gofmt` are absent. Both commands were attempted; nothing was installed.
**Go formatting, compilation, vet and tests are pending**, including the new
fake-worker tests. Before any image build, Claude should run on Linux:

```sh
cd '[CORE]'
gofmt -w internal/storage internal/api/storage.go internal/api/storage_test.go cmd/jenerd/main.go
go vet ./...
go test ./...
go test -race ./internal/storage ./internal/api
go build ./...
```

## Claude's spare-disk VM checks

| Check | Expected |
|---|---|
| Fresh image / A/B update | Helper executable and path unit enabled from `/usr`; no `After=jenerd` on path units. |
| Owner gate | GET without session fails; POST without session or `X-JenerOS` fails and never queues work. |
| Discovery as DynamicUser | Actual lsblk JSON decodes; `/sys/block`, holders and read-only checks succeed. System disk, mounted/swap/data/partitioned/small disks are never eligible. |
| Root recheck | Add a signature, mount a disk, or replace it between selection and submission. No wipefs/mkfs mutation occurs. Empty GPT is rejected too. `/sys/block/*/diskseq` must be readable and change across reattachment, even without a serial. |
| Profiles | Create single on one spare, mirror on two, stripe + mirror on four. Verify both data and metadata profiles with Btrfs tools. RAID5/6 and duplicate disks are rejected. |
| Persistence | Pool uses its UUID; generated mount unit is enabled in `/etc`. Reboot and verify mount, files, usage, and record survive. Test disks arriving late. |
| Plain folders | Photos, Files, Media, Backups and .jeneros exist; the disk can be mounted by another ordinary Linux. |
| Failure / interruption | Format or mount failure yields a failed status, never success. The reserved name and any formatted disk remain for inspection. A repeat request cannot overwrite them. |
| Background | Close/reopen the sheet and reload the dashboard during creation. Progress follows the same ID. A lost POST response never triggers an automatic second POST. |
| Runtime cleanup | Restart jenerd while the worker is running; verify root status remains readable and the busy guard prevents a second job. |
| Accessibility | Real keyboard, screen reader, phone keyboard, reduced motion/transparency and Cog checks; confirm consent and disk labels announce correctly. |

After an interrupted creation, inspect the root service journal, pool record,
actual disk signatures and any generated unit before manual recovery. Do not
delete a reservation and retry blindly. A successfully formatted disk is no
longer eligible for this blank-disk flow. Grow/import/repair interfaces are not
part of this phase.

Reference documentation checked: [Btrfs mkfs](https://btrfs.readthedocs.io/en/latest/mkfs.btrfs.html),
[lsblk](https://man7.org/linux/man-pages/man8/lsblk.8.html),
[Debian Btrfs paths](https://packages.debian.org/trixie/amd64/btrfs-progs/filelist),
[Debian util-linux paths](https://packages.debian.org/trixie/amd64/util-linux/filelist).
