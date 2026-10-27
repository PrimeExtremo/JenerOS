const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = p => fs.readFileSync(p, 'utf8');
const root = '[OS]/mkosi.extra/usr/lib/systemd/system/';
for (const file of fs.readdirSync(root).filter(f => f.startsWith('jeneros-apps') && fs.statSync(root + f).isFile())) {
  assert.ok(!read(root + file).includes('\r'), file + ': LF required');
}
const post = read('[OS]/mkosi.postinst.chroot');
for (const unit of ['jeneros-apps-init.service', 'jeneros-apps-restore.service', 'jeneros-apps.path', 'jeneros-apps-status.timer']) assert.ok(post.includes('want ' + unit + ' '), unit + ': enable from /usr');
assert.match(read('[OS]/mkosi.prepare.chroot'), /incus\/lts-7\.0/);
assert.match(read('[OS]/mkosi.prepare.chroot'), /4EFC590696CB15B87C73A3AD82CC8797C838DCFD/);
assert.doesNotMatch(read(root + 'jenerd.service'), /incus-admin|unix\.socket/);
assert.match(read(root + 'incus.service.d/jeneros.conf'), /ExecStartPre=\/usr\/bin\/jenerd apps-prepare/);
assert.match(read(root + 'incus.service.d/jeneros.conf'), /After=.*systemd-sysusers.service.*systemd-tmpfiles-setup.service/);
const ports = new Set();
let available = 0;
for (const id of fs.readdirSync('[STORE]/apps')) {
  const m=JSON.parse(read(path.join('[STORE]/apps', id, 'app.json')));
  if (!m.available) continue;
  available++;
  assert.equal(m.auth.type, 'none');
  assert.ok(!ports.has(m.web.host)); ports.add(m.web.host);
  for (const s of m.services) {
    assert.ok(/@sha256:[a-f0-9]{64}$|:v?\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.-]+)?$/.test(s.image), s.image);
    assert.ok(s.health.port > 0);
    assert.ok(!s.network && !s.devices);
  }
}
assert.equal(available, 4);
process.env.JENER_UI_FIXTURE = 'apps';
require('../setup/check-welcome-browser.cjs');
