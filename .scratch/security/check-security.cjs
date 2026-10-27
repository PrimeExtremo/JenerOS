// Source/config regression guards. Live nft/systemd/GPG checks are in VM-CHECKS.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const read = p => fs.readFileSync(p, 'utf8');
const osRoot = '[OS]/mkosi.extra/usr/lib/';
const units = osRoot + 'systemd/system/';
const firewall = read(osRoot + 'jeneros/firewall.nft');
assert.match(firewall, /hook input priority filter; policy drop/);
assert.doesNotMatch(firewall, /flush ruleset|hook forward|5355/);
for (const rule of ['ct state established,related accept', 'ct state invalid drop', 'iifname "lo" accept', 'tcp dport { 80, 443 } accept', 'udp dport 5353 accept', 'udp dport 68 accept', 'udp dport 546 accept', 'tcp dport 22 ct state new limit rate 6/minute accept']) assert.ok(firewall.includes(rule), rule);
assert.match(firewall, /iifname \{ "incusbr\*", "ja-\*" \} udp dport \{ 53, 67 \} accept/);
assert.match(read(osRoot + 'systemd/resolved.conf.d/jeneros.conf'), /LLMNR=no\nMulticastDNS=no/);
assert.match(read('[OS]/mkosi.postinst.chroot'), /want jeneros-firewall.service sysinit.target.wants/);
const sysctl = read(osRoot + 'sysctl.d/90-jeneros.conf');
for (const rule of ['net.ipv4.conf.all.rp_filter = 2', 'kernel.kptr_restrict = 2', 'kernel.dmesg_restrict = 1', 'kernel.yama.ptrace_scope = 1', 'kernel.unprivileged_bpf_disabled = 1', 'fs.protected_symlinks = 1', 'fs.protected_hardlinks = 1', 'fs.protected_fifos = 2']) assert.ok(sysctl.includes(rule), rule);
assert.doesNotMatch(sysctl, /^\s*net\..*(?:forwarding|ip_forward)\s*=\s*0/m);
const ssh = read(osRoot + 'jeneros/sshd_config');
for (const rule of ['PermitRootLogin no', 'MaxAuthTries 3', 'LoginGraceTime 30', 'DebianBanner no', 'VersionAddendum none']) assert.ok(ssh.includes(rule), rule);
assert.doesNotMatch(ssh, /sha1|cbc|diffie-hellman-group1/);
assert.doesNotMatch(read(osRoot + 'jeneros/ssh-banner'), /\d+\.\d+/);
assert.match(read(units + 'ssh.service.d/jeneros.conf'), /sshd -D -f \/usr\/lib\/jeneros\/sshd_config/);
for (const file of fs.readdirSync('[OS]/sysupdate.d')) assert.match(read('[OS]/sysupdate.d/' + file), /^Verify=yes$/m);
const build = read('[OS]/build.sh');
assert.match(read('[OS]/mkosi.conf'), /^\s+gpgv$/m);
for (const text of ['SIGNING_HOME="$HOME/.jeneros-signing"', 'import-pubring.gpg', '--detach-sign --output "$UPDATES_DIR/SHA256SUMS.gpg"', 'gpgv --homedir', 'PermitRootLogin prohibit-password']) assert.ok(build.includes(text), text);
assert.doesNotMatch(build, /quick-generate-key|--passphrase/);
for (const id of fs.readdirSync('[STORE]/apps')) {
  const manifest = JSON.parse(read(path.join('[STORE]/apps', id, 'app.json')));
  if (manifest.available) assert.ok(firewall.includes(String(manifest.web.host)), id + ': published app port must remain reachable');
}
assert.ok(build.indexOf('signing preflight') < build.indexOf('echo "==> image"'));
const daemon = read(units + 'jenerd.service');
assert.match(daemon, /-addr :80 -tls-addr :443/);
assert.match(daemon, /StateDirectory=jeneros-tls\nStateDirectoryMode=0700/);
assert.match(daemon, /DynamicUser=yes/);
assert.match(daemon, /^CapabilityBoundingSet=CAP_NET_BIND_SERVICE$/m);
for (const name of ['jenerd', 'jeneros-auth', 'jeneros-apps', 'jeneros-apps-init', 'jeneros-apps-restore', 'jeneros-apps-status', 'jeneros-update', 'jeneros-update-check', 'jeneros-rollback', 'jeneros-ssh', 'jeneros-storage-create', 'jeneros-setup-apply', 'jeneros-health', 'jeneros-firewall', 'jeneros-kiosk-fallback']) {
  const drop = units + name + '.service.d/hardening.conf';
  const body = read(units + name + '.service') + (fs.existsSync(drop) ? read(drop) : '');
  for (const text of ['NoNewPrivileges=yes', 'RestrictNamespaces=yes', 'MemoryDenyWriteExecute=yes', 'SystemCallFilter=@system-service', 'CapabilityBoundingSet=']) assert.ok(body.includes(text), name + ': ' + text);
  assert.ok(!body.includes('\r'), name + ': LF required');
}
for (const file of fs.readdirSync('[DASHBOARD]').filter(f => f.endsWith('.html'))) {
  const page = read('[DASHBOARD]/' + file);
  for (const script of page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(script[1], /\bsrc=/, file + ': script needs external src');
    assert.equal(script[2].trim(), '', file + ': inline script');
  }
  assert.doesNotMatch(page, /\son[a-z]+\s*=/i, file + ': inline handler');
  assert.doesNotMatch(page, /javascript:/i, file + ': executable URL');
}
assert.match(read('[DASHBOARD]/setup.html'), /id="setupFingerprint"/);
assert.match(read('[DASHBOARD]/screen.html'), /id="screenFingerprint"/);
assert.match(read('[DASHBOARD]/app.js'), /Certificate SHA-256/);
const setup = read('[CORE]/internal/api/setup.go');
assert.match(setup, /perIP := &auth.Limiter\{Max: 5, Window: time.Minute\}/);
assert.match(setup, /global := &auth.Limiter\{Max: 20, Window: time.Minute\}/);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/bash.exe' : 'bash';
execFileSync(bash, ['-n', '[OS]/build.sh']);
execFileSync(bash, ['-n', '[OS]/mkosi.postinst.chroot']);
console.log('Security source/config guards and build shell syntax passed. Live OS checks remain in VM-CHECKS.md.');
