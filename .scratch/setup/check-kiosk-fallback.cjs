// File wiring plus an isolated copy of the text helper. Never touch a real tty.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const read = file => fs.readFileSync(file, 'utf8');
const overlay = '[OS]/mkosi.extra/usr/lib/';
const kiosk = read(overlay + 'systemd/system/jeneros-kiosk.service');
const fallback = read(overlay + 'systemd/system/jeneros-kiosk-fallback.service');
const helper = read(overlay + 'jeneros/kiosk-fallback');
const postinst = read('[OS]/mkosi.postinst.chroot');
const splash = read(overlay + 'systemd/system/plymouth-quit.service.d/jeneros.conf');
const unit = text => {
  let section;
  const values = {};
  for (const line of text.split('\n')) {
    if (line.startsWith('[')) section = line.trim();
    const match = line.match(/^([A-Za-z]+)=(.*)$/);
    if (match) values[section + match[1]] = match[2].trim();
  }
  return values;
};
const k = unit(kiosk), f = unit(fallback);
assert.equal(k['[Unit]StartLimitIntervalSec'], '120');
assert.equal(k['[Unit]StartLimitBurst'], '3');
assert.equal(k['[Unit]OnFailure'], 'jeneros-kiosk-fallback.service');
assert.equal(k['[Service]Restart'], 'always');
assert.equal(k['[Service]TTYVTDisallocate'], 'no');
assert.ok(!kiosk.includes('ExecStartPre=-/usr/bin/plymouth quit\n'));
assert.match(splash, /ExecStart=\nExecStart=-\/usr\/bin\/plymouth quit --retain-splash/);
assert.equal(f['[Service]Type'], 'oneshot');
assert.equal(f['[Service]ExecCondition'], '/usr/bin/systemctl --quiet is-failed jeneros-kiosk.service');
assert.equal(f['[Service]ExecStart'], '/usr/lib/jeneros/kiosk-fallback');
assert.equal(f['[Service]StandardOutput'], 'tty');
assert.equal(f['[Service]TTYPath'], '/dev/tty1');
assert.equal(f['[Service]TTYVTDisallocate'], 'no');
assert.ok(!f['[Unit]BindsTo'] && !f['[Unit]Requires'] && !f['[Unit]Conflicts']);
assert.match(postinst, /chmod 0755 \/usr\/lib\/jeneros\/kiosk-fallback/);
assert.match(postinst, /want jeneros-kiosk-fallback.service multi-user.target.wants/);
assert.match(read('.github/workflows/checks.yml'), /\.scratch\/setup\/check-kiosk-fallback\.cjs/);

for (const file of [overlay + 'jeneros/kiosk', overlay + 'jeneros/kiosk-fallback', '[OS]/mkosi.postinst.chroot']) {
  const result = spawnSync('sh', ['-n', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file}: ${result.stderr || result.error || ''}`);
}
const dir = fs.mkdtempSync(path.resolve('.scratch/setup/kiosk-fixture-'));
const shellPath = p => path.relative(process.cwd(), p).replace(/\\/g, '/');
try {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  for (const [name, output] of Object.entries({ hostname: 'jener-test', uname: '6.12-fixture' })) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nprintf '%s\\n' '${output}'\n`, { mode: 0o755 });
  }
  const issue = path.join(dir, 'issue'), code = path.join(dir, 'code'), done = path.join(dir, 'done');
  fs.writeFileSync(issue, read(overlay + 'issue').replace('@VERSION@', 'fixture'));
  const script = path.join(dir, 'fallback.sh');
  fs.writeFileSync(script, helper
    .replaceAll('/usr/lib/issue', shellPath(issue))
    .replaceAll('/run/jeneros/setup-code', shellPath(code))
    .replaceAll('/var/lib/jeneros/setup-done', shellPath(done))
    .replace('set -eu', `set -eu\nPATH='${shellPath(bin)}':"$PATH"\nexport PATH`));
  for (const tc of [
    { name: 'setup', code: '123456', ip: true },
    { name: 'bad-code', code: '123456;bad', ip: true, missing: true },
    { name: 'missing-code', ip: true, missing: true },
    { name: 'offline', code: '654321' },
    { name: 'finished', code: '123456', ip: true, done: true },
  ]) {
    if (fs.existsSync(code)) fs.unlinkSync(code);
    if (tc.code) fs.writeFileSync(code, tc.code + '\n');
    if (tc.done) fs.writeFileSync(done, '');
    const addresses = '1: docker0 inet 172.17.0.1/16 scope global docker0\n2: eth0 inet 169.254.1.2/16 scope global eth0\n' +
      (tc.ip ? '3: ens33 inet 192.168.1.42/24 scope global ens33\n' : '');
    fs.writeFileSync(path.join(bin, 'ip'), `#!/bin/sh\ncat <<'FIXTURE'\n${addresses}FIXTURE\n`, { mode: 0o755 });
    const result = spawnSync('sh', [shellPath(script)], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, `${tc.name}: ${result.stderr || result.error || ''}`);
    const text = result.stdout;
    assert.match(text, /JJJJJ EEEEE/);
    assert.match(text, /JenerOS fixture/);
    assert.match(text, /Hostname\s+jener-test/);
    assert.match(text, /Kernel\s+6\.12-fixture/);
    assert.match(text, /http:\/\/jeneros\.local/);
    assert.match(text, /http:\/\/jener-test\.local/);
    assert.ok(!text.includes('press S'), 'Graphical-only rollback hint must be omitted');
    assert.ok(!text.includes('172.17.0.1') && !text.includes('169.254.1.2'));
    if (tc.ip) assert.match(text, /http:\/\/192\.168\.1\.42/);
    else assert.match(text, /Connect a network cable/);
    if (tc.done) {
      assert.match(text, /Open your dashboard/);
      assert.ok(!text.includes('Setup code:') && !text.includes('Finish setup'));
    } else {
      assert.match(text, /Finish setup on your phone or computer/);
      if (tc.missing) assert.match(text, /Setup code is not ready/);
      else assert.ok(text.includes(`Setup code: ${tc.code}`));
    }
  }
} finally {
  // Remove only the temporary directory made above, within this workspace.
  assert.ok(dir.startsWith(path.resolve('.scratch/setup') + path.sep));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Kiosk fallback passed: rate limit, failure/boot wiring, retained splash, banner, LAN URLs, code, offline and completed setup. No real services or tty were used.');
