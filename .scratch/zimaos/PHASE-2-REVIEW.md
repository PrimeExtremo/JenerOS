# Style phase 2 and owner login

Implemented by Codex, 2026-10-07. Stopped after phase 2.
Claude's prior phase 1 browser review and Go vet/tests passed, as reported by Jener.
The new authentication Go code has not been formatted or run here: Go is absent
on Windows. No connected browser was available for a rendered phase 2 review.

## What changed

| Area | Result |
|---|---|
| Tile status | 0.75rem (12px at the default root size), foreground ink. Even composited over pure white/dark wallpaper, contrast is 7.86:1 dark / 12.93:1 light. Hover and solid surfaces also pass. |
| Accessibility preferences | Both `prefers-reduced-transparency: reduce` and `prefers-contrast: more` replace glass with solid cards and disable backdrop filters. Increased contrast strengthens borders and secondary text. |
| Notices | Text uses the remaining grid column beside the button, without a character-width cap. Cards stack text/button below 960px. |
| Login | `/login` and `/login.html`, same wallpaper and centered warm card. Username/current password, inline errors, password visibility, pending state, rate-limit feedback, safe local return paths. |
| Setup | Shots 08–10 studied. Welcome/language/privacy → Create account → Introducing JenerOS. Original J and artwork; no copied product assets. |
| Welcome | Two-line title, language and consent at lower left, round orange next control at lower right. `privacy.pdf` opens separately; `privacy.html` remains an explicit readable fallback. |
| Account | Existing strict inline username/password/confirmation checks. Keyboard/timezone/name/network choices stay in optional Box settings with defaults. Invalid hidden settings open before focus. |
| Introduction | Four original feature tiles with honest availability text. Files, App Store and dashboard links go through sign-in and return to the correct panel. Local setup can show the box screen. |

Apple principles used: `apple-design/references/hig/accessibility.md`,
`typography.md`, `color.md`, `layout.md`, `entering-data.md`, `text-fields.md`,
`onboarding.md`, `materials.md`, and the cross-platform translation. Kept the
user's chosen wallpaper/card design while adding solid material alternatives.
No web-interface-guidelines skill or impeccable detector was found locally or
among callable tools.

## Authentication boundary

- `internal/auth` is Go stdlib only. The unprivileged daemon does not read shadow.
- Root `jenerd auth-helper` accepts bounded JSON only on systemd's inherited Unix
  socket. `/run/jeneros-auth.sock` is outside the daemon's writable runtime
  directory; mode 0600 belongs to its active DynamicUser. Socket starts after
  jenerd allocates that user and stops with it. No TCP helper port.
- Root reads the setup owner marker and refuses other users or unfinished setup.
  It uses fixed `/usr/sbin/unix_chkpwd` `nonull` and `chkexpiry` checks. Password
  input is NUL terminated on stdin, never an argument, request file or log. Locked,
  blank and expired accounts/passwords fail. There is no PAM conversation or cgo.
- OS explicitly includes `libpam-modules-bin` (existing Debian checker) and
  `libnss-systemd` (DynamicUser name resolution for SocketUser). No Go dependency.
- Random 256-bit session tokens; only their SHA-256 keys live in server memory.
  Cookie is HttpOnly, SameSite=Strict, path `/`, expires after 8 hours. Login rotates
  this browser's session; sign-out revokes it; daemon restart revokes all sessions.
  Sessions are bounded to 128. Neither password nor token goes into browser storage.
- One outer middleware protects current and future APIs. All mutations need both
  the session and `X-JenerOS: 1`. SSH, update/check/rollback and install/remove have
  no loopback exemption. Reads also require login except GET `/api/system` for the
  loopback box screen. Peer address comes from the connection, never forwarded headers.
- Bootstrap exceptions: login/session inspection, and setup's existing one-time
  code + consent + done-marker boundary. Setup endpoints close after completion.
- Five attempts per peer per minute; 30 globally per minute. Attempts reserve a
  slot before checking passwords, preventing concurrent bypass. Success resets
  the peer counter; the global cap also bounds verification work. Root separately
  caps checks to 30/minute. All in-memory limit tables are bounded.
- Failure is closed: no helper, no owner marker, wrong password or expired cookie
  cannot authorize actions. `-setup=false` does not disable owner authentication.
- Local kiosk facts stay visible; S offers sign-in, then the usual explicit rollback
  confirmation. Sign-in never submits rollback automatically.

Transport remains the existing HTTP service. Credentials/session traffic on HTTP
is unencrypted; direct HTTPS sets Secure cookies. Forwarded HTTPS headers are not
trusted. TLS deployment was not implemented in this phase. Older dev images that
skip setup and have no owner marker cannot sign in; do not invent a default password
or bypass the gate for them.

Implementation references: [Linux-PAM 1.7.0 checker source](https://github.com/linux-pam/linux-pam/blob/v1.7.0/modules/pam_unix/unix_chkpwd.c),
[Debian checker package files](https://packages.debian.org/trixie/amd64/libpam-modules-bin/filelist),
[systemd socket ownership](https://github.com/systemd/systemd/blob/v257/man/systemd.socket.xml),
[DynamicUser / NSS](https://github.com/systemd/systemd/blob/v257/man/systemd.exec.xml).

## Checked locally

- Node syntax: setup, login, session, desktop, screen and rollback scripts.
- `check-login.cjs`: inline failure, cleared password, CSRF, retry limit, unsafe
  return URLs, expired-session redirection, PDF fallback, three cards/four tiles.
- `check-onboarding.cjs`: welcome/account/apply/introduction transitions, consent,
  full setup request, fixed-address continuation, cleared password/code, destination links.
- Existing desktop, setup validation, phone, rollback, kiosk, pages/privacy and QR
  fixtures. Fake-service SSH helper checks pass; no real service was changed.
- Changed-file LF/no BOM/trailing whitespace and worst-case tile contrast checks.
- Go tests added for sessions/expiry/rotation/logout/forgery, root owner restriction,
  bounded helper protocol, login parsing/CSRF/failure/limits, every dangerous endpoint,
  authorized action queues and future endpoint protection. Not run on Windows.

## Claude: required before release

Run on the build VM, without building an OS image in this review:

```sh
cd ~/jeneros/'[CORE]'
gofmt -w cmd/jenerd/main.go internal/api/auth*.go internal/api/api.go internal/auth/*.go
go vet ./...
go test ./...
go test -race ./...
```

1. Fix any Go failures first. Tests only use temp files and fake verification;
   they do not change real passwords or reboot.
2. Validate `jeneros-auth.socket/service` and the daemon unit with systemd-analyze.
   In a disposable existing test environment, verify NSS resolves the active
   DynamicUser, socket UID/mode 0600, inherited fd 3, restart ownership and helper
   sandbox. Test actual setup-owner yescrypt passwords, wrong/non-owner/locked/
   expired accounts and stopped helper. Confirm jenerd cannot read shadow.
3. Before sign-in, LAN and loopback POSTs to SSH/update/check/rollback/install/remove
   with `X-JenerOS: 1` must return 401 and create no action files. A valid cookie
   without the header must return 403. After logout/expiry/restart, old cookies fail.
   GET `/api/system` works unauthenticated only from loopback. Verify repeated failures
   return 429 and allow retry after a minute; forwarded peer headers do not help.
4. Review login/setup in both themes at desktop, 800×600, 390px and 320px, offline
   fonts, text zoom, keyboard/TV remote and reduced motion/transparency/high contrast.
   Check PDF plus webpage fallback, preserved setup code, inline error correction,
   default/expanded settings, fixed-address loss/reconnect, application failure/retry,
   intro link destinations and explicit kiosk sign-in/rollback confirmation.
5. Check actual notice wrapping/button layout and tile labels against both wallpapers.
   Previous phase 1 browser approval remains valid for the earlier version; these
   changed areas need their own review.

No phase 3 App Store redesign or phase 4 Storage creation was started. No OS image,
install, admin command, commit, push or git command. Bootable Phase 1 milestone boxes
remain untouched pending their real done checks.
