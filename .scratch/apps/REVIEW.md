# App runtime continuation review

Codex, 2026-10-10. Files only. Nothing committed, pushed, installed or built into
an OS image. Unrelated marketing, security and trailer work was preserved.

## Work preserved from the interrupted run

- Incus 7.0 LTS image preparation, immutable binary layout, preseed and boot units.
- Root install/start/stop/uninstall/status workers, OCI projects and per-app
  networks, private secrets, selected data directories and retained manifests.
- Owner API, request validation, progress and live readings.
- Four pinned app manifests: Photos, TV, Drive and Home. Relay and custom installs
  remain Coming soon. Native app accounts are separate from JenerOS for now.
- Store controls, initial Go/browser fixtures, CI wiring and VM checklist.

## Continuation fixes

- Separate sample age from job progress. A long pull cannot make old readings
  look current. Stale readings lose Open links and show Unavailable.
- Preserve app health errors in private records across other apps' jobs and
  clear them after successful recovery. Failed installed apps keep their tiles.
- Do not mark a queued request interrupted while it waits for the worker lock.
- Match Storage's 32-character pool names. `@system` identifies the system disk
  separately from a real data pool named `system`.
- Clear recovered browser notices, retain action errors, remove em-dash
  placeholders from store text, and extend browser assertions for these cases.
- Prepare missing subordinate UID/GID ranges before Incus starts after an A/B
  update. Preserve existing root/owner ranges and reject invalid or exhausted
  allocations. Invalidate old readiness before engine reinitialization.
- Add Go coverage for ID ranges, old samples during downloads, runtime metrics,
  persistent health errors, pool selection and app bridge address filtering.
- Update handoff sections 3/6, runtime docs, manifest spec and VM checks.

## Local checks

| Check | Result |
|---|---|
| App Store browser flow | 32/32 pass in installed Edge 154 |
| Matrix | Dark/light, 360x780, 390x844, 780x360, 1280x800; native/fallback dialogs, reduced motion, large text |
| Actions | Install/pool choice, real phase progress, reopen, start/stop, retain/delete data, typed confirmation, rejected/offline requests, safe Open links |
| Desktop fixture | Pass |
| Unit-ordering guard | Pass, 11 path/socket/timer units plus drop-ins |
| Dashboard JavaScript syntax | Pass |
| Build/prepare/postinst shell syntax | Pass with existing Git Bash |
| Git diff whitespace | Pass |
| Full dashboard workflow | 21/22 fixture runners pass; phone-polish timed out at 240 seconds |
| Zen browser | Timed out without fixture results; Firefox compatibility remains unverified |
| Go format/vet/test/race/build | Not run: Go/gofmt are absent |

The broad run includes passing Storage (32 browser cases), Welcome, login,
onboarding, kiosk lighting/click handling, phone/QR helpers, SSH and rollback
fixtures. Phone-polish's source checks passed, but its browser runner timed out
without a completed report. An earlier timeout is recorded in AI-UPDATES.md;
this continuation did not diagnose that suite or rerun it against HEAD. It is
not counted as passing. No live-browser visual inspection or Go test execution
is implied by these results.

## Remaining acceptance

Follow [VM-CHECKS.md](VM-CHECKS.md). Claude must format and compile the Go code
before building. Fake engine tests and browser fixtures do not establish that
OCI images boot, uploads work, mount permissions are correct, or data survives
reboot/A/B updates. Verify the four native apps, fresh and pre-Incus upgrades,
subordinate IDs, missing disks, retained files/secrets/subnets, and failure paths.
No Phase 1 box was ticked.

The [runtime notes](../../[DOCS]/APP-RUNTIME.md) list source references and initial
limits. Home discovery/USB/add-ons, TV GPU acceleration, SSO, backups and app
updates are outside this first implementation. No Go dependency was added.
