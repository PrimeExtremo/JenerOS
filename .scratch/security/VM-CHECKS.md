# Security hardening acceptance

Files only in this run. These commands are for Claude/Jener on the Debian build
VM and a disposable JenerOS VM after separately authorizing builds/VM changes.
Do not run these as Windows administrator. Keep VM disks and build output on S:.
Preserve 0.4.1 firewall/LLMNR and 0.4.2's setup limit acceptance results.

## Before an image build (build VM)

```bash
cd ~/jeneros/'[CORE]'
gofmt -w cmd internal
go vet ./...
go test ./...
go test -race ./internal/transport ./internal/auth ./internal/setup ./internal/api ./internal/runtime ./internal/catalog
go build ./...
cd ..
for f in '[DASHBOARD]'/*.js; do node --check "$f"; done
node .scratch/security/check-security.cjs
bash -n './[OS]/build.sh'
sh -n './[OS]/mkosi.postinst.chroot'
git diff --check
```

Run every Node fixture named in `.github/workflows/checks.yml` with an installed
Chromium via WELCOME_BROWSER. No browser install is needed by the fixture itself.
The browser harness substitutes same-origin framing only for its iframe layout
runner; script/style/resource CSP is the production policy. It reports CSP errors.
Go's transport test checks the full frame-ancestors policy/header boundary.

Provision the signing key once using `[DOCS]/RELEASING.md`. Confirm a release build
fails before mkosi with a missing signer or a trusted ring lacking that signer.
Do not delete the real key to test this: use a disposable build account/home.
Never publish TEST_SSH. Keep all final Go-formatting changes in the review.

## Fresh and upgraded test box

Use a Bridged VM with a snapshot. Check both a fresh image and an A/B upgrade from
0.4.2. First unsigned-to-signed bootstrap needs independent artifact verification.

```bash
systemctl --failed
sudo systemd-analyze verify /usr/lib/systemd/system/jenerd.service /usr/lib/systemd/system/jeneros-*.service
sudo systemd-analyze security --no-pager jenerd.service jeneros-auth.service jeneros-setup-apply.service jeneros-storage-create.service jeneros-update.service jeneros-update-check.service jeneros-rollback.service jeneros-ssh.service jeneros-firewall.service jeneros-apps-init.service jeneros-apps.service jeneros-apps-restore.service jeneros-apps-status.service jeneros-health.service jeneros-kiosk-fallback.service
sudo nft -c -f /usr/lib/jeneros/firewall.nft
sudo nft list ruleset
sudo systemctl restart jeneros-firewall.service
sudo nft list tables
ss -lntup
resolvectl status
sudo stat -c '%a %U %n' /var/lib/private/jeneros-tls /var/lib/private/jeneros-tls/identity.pem
sudo systemctl show jenerd -p DynamicUser -p CapabilityBoundingSet -p StateDirectory
sudo /usr/sbin/sshd -T -f /usr/lib/jeneros/sshd_config | grep -E 'permitrootlogin|maxauthtries|logingracetime|kexalgorithms|ciphers|macs|banner|passwordauthentication'
sysctl net.ipv4.conf.all.rp_filter net.ipv4.ip_forward net.ipv4.tcp_syncookies kernel.kptr_restrict kernel.dmesg_restrict kernel.unprivileged_bpf_disabled kernel.yama.ptrace_scope fs.protected_symlinks fs.protected_hardlinks fs.protected_fifos
journalctl -b --priority=warning --no-pager
```

Expect no 5355 listener, resolved multicast disabled, Avahi mDNS working, and
release SSH off before opt-in. Re-enabling it permits owner login, denies root,
and does not break later disable/socket shutdown. Dev/TEST_SSH root keys must still
work. Check `journalctl -u ssh.service` for unsupported algorithms/config errors.
Do not chase a numerical sandbox score by disabling required disk/EFI operations.

## External scan (another authorized LAN machine)

```bash
read -r -p 'Test box LAN IP: ' BOX
nmap -sT -sV -p- --reason "$BOX"
sudo nmap -sU -sV -p 53,67,68,123,137,138,161,546,5353,5355 --reason "$BOX"
nmap -sT -p 80,443,22,2283,8081,8096,8123,5355 "$BOX"
```

Expected baseline TCP: 80 and 443; 22 only after opt-in or on a test image. App
ports appear only for installed apps. mDNS 5353 and DHCP are intentional. If IPv6
is assigned, repeat with `nmap -6` from a reachable IPv6 peer. Save scanner output;
self-signed certificates, no HSTS and upstream package/app findings are not waived
by a passed fixture. Verify Incus bridge DHCP/DNS and outbound pulls after firewall
reload; its tables and forwarding must remain present.

## TLS, redirects and headers (LAN machine with OpenSSL)

```bash
curl -sS -D - -o /dev/null "http://$BOX/setup.html"
curl -sS -D - -o /dev/null -X POST -H 'X-JenerOS: 1' "http://$BOX/api/auth/login"
curl -ksS -D - -o /dev/null "https://$BOX/setup.html"
curl -ksS -D - -o /dev/null "https://$BOX/api/store"
curl -ksS -D - -o /dev/null "https://$BOX/missing-page"
openssl s_client -connect "$BOX:443" -servername jeneros.local -showcerts </dev/null 2>/dev/null | openssl x509 -noout -subject -dates -ext subjectAltName -fingerprint -sha256
openssl s_client -connect "$BOX:443" -tls1 </dev/null
openssl s_client -connect "$BOX:443" -tls1_1 </dev/null
openssl s_client -connect "$BOX:443" -tls1_2 </dev/null
openssl s_client -connect "$BOX:443" -tls1_3 </dev/null
openssl s_client -connect "$BOX:443" -tls1_2 -cipher ECDHE-ECDSA-AES128-SHA </dev/null
```

Expect 308 for GET, 426 for cleartext POST, full security headers on success/error,
no HSTS, failed TLS 1.0/1.1 and CBC-only handshakes, working TLS 1.2/1.3. A local
OpenSSL rejecting an old protocol before connecting is inconclusive: use a
compatible scanner such as an already installed `testssl.sh "$BOX:443"` as well.
`-k` is for this isolated validation only. Independently compare the SHA-256 value
with the box's setup sheet/status screen and owner Settings. Name and all current
LAN IP SANs must match. Change DHCP address/name, wait thirty seconds, verify new
SANs/fingerprint and repeat browser comparison. Reboot with unchanged addresses:
certificate should persist. Non-root unrelated users must not read the key.

On the box:

```bash
curl -sS http://127.0.0.1/api/system
curl -sS -D - -H 'Host: attacker.example' http://127.0.0.1/api/system
```

The first returns local facts/current setup code (only before setup). The second
must redirect without exposing facts. LAN spoofed X-Forwarded-For must not reveal
the code. Owner-authenticated LAN system responses must also omit it.

## Brute-force checks (disposable fresh box)

This deliberately rotates the setup code and causes temporary lockout. Do not use
the owner's real password. From one LAN source, keep the host awake:

```bash
for n in $(seq 1 6); do
  curl -ksS -D - -H 'X-JenerOS: 1' -H 'Content-Type: application/json' \
    -d '{"code":"invalid"}' "https://$BOX/api/setup"
done
sleep 61
for n in $(seq 1 6); do
  curl -ksS -D - -H 'X-JenerOS: 1' -H 'Content-Type: application/json' \
    -d '{"code":"invalid"}' "https://$BOX/api/setup"
done
```

Five 403s then 429 each window; second window has up to 120 seconds of backoff.
After ten decoded wrong codes the physical-screen code and QR must change; the
old code fails. Blocked calls do not extend the lockout. Forwarding headers cannot
bypass it. Global test: start from a fresh daemon on this disposable box, coordinate
five guesses each from four real LAN IPs within a minute; the next source gets
429. Do not add arbitrary forwarding headers and treat them as distinct clients.
The Go API tests cover the same global scenario with a deterministic clock.

After completing setup and waiting for limits to clear, perform the same login
loop (five failures then 429; the global login cap is thirty):

```bash
for n in $(seq 1 6); do
  curl -ksS -D - -H 'X-JenerOS: 1' -H 'Content-Type: application/json' \
    -d '{"username":"not_the_owner","password":"deliberately-wrong"}' "https://$BOX/api/auth/login"
done
```

Compare an existing owner name with another syntactically valid name: both return
the same credential error and do owner password work. Sign in through the browser:
check Secure/HttpOnly/SameSite=Strict/Path=/ with no Domain and the __Host- prefix.
Re-login revokes that browser's old cookie; logout/restart revoke sessions as
documented. Setup endpoints are closed and code is gone after setup completion.

## Signed update round trip (isolated test release channel)

Select two unused 0.4.x versions; examples use 0.4.3 and 0.4.4. On the build VM,
after key provisioning, set its LAN address below. The HTTP channel is intentional:
it tests signature enforcement independently of transport encryption.

```bash
cd ~/jeneros
read -r -p 'Build VM LAN IP: ' BUILD_IP
RELEASE=1 VERSION=0.4.3 UPDATE_URL="http://$BUILD_IP:8000/" ./\[OS\]/build.sh
RELEASE=1 VERSION=0.4.4 UPDATE_URL="http://$BUILD_IP:8000/" ./\[OS\]/build.sh
python3 -m http.server 8000 --bind "$BUILD_IP" --directory "$HOME/jeneros-release/0.4.4"
```

Boot the verified 0.4.3 disk, finish setup, snapshot it. On that test box:

```bash
grep '^Verify=' /usr/lib/sysupdate.d/*.transfer
sudo find /etc/sysupdate.d /etc/systemd -maxdepth 1 -name '*transfer' -o -name 'import-pubring*'
gpg --show-keys --with-fingerprint /usr/lib/systemd/import-pubring.gpg
sudo /usr/lib/systemd/systemd-sysupdate list
sudo /usr/lib/systemd/systemd-sysupdate update 0.4.4
sudo systemctl reboot
# After reboot:
cat /usr/lib/os-release
systemd-bless-boot status
```

Require Verify=yes on all three transfers, expected key, version 0.4.4 and a good
boot. Repeat from the 0.4.3 snapshot via the dashboard Update control so its sandbox
is exercised too. Then restore the snapshot again for tamper checks. On the build
VM (a second terminal, keeping the server running):

```bash
cd "$HOME/jeneros-release/0.4.4"
cp SHA256SUMS SHA256SUMS.good
printf '\n# changed without signing\n' >> SHA256SUMS
```

On the test box, the following must fail before any target update is written:

```bash
if sudo /usr/lib/systemd/systemd-sysupdate update 0.4.4; then
  echo 'FAIL: tampered manifest accepted'; exit 1
fi
sudo systemctl start jeneros-update.service
journalctl -u jeneros-update.service --no-pager -n 50
```

Restore `mv SHA256SUMS.good SHA256SUMS` on the build VM, then separately repeat
with SHA256SUMS.gpg removed, with a signature made by a throwaway unrelated key,
and with one payload byte changed while keeping the signed manifest intact.
Restore original files between tests. A fresh sysupdate process avoids stale
manifest caches. Capture errors proving signature/checksum rejection, not a generic
network failure. Finally perform the intact signed update again.

## Functional acceptance

Verify fresh setup, phone QR and warning explanation, rotated code, fixed-address
reconnect, Cog taps, login, Settings fingerprint, disk inventory and a pool created
on blank disposable disks. Confirm the new pool is mounted on the host, plain
folders live on that filesystem, and both survive reboot. Test signed update,
failed boot rollback and manual previous-version selection with the service
sandboxes. Exercise all four native apps, DHCP/DNS, image pulls, stop/start and data
persistence using `.scratch/apps/VM-CHECKS.md`. Scan with the apps installed too.
No acceptance box is done until these live results are recorded.
