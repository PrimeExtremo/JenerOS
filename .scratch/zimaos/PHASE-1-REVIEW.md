# Style phase 1: dashboard, settings and wallpaper

Implemented by Codex, 2026-10-07. Stopped here as requested.
This is style-brief phase 1, not completion of the bootable-image Phase 1 checklist.

## Reference mapping

Opened and studied the local shots; none are served by the dashboard.

| Shots | Implemented |
|---|---|
| 11, 26 | Left clock/System/Storage/Network widgets; CPU/RAM rings; traffic graph; widget picker. Right search, swipeable notices/dots and large app tiles; account/settings at top left. |
| 12, 18 | Rounded sidebar settings window, device/name/IP/details card, version/update controls, appearance/wallpaper, clock timezone/format, SSH. Storage overview and disk illustration only; creation remains phase 4. |
| 19 | Active home-connection rows and addresses. Remote access is explicitly coming soon. |
| 20 | App data/cleanup placeholders with an existing catalog entry point. No invented usage or storage paths. |
| 21 | Owner card, original face avatar and saved color choice. Password changes/family members are coming later, with no paid limits. |

Original SVG ribbon/dune wallpapers and plain paper, warm dark default/cream light.
Preferences are local to the browser, not server settings. Local Bricolage 700 and
the monochrome angular v1 J remain. Files, Photos, Backup and Machines open honest
coming-soon panels. App Store opens the existing simple catalog; phase 3 redesign
has not started. No disk discovery or app-install percentages are fabricated.
The Storage badge says System disk/Almost full because SMART health isn't available.

## Implementation details

- Desktop styling is isolated in `desktop.css`; shared `style.css`, setup,
  kiosk and privacy pages were not edited by this phase.
- `/api/system` adds cumulative CPU and per-home-interface receive/transmit
  counters. Browser differences produce CPU usage and bytes/sec. Guest CPU time
  isn't counted twice; missing/reset counters display unavailable, not zero.
  Counter fields were checked against the [Linux kernel /proc documentation](https://www.kernel.org/doc/html/latest/filesystems/proc.html).
- After a lost connection, clear traffic history/CPU; label retained disk/RAM
  numbers as the last reading. Reconnection starts a new baseline.
- Existing update/check/rollback and CSRF behavior remain. An ordinary lost
  connection no longer claims the box is restarting.
- SSH GET/POST: `/api/settings/ssh`; finished setup required, dev-key images
  protected, strict boolean input and existing `X-JenerOS` check. The daemon
  atomically links a complete private enable/disable request into `/run/jeneros`.
  Root handles only fixed actions, persists the opt-in marker, stops both service
  and socket on disable, consumes failures and preserves an existing marker if
  starting/stopping fails. The UI uses the actual port-22 listener.
- New helper/units and activation links ship in `/usr`; state is in `/run` and
  `/var/lib/jeneros`. The existing release SSH conditions remain. Explicit SSH
  service activation ensures a saved release opt-in is checked again on boot.
- SSH uses the existing LAN/CSRF API boundary. Dashboard owner authentication
  remains unfinished project work; this phase did not claim to implement it.

## Checks passed here

```powershell
node .scratch/zimaos/check-desktop.cjs
node .scratch/zimaos/check-ssh-helper.cjs
node .scratch/setup/check-rollback.cjs
node .scratch/setup/check-screen.cjs
node --check '[DASHBOARD]/app.js'
node --check '[DASHBOARD]/desktop-preferences.js'
node --check '[DASHBOARD]/desktop-metrics.js'
sh -n '[OS]/mkosi.extra/usr/lib/jeneros/ssh-access'
sh -n '[OS]/mkosi.postinst.chroot'
git diff --check
```

Desktop fixtures cover IDs/assets, escaped facts, search, settings sections,
preferences with blocked/corrupt storage, counter resets/missing values/offline,
SSH submission/status/errors/dev guard and update offline behavior. Root fixtures
run a rewritten helper with workspace paths and fake systemctl/flock only: enable,
disable, invalid request, pre-setup/dev guards, failed start/new-vs-existing marker
and failed stop. No real services or PC settings were changed.

## Still needs Claude / a connected browser

No browser surfaces were connected; no rendered visual comparison was possible.
Go/gofmt are absent on Windows; Go tests were added but have not run. No impeccable
detector was available among tools/skills. No installs, images, commits or pushes.

On the build VM, before any future image work:

```sh
cd ~/jeneros/'[CORE]'
gofmt -w cmd/jenerd/main.go internal/access/*.go internal/api/ssh*.go internal/system/*.go
go vet ./...
go test ./...
go build ./...
```

Then check on a disposable updated box:

1. Compare the dashboard/settings to shots 11/12/18–21/26 at desktop, 800×600,
   and 390px/320px widths. Check both themes, scrolling, wallpaper and offline font.
2. Tab/Escape and arrows stay inside the top modal, including rollback confirmation;
   close restores focus. Search preserves text editing. Verify reduced motion.
3. Swipe/click/arrow notices; dots and previous/next agree after a resize. Browser
   reload preserves theme/wallpaper/clock/avatar/widgets; denied storage still works.
4. Match CPU/RAM/disk to the box. Generate LAN traffic, compare receive/transmit,
   unplug/replug and reboot; stale history must clear. Older APIs lacking new
   counters must show unavailable readings.
5. Run systemd-analyze verify for the new SSH path/service. Check helper mode 0755,
   `/usr` activation links and fresh/reboot/A/B opt-in persistence.
6. Before setup, SSH POST returns 503. After setup, enable/disable, verify port 22
   and both service/socket, owner login, duplicate 409 and failure/retry. Verify
   dev/TEST_SSH images reject changes and retain testing access. Confirm no worker
   loop after a failed request and no real SSH enablement on a fresh release.
7. Recheck live update/check and previous-version cancel/confirm in the new window.

Next style phase is setup cards, only when Jener asks.
