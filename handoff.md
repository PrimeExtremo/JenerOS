# JenerOS — Handoff

Written by Claude for whoever picks this up next (Claude, ChatGPT, Codex, or Jener).
Last updated 2026-10-08. Read this file first, then [AGENTS.md](AGENTS.md).

## 1. Goal

JenerOS is an installable OS that replaces a pile of self-hosted apps with one system:
photos (Immich), files (Nextcloud), smart home (Home Assistant), TV (Jellyfin),
network ad-blocking (AdGuard Home / Pi-hole), VMs + storage (Proxmox + TrueNAS),
an optional router mode, and its own app store. One install, one login, one storage
pool, one dashboard. "iCloud, on your own hardware."

Runs on old PCs, mini PCs, Raspberry Pi 5/4 and VMs. Fire TV / Android TV get a
client app (they can't run the OS).

## 2. Who's who

| Who | Role |
|---|---|
| Jener (owner) | Decides direction, does installs/purchases/sign-ups, tests on real hardware |
| Claude (Claude Code) | Reviews changes and builds/tests images in the VMs |
| ChatGPT / Codex | Main builder: implements changes in this repo; cannot reach the VMs |

The company is **Jener, Inc.** (not yet formed). Public site: **jener.dev** (owned,
Cloudflare Registrar, bought 2026-10-07; site intentionally offline for now).
Code is public (early preview) at **github.com/PrimeExtremo/JenerOS** under GPL-3.0-or-later; installed systems update from its Releases.
Company socials planned as **@jener_inc**. Jener's personal accounts are NOT changing.

## 3. Current state (2026-10-08)

**Kiosk idle lighting (Codex, 2026-10-08):** Claude measured image 0.3.6 at 80-120% WPEWebProcess CPU while setup was idle under Cog/pixman (relayed by Jener). Local setup/login now omit the masked wallpaper light and recurring shine timer. Only a 128x2 card-border light sweeps once for 1.8s on load and once per actual setup step change, then releases its animation. Local CSS loops are disabled; local cards explicitly stay opaque with no backdrop blur. screen.html has no shine controller and disables CSS animations permanently. Non-local setup/login retain their continuous shine. The new check-kiosk-shine.cjs fixture covers no timers, finite effects, full-screen/pseudo-element animation checks and idle cleanup. Actual under-5% CPU acceptance still requires Cog/pixman measurement on the next authorized image. Files only; no builds, commits or pushes.

**Confirmed missing kiosk click + shine (Codex, 2026-10-08):** Jener relayed Claude's real-box trace on image 0.3.5, Cog 0.18.4 / libwpewebkit-2.0 2.48.3 in Cage on tty1 (VMware): correct pointer/mouse down/up targets, but no click for consent or the phone button. This supersedes the earlier CSS/hit-area/dialog hypotheses for that failure. ui-compat.js now repairs short primary-pointer taps only after a zero-delay timer sees no matching click, with native/late-click guards, drag/cancel/disabled/text-input exclusions and native element.click() defaults. All four pages already load it. Setup/login have faint 16s ribbon and 18s card-border shines, small transform/opacity layers at about 29 updates/sec, a fixed wallpaper, hidden-tab pause and full reduced-motion/transparency opt-outs. Seventeen workflow fixtures pass, including real Chromium default-action and lighting checks. Actual Cog clicks and pixman CPU/visual review remain pending. Files only; no builds, installs, commits or pushes.

**Welcome 0.3.4 follow-up + PC wallpapers (Codex, 2026-10-08):** consent now has an explicit 44x44 native input overlay; all check decorations ignore pointer events. The phone sheet opens before optional QR rendering, clears hidden state, uses a body-level fallback above the card, and falls back when showModal throws or leaves it invisible. All fifteen workflow fixtures pass, including a real Chromium/Edge visibility/hit-test fixture with 20 theme/width/API/QR cases. Original-file comparison reproduced the small hit area and QR-error opening failure; normal original Chromium modal opening passed, so the exact cause of every 0.3.4 hardware/browser failure remains unconfirmed. Four self-contained desktop SVGs plus a regeneration script/README are in [BRAND]/wallpapers (3440x1440 and 2560x1440, dark/light). The wizard J has .7 opacity and painted edges 40px from the right and 80px above the bottom. Actual Cog and PNG rendering remain for Jener/Claude. Files only; no builds, installs, commits or pushes.

**Welcome card / older WebKit fixes (Codex, 2026-10-08):** consent uses a centered grid/SVG checkbox; the phone button opens a QR/address/code sheet with Close/Escape and a modal fallback. Welcome only checks consent and code; blocked attempts explain the missing value inline. Removed regex lookbehind, replaceAll, Array.at and :has dependencies; guarded dialogs, timeouts and animation failure across setup/login/dashboard. The new unit-ordering fixture guards path/socket/timer units (including drop-ins) against After=jenerd.service with default dependencies. All fourteen workflow fixtures and dashboard JS syntax pass. Actual Cog/Chromium/Firefox visuals remain pending; see newest AI-UPDATES for evidence and root-cause limits. Files only; no VM access, image builds, commits or pushes.

**Setup kiosk controls (Codex, 2026-10-07):** the policy opens a scrollable in-page dialog using privacy.html's article. Close/Escape returns focus to consent; PDF download is hidden on BoxUI.local. English is a selected radio pill, keyboard/network use custom comboboxes, and timezone uses a custom searchable list. Existing submitted IDs/values remain. All twelve workflow fixtures and dashboard JS syntax pass. Real Cog, phone-width/light/dark rendering and screen-reader checks remain pending. Files only; no builds, commits or pushes.

**Kiosk fail-safe (Codex, 2026-10-07):** three kiosk starts per two minutes, then OnFailure displays a text screen on tty1 with the existing JENEROS banner, LAN/local URLs and setup code. Plymouth quit retains its splash and kiosk teardown no longer disallocates tty1. All eleven CI fixtures pass locally, including the new isolated fallback fixture. Actual systemd/visual boot checks remain pending. No image build, commit or push.

**Setup preview VM refresh (Codex, 2026-10-07):** Jener authorized a fresh 0.3.1 RELEASE=1 TEST_SSH=1 build on `zimaos-style` and replacement of the release-test disk. This session cannot read the Windows SSH config under `C:\Users\jener\.ssh`; `jeneros-build` does not resolve. Sync failed before changing the build VM. No build, disk replacement or VM stop/start ran. The existing test VM definition is readable and its MAC matches `00:0c:29:8f:74:0f`. See newest AI-UPDATES entry. This environment has no permission escalation.

**App Store, style-brief phase 3 (Claude cloud, 2026-10-08, branch `cloud/appstore`):** the App Store tile opens a Settings-style window with Discover, Search, My Apps, categories, app pages and a Form/YAML custom-install sheet (`[DASHBOARD]/store.js`, `store.css`). Data comes from `/api/store`; the manifest gained developer/added/description/whatsNew/screenshots. Install, start/stop and custom install show honest coming-soon states because jenerd can't install yet. Go vet/tests and a Chromium check at four sizes in both themes passed. Storage (phase 4) not started. Details: newest AI-UPDATES entry.

**Owner login and style phase 2 (Codex, 2026-10-07):** phase 1 passed Claude's live browser review in warm dark/cream light and Go vet/tests, as reported by Jener. Tile status is now at least 12px with AA contrast; reduced-transparency/high-contrast modes use solid surfaces without blur; notices use the width beside their button. A wallpaper login verifies only the system owner through a separate root Unix-socket helper. jenerd stays DynamicUser and never reads shadow. HttpOnly SameSite=Strict sessions, CSRF and login limits protect the whole API; only loopback box facts remain public. Setup is now Welcome/language/privacy PDF, Create account with inline errors and optional box settings, then Introducing JenerOS with four tiles and sign-in-aware Files/App Store/dashboard links. Local JavaScript and helper fixtures pass. New Go code/gofmt/race tests, systemd/password integration and rendered phase 2 review are pending on the build VM. Stopped after phase 2; no App Store redesign or Storage creation. Details: `.scratch/zimaos/PHASE-2-REVIEW.md`.

**Desktop restyle, style-brief phase 1 (Codex, 2026-10-07):** the dashboard now follows reference shots 11/26: left clock/system/storage/network widgets, CPU/RAM rings, a traffic graph, right search/notices/app grid, and top account/settings controls. One rounded settings window covers General, Storage, Network, Apps, Account and Power. Original warm SVG wallpapers, dark by default, cream light mode, local Bricolage and the monochrome angular J remain. Appearance, clock, avatar and widget choices are browser-local. Read-only CPU/network counters extend `/api/system`. The requested SSH switch queues an atomic `/run/jeneros/ssh.request`; a root path worker updates the persistent opt-in marker and starts/stops SSH including socket activation. It is gated on finished setup and preserves dev/test-key access. Existing update and rollback controls remain. Local desktop, fake-service SSH worker and existing rollback/screen fixtures pass. Claude has since reviewed this against live jenerd in both themes; prior Go vet/tests passed. See the newer owner-login/phase 2 entry above for subsequent work and its separate validation. At this original stopping point, setup restyle, App Store redesign and Storage creation had not started. Review/checklist: `.scratch/zimaos/PHASE-1-REVIEW.md` and newest AI-UPDATES entry.

**Box screens, consent and manual rollback (Codex, 2026-10-07):** tty2–6 use a versioned ANSI JENEROS banner from `/usr/lib/issue`, with explicit `/usr` getty drop-ins. The tty1 kiosk now shows the seven requested facts, live IP + hostname.local links/QR, SSH status and an S-key confirmation. The update center has the same previous-version button. Requests go through jenerd and a root path/oneshot worker; the worker selects the other bootable JenerOS UKI, sets it for the next boot and reboots. Updates and rollback share a root lock. Setup starts with English and required policy consent, has inline owner validation, and persists the server-stamped acceptance in `/var/lib/jeneros/privacy.json`. Releases now gate SSH off until local opt-in; dev/test keys retain access. The M4 design-only brief is `.scratch/installer/BRIEF.md`. JS, shell and Node fixtures pass. Go/gofmt, browser rendering and VM checks remain pending; see the newest AI-UPDATES entry. No phase boxes ticked.

**Phone setup reliability (Codex, 2026-10-07):** Avahi and the HTTP service now ship with defaults under `/usr`, exposed to Avahi through a read-only service mount. Setup restarts Avahi after choosing the box name. The QR uses refreshed `/api/system` LAN addresses, with large IP and hostname.local links and a cable hint when offline. Address selection excludes link-local and container interfaces. Setup cards are centered and uppercase heading labels removed. Node phone-flow/QR fixtures and shell syntax pass; Go/gofmt are unavailable here and the build-VM SSH alias cannot resolve. Go checks, live mDNS, Bridged phone access and visual review remain pending. See the latest AI-UPDATES entry.

**Graphical first boot (Codex, 2026-10-07):** the cancelled whiptail console files are removed. The new dashboard-style `/setup.html` works with a local screen or a phone QR link. The setup API requires the in-memory six-digit code and the existing CSRF header, validates choices, and queues a private request. A separate root Go subcommand applies keyboard/timezone/name, creates the owner with sudo, sets the password through stdin, and optionally applies a fixed network address. The persistent setup-done marker closes every setup endpoint. A non-root Cage + Cog kiosk owns release tty1 and shows `/screen.html` after setup. Dev images skip setup and mask the kiosk to preserve their existing tty1 autologin. All unit links ship in `/usr`. Claude's firstboot-off, locale, timezone and keymap settings remain. JS/shell syntax and four independent QR matrix fixtures pass locally; Go is absent here, and Go formatting/vet/tests, image boot and visual review are pending. Exact checklist: newest Codex entry in `[DOCS]/AI-UPDATES.md`; design notes in `.scratch/setup/DESIGN.md`. No Phase 1 boxes were ticked.

**Login greeting (Codex, 2026-10-07):** `/usr/lib/jeneros/hello` and its interactive profile hook are in the image overlay. Boot-time tmpfiles links refresh `/etc/profile.d/jeneros-hello.sh` and silence `/etc/motd` across A/B updates. The monochrome five-line J, live summary, and rotating tips passed local fixture checks; SSH/console and tmpfiles behavior in the built VM remain to verify.

**Logo artwork (Codex, 2026-10-07):** Jener approved the original angular v1 style. `[BRAND]/logo/` restores its exact heavy squared J, 45-degree bevel, matching square accent, and wide chamfered JENEROS capitals, now monochrome `#16161D` / `#F7F7F9`. All assets have transparent backgrounds; rounded v2 is retired. Wordmarks restore the 1472 x 320 canvas. Usage is in `[BRAND]/logo/README.md`; browser and updated live boot checks remain pending.

**Phase 0 (skeleton) — done, not yet committed.**
- `[CORE]/` — `jenerd` daemon in Go (stdlib only). Serves `/api/system`, `/api/store`,
  `POST /api/apps/{id}/install` (returns 501 until Phase 2), and the dashboard.
  **Never compiled yet** — Go isn't installed on Windows; first compile happens in the build VM.
- `[DASHBOARD]/` — static HTML/CSS/JS. Works with clearly labelled sample data when
  `jenerd` isn't running. The current warm desktop restyle has local fixture checks;
  its browser visual review is still pending.
- `[STORE]/apps/` — 5 manifests: photos, drive, home, tv, relay. Codex review fixes
  applied (Nextcloud `POSTGRES_DB`/`POSTGRES_USER`; Immich `IMMICH_MACHINE_LEARNING_URL`).
- `[SPEC]/app-manifest.md` — store manifest format v1.

**Phase 1 (bootable image) — M1 + M2 work (2026-10-07).** JenerOS boots in VMware (`S:\[VMs]\[JENEROS]`, currently 0.2.1 at http://192.168.27.134), read-only verified `/usr` in A/B slots, root grows to fill the disk, updates install from the build VM's update server (`[OS]/serve-updates.sh`, port 8000) and a broken update rolls back automatically. Commits on `main`. Codex review of M1+M2 pending.
- `[OS]/mkosi.conf` — Debian 13 trixie, amd64, UEFI + systemd-boot, DHCP, SSH, jenerd on :80.
- `[OS]/build.sh` — builds jenerd → mkosi image → VMware `.vmdk` in `S:\[VMs]\[JENEROS]`.
- `[OS]/setup-build-vm.sh` — installs mkosi, Go, qemu-utils in the build VM.
- `[OS]/vmware/jeneros.vmx` — VM definition (UEFI, 4 GB, 2 vCPU, NAT, nested virt on for Incus VMs later).
- **Build machine = a Debian 13 VM in VMware** (`S:\[VMs]\[JENEROS-BUILD]`), reached over SSH.
  WSL was tried and dropped (2026-10-07): WSL2 needs the Windows hypervisor, which slows VMware and Jener's lab VMs.
- **Blocked on:** Jener uninstalling WSL + rebooting, then installing the build VM.

## 4. Decisions (don't reopen without asking Jener)

| Decision | Choice | Why / where |
|---|---|---|
| Base OS | Debian 13 "trixie" | Same base as TrueNAS 26, Proxmox 9, umbrelOS. See `[DOCS]/OS-PLAN.md` §1–2 |
| Image build | mkosi | Reproducible disk images from a config file |
| Updates | Immutable root, A/B partitions, systemd-sysupdate, auto-rollback | Phase 1 milestone 2 |
| Apps + VMs | Incus 7.0 LTS (OCI app containers, LXC, KVM) | Replaces Docker AND Proxmox's engine. No Docker daemon on the OS |
| Storage | **Portable by design**: btrfs pools (single/mirror/raid1c3/raid10, never raid5/6) or "simple disks" (ext4/XFS per disk + mergerfs + SnapRAID). ZFS = import existing pools only | Jener's rule: data disks must work on any Linux without wiping. See `[DOCS]/STORAGE.md` |
| Core daemon | Go, stdlib only so far | Single static binary, easy arm64 cross-compile |
| Brand look | Cream `#F6F1E7`, brown `#1F1913`, decorative Claude orange `#D97757`, button fill `#B9562F`; angular v1 J and custom wide chamfered capitals | Jener explicitly requested this palette for the box screens/setup/installer on 2026-10-07, superseding the monochrome/no-orange note. Keep JenerOS artwork and wording original |
| Name | JenerOS by Jener, Inc. | "Labs" rejected; personal handles off-limits |

## 5. Hard rules

1. **Nothing goes on C: except programs.** VM disks, ISOs, build output for VMs →
   `S:\[VMs]\...`. (Jener's homelab rule.) The repo itself lives at `C:\Users\jener\jeneros`.
2. Folders on Jener's drives use `[BRACKET]` names. In PowerShell use `-LiteralPath`
   (brackets are wildcards); in bash, quote the path.
3. Jener does installs, purchases, account sign-ups and anything admin/system-level.
   AIs prepare commands and explain; they don't run them.
4. Don't commit or push unless Jener asks. Repo has **no commits yet**.
5. Don't use the Arvey name or logo anywhere in JenerOS.
6. Data disks must stay readable by any Linux: no ZFS by default, plain top-level folders, LUKS2 with a recovery key.
7. Router mode ships last (Phase 7) — a bug there takes the house offline.
8. After every change, append a short entry to `[DOCS]/AI-UPDATES.md` so the other AI knows.

## 6. Next steps (in order)

Kiosk CPU follow-up: on the next separately authorized image, Claude/Jener should measure WPEWebProcess idle CPU for at least 60 seconds after the 1.8s sweep settles on Welcome, Create account and the permanent screen.html page. Target: under 5% of one core with WLR_RENDERER=pixman. Confirm one gentle top-border sweep on load/step change, none on same-step input/network polls/tab return, no wallpaper motion, solid cards, and unchanged continuous shine on a phone/PC LAN URL. Repeat the existing click/consent/phone-sheet checks. Chromium fixtures establish animation lifecycle, not WPE software-renderer CPU. No build is authorized by this file-only task; the older continuous-local-shine recommendation below is superseded.

Missing-click follow-up: on the next authorized image, Claude/Jener should repeat the event trace in Cog, confirm one click/change per consent tap, phone sheet open/Close, privacy, Continue and custom choices, then check login/screen/dashboard controls. Exercise physical mouse, Space/Enter, touch and drags in Chromium/Firefox/phones; the automated native-click sequences are synthetic, with a modeled trusted delayed-click check. Inspect the subtle ribbon/top-border shines in both themes and measure idle CPU/frame cost under WLR_RENDERER=pixman; confirm hidden-tab pause and reduced-motion/transparency settings. New fixtures: .scratch/setup/check-click-shim.cjs and check-shine.cjs. No build is authorized by this file-only task. Older Welcome entries below remain historical checks; their unconfirmed root-cause discussion is superseded by the 0.3.5 trace above.

Welcome 0.3.4 follow-up: on the next authorized image, click the painted checkbox and its surrounding 44x44 area, click the consent text, and toggle with keyboard Space in dark/light Cog and desktop browsers. With only consent ticked and the kiosk-provided code, Continue must open Create account. The phone sheet must visibly cover the card, focus Close, and hide/return focus with Close or real Escape; verify QR, live LAN/.local addresses and code. Capture console errors/network asset versions if any failure remains: the current files open normally in Chromium, while the original QR-error path demonstrably aborts opening. Browser fixture: .scratch/setup/check-welcome-browser.cjs (WELCOME_BROWSER points to an installed Chromium/Firefox/Zen executable); file fixture: check-welcome.cjs. Also review policy and fallback dashboard/store/rollback dialogs after the shared modal guard change. Claude should render [BRAND]/wallpapers SVGs to native-size PNGs on the build VM, store output on S:, and check the 40px right / 80px bottom painted-mark clearance on Jener's two screens. No image/PNG was built here.

Setup controls follow-up: test the privacy sheet on the actual tty1 Cog kiosk and a phone/computer. Check policy scroll, Close/Escape and consent focus, PDF download hidden locally and available remotely. Review English, keyboard/network list popovers and timezone search in both themes at 320/390px; check keyboard/type-ahead, touch and screen-reader announcements. Filtering preserves the chosen timezone until another is selected. See .scratch/setup/check-controls.cjs and the newest AI-UPDATES entry. No image was built for this fix.

Kiosk fail-safe follow-up: in a disposable release VM, force three renderer failures within 120 seconds. Verify retries stop, tty1 shows the banner, LAN URL and six-digit code, and no black transition occurs during boot or retries. Check healthy Cage boot, completed setup, offline networking, dev tty1 autologin and /usr unit links after an A/B update. File fixture: `.scratch/setup/check-kiosk-fallback.cjs`; actual boot checks remain pending.

Resume Jener's seven-step setup-preview request in a session with access to the existing SSH config/key and write access to `S:\[VMs]\[JENEROS-RELEASE-TEST]`. Sync, build 0.3.1 with RELEASE=1 TEST_SSH=1 (require `Done: JenerOS 0.3.1`), stop the test VM, fetch its new disk while preserving the existing VMX, then start and check LAN HTTP, services, setup code and boot warnings. Leave the wizard for Jener; never publish this test-key image. Do not commit or push.

Owner-login / phase 2 follow-up: Claude should run gofmt, vet, tests and race tests for the new auth code on the build VM, then verify the private root socket, DynamicUser ownership, system-owner password and expiry checks, throttling, session revocation and unauthenticated action denial. Review login and all three setup cards in both themes/responsive sizes, PDF fallback, optional settings, fixed-address continuation, intro destinations and kiosk sign-in before rollback. Existing HTTP transport has no encryption; older dev images with no setup owner marker fail closed. See `.scratch/zimaos/PHASE-2-REVIEW.md` for exact commands, limits and review cases. No images or git operations were performed. Stop here until Jener requests phase 3; App Store redesign and Storage creation remain later phases.

App Store follow-up: Jener reviews the store window on desktop and phone. Real install/start/stop needs the Incus runtime (Phase 2); then wire the Install ring to real progress and fill My Apps uptime/memory/CPU. Add real screenshots per app when available. Do not start style phase 4 (Storage) until Jener asks.


Box/setup follow-up: Claude should run gofmt, vet/test/build on the build VM, then verify consent persistence, strict owner validation, tty2–6 issue expansion at 80×25, kiosk facts/QR/SSH status, dashboard and S-key confirmation, other-UKI selection and failure without reboot on a one-slot system. Verify root unit links arrive through `/usr` on A/B updates. Releases keep SSH off until opt-in: the new dashboard switch is available after setup, and local opt-in with `sudo touch /var/lib/jeneros/ssh-enabled` and `sudo systemctl start ssh.service` remains a recovery option. Owner creation does not automatically allow SSH. Dev/TEST_SSH key access remains exempt. Review `.scratch/installer/BRIEF.md` before M4 implementation; it contains no code. Preserve the earlier box/setup checks in AI-UPDATES as well as the newest desktop checklist.

Phone setup follow-up: run gofmt, go vet and go test in `[CORE]` on the build VM. In a Bridged JenerOS test VM, verify both IP and `.local` phone links, HTTP discovery, cable disconnect/reconnect, the chosen hostname after setup, and the centered layout in light/dark modes. Confirm Avahi uses `/usr` defaults after an A/B update. Details and commands are in the newest AI-UPDATES entry.

Login follow-up: Claude should verify a fresh boot and an A/B update create the profile and MOTD links, the helper is executable, SSH/console show the greeting, and SCP/rsync and `ssh host command` remain quiet. Check live metrics and update states against the dashboard.

Logo follow-up: Claude can embed the approved angular v1 monochrome assets and regenerate the Plymouth watermark. Set the boot theme background to `#16161D` and preserve the restored wordmark aspect ratio (1472 x 320). The separate SSH task should align its existing text-art J with angular v1; SSH files were left untouched by this logo change. Live boot integration and the Phase 1 completion check remain pending.

1. **Claude:** format and test the new Go setup code in the build VM, then build a fresh release image. Follow the newest Codex checklist in `[DOCS]/AI-UPDATES.md`.
2. **Claude:** verify release kiosk setup, phone QR/code flow, fixed-address change, owner SSH/sudo, reboot persistence, and a separate dev build. Review the light/dark UI on desktop and phone. Report fixes or failures back to Codex.
3. **Jener:** try setup on a phone and the box's own screen; confirm the copy and touch targets feel right.
4. Continue the remaining Phase 1 storage/Incus and installer work in `[DOCS]/PHASE-1.md`. First-boot milestone boxes stay open until their full VM checks pass.

## 7. Open questions for Jener

- First real hardware to test on after the VM (which spare PC / Pi)?
- Make the first git commit now so Codex can review a commit instead of a working tree?

## 8. File map

| Path | What |
|---|---|
| `handoff.md` | This file |
| `AGENTS.md` | Rules for any AI working here (Codex reads it automatically) |
| `CLAUDE.md` | Points Claude Code at AGENTS.md |
| `[DOCS]/ARCHITECTURE.md` | Full system design |
| `[DOCS]/RELEASING.md` | How to build, test and publish a GitHub release |
| `[DOCS]/BUILD-VM.md` | How the Debian build VM was set up + SSH access |
| `[DOCS]/STORAGE.md` | Portable storage design (btrfs / simple disks, no ZFS by default) |
| `[DOCS]/RESEARCH.md` | How other self-hosting OSes are built; IncusOS lessons |
| `[DOCS]/OS-PLAN.md` | OS base research + decisions, naming, brand tokens |
| `[DOCS]/PHASE-1.md` | Step-by-step Phase 1 task list with owners and "done" checks |
| `[DOCS]/ROADMAP.md` | All phases |
| `[DOCS]/AI-UPDATES.md` | Running log of what each AI changed (newest at bottom) |
| `[SPEC]/app-manifest.md` | Store app format |
| `[CORE]/` | `jenerd` (Go) |
| `[DASHBOARD]/` | Web UI |
| `[STORE]/apps/` | Store catalog |
| `[OS]/` | Image build (mkosi config, overlay files, scripts, VMware template) — runs in the build VM |
| `[BRAND]/` | Brand tokens + future logo files |
| `[CLIENTS]/` | Future TV / phone apps (empty for now) |
