# First-boot setup and the local screen

Built 2026-10-07. Follows the current dashboard surface contract.

| Choice | Result |
|---|---|
| Shared style.css | Same cream cards, warm brown dark mode, orange actions and local Bricolage headings as the dashboard |
| One card per step | Welcome, keyboard, timezone, name, owner, network, summary, done |
| Progress row | Eight named steps; current step uses the dashboard's filled ink pill |
| Forms | Visible labels, native select controls, 52px inputs and action buttons, Back preserves choices |
| Keyboard and remote | Tab, Enter and spatial arrow focus; native inputs retain their editing keys |
| Phone | One column below 800px; no external fonts, scripts or QR service |
| Passwords | Show/hide toggle, no summary echo, no browser storage; cleared after acceptance and failure |
| Box screen | Angular J, live hostname/address, dashboard QR, real stats and installed version |

Code review: checked visible focus, labels, headings, native form navigation,
live messages, reduced motion, and shared light/dark text colors. No new raster
artwork. Verdict: implementation ready for VM and visual review;
browser screenshots and Cage rendering have not been verified here.

QR implementation is original MIT code in vendor/qrcode.js. Its fixed Version
5-L/mask-0 matrix was compared against davidshimjs/qrcodejs at Git blob
5507c154ffc1b9d061c55d88268a26eeba49a36e for four URL fixtures. No upstream
implementation or third-party runtime dependency ships with this generator.
Run `node .scratch/setup/check-qr.cjs` from the repo root.

Debian sources checked:
- https://packages.debian.org/trixie/amd64/cog
- https://packages.debian.org/trixie/amd64/cage
- https://packages.debian.org/trixie/all/console-data/filelist
- https://manpages.debian.org/trixie/keyboard-configuration/keyboard.5.en.html
- https://manpages.debian.org/trixie/console-setup/setupcon.1.en.html

Cog is the selected small single-window WPE browser. Its WebKit and graphics
dependencies still need a real image build and GPU/VMware smoke test. No Firefox
fallback is packaged because Cog is available in trixie.
