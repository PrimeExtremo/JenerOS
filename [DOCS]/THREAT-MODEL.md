# JenerOS threat model

The box holds personal files, app data, owner credentials, sessions, app secrets
and an update trust key. Losing these, or letting someone change the operating
system, is the main risk. This is a home-network preview, not a hardened hosting
platform. A clean scan alone cannot prove these boundaries work.

| Boundary | Protection | Limits |
|---|---|---|
| LAN browser to dashboard | HTTPS on 443; TLS 1.2 or newer; owner session and same-origin request header | The certificate is self-signed. Compare its SHA-256 fingerprint with the physical box before entering credentials. A first HTTP visit can still be intercepted. |
| Physical screen to local API | HTTP only when both peer and Host are loopback; only setup code and system facts are public locally | Local users and physical access are trusted. The kiosk cannot display the normal browser certificate exception flow. |
| Setup to root account creation | Random six-digit code; five attempts per IP and twenty overall per initial minute; ten incorrect codes rotate it | Limits are in memory and reset on daemon restart. Distributed attempts can deny setup temporarily. A photographed QR/code grants setup access. |
| Login to password verifier | Separate private Unix socket; Debian password check for the owner even for other valid names; generic errors; five attempts per IP and thirty overall per initial minute | Backoff doubles subsequent full windows to at most sixteen minutes and clears after thirty idle minutes beyond the window. Syntactically invalid input is rejected before password work. |
| Browser to owner session | Random 256-bit tokens stored by hash; eight-hour expiry; new login revokes that browser's old token; HttpOnly, SameSite=Strict | TLS uses a Secure, host-only `__Host-jeneros_session` cookie. Loopback uses a separate cookie name. Other signed-in browsers stay signed in. Restart revokes all sessions. |
| Dashboard to root workers | DynamicUser daemon without shadow, Incus socket or raw disk privileges; fixed requests; root workers revalidate data | Compromise of the owner or a root worker is serious. Sandboxes limit damage but do not remove a worker's intended authority. |
| Update server to installed OS | Release SHA256SUMS signed with a build-VM key; shipped public keyring; Verify=yes; A/B boot recovery | Old unsigned releases need a trusted bootstrap. Signatures do not guarantee freshness against withheld/replayed releases, nor replace Secure Boot. |
| Apps to host and other apps | Unprivileged Incus containers, separate bridges, pinned catalog images, private secrets and data roots | App web ports have each app's own authentication and may use HTTP. Dashboard HTTPS does not secure those apps. Containers share the kernel; Incus control is root-equivalent. |
| Physical disks and console | Read-only verified /usr; password logins; release SSH off until enabled | Writable state and user data are not encrypted by this change. An attacker with physical access can change the boot chain or read disks. |

## Transport and browser details

Every LAN HTTP GET/HEAD redirects to HTTPS, including first setup. Other HTTP
methods return 426 before reaching authentication or setup; credentials must never
be submitted on that first cleartext hop. Loopback HTTP stays available for Cage,
local health checks and recovery. Development runs without `-tls-addr` are HTTP
and are not release configurations.

The private certificate/key bundle lives in systemd's private `jeneros-tls` state
directory, mode 0700, with the bundle mode 0600. Root and jenerd can read it; the
web file tree cannot. Names and LAN IPs are checked every thirty seconds. A name
or address change or approaching expiry replaces the certificate atomically and
changes the fingerprint. Settings and the physical setup/status screen show it.
No HSTS is sent: an owner must be able to recover from a changed self-signed LAN
certificate. Do not make a general browser exception without comparing the code.

CSP disallows inline scripts, eval, remote scripts, objects and framing. Inline
styles remain allowed for the dashboard's existing layout/animation code and SVG
icons. Permissions-Policy disables camera, microphone, location, payment and USB.
COOP and CORP use same-origin. These controls reduce exposure; they do not fix a
script bug or make injected same-origin files trustworthy.

## Network and service limits

The inbound nftables table defaults to drop. It permits web, mDNS, DHCP, ICMP and
rate-limited SSH, plus the four pinned app web ports. Incus bridges can ask the
host for DHCP/DNS. No forwarding chain or global ruleset flush is added; Incus
owns its routing/firewall tables. LLMNR and resolved's mDNS stay off; Avahi still
provides `.local`. Loose reverse-path filtering preserves bridge/asymmetric
routing. SSH releases deny root login and retain owner key/password access.
Development and TEST_SSH images retain key-only root access and must not be published.
The SSH greeting has no JenerOS version; the mandatory SSH protocol identification
still identifies OpenSSH and must not be mistaken for a removed protocol banner.
The algorithm allowlist follows the options available in [Debian 13's SSH server](https://manpages.debian.org/trixie/openssh-server/sshd_config.5.en.html).

The daemon and compatible workers use no-new-privileges, restricted syscalls,
address families and capabilities, with private temp/home/device views where
possible. Exceptions must be tested, not hidden to improve a sandbox score:

| Worker | Required exception |
|---|---|
| jenerd | Visible /dev for read-only inventory; only bind-service capability; private writable TLS state and request directory |
| Setup | Writes /etc, /home and /var for accounts, PAM and network/keyboard state; console devices and tty capability; owner home creation |
| Storage | Host mount namespace and real disk devices; administrative block-device ioctls; no filesystem-isolating directives because new mounts must remain visible during the job |
| Update/rollback/health | Boot files, block reads/writes where needed and EFI variable access; update can mount an ESP |
| App workers | Writable JenerOS data roots and Incus Unix socket; init has an empty temporary /root for Incus CLI config |
| Firewall | Network-admin capability; no PrivateTmp dependency during early sysinit |
| Text-screen fallback | Real tty device and tty capability |

The Cage/WebKit kiosk and the Incus daemon keep their existing upstream execution
requirements. Broad restrictions on their namespaces, device access or executable
memory can break display/container startup. They need separate runtime review.
