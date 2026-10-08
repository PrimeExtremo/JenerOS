// Reuse the stdlib browser harness, with fake disks and no privileged commands.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');
const base = '[OS]/mkosi.extra/usr/lib/';
assert.match(read('[OS]/mkosi.conf'), /\n\s+btrfs-progs\n/);
assert.match(read('[OS]/mkosi.postinst.chroot'), /want jeneros-storage-create.path multi-user.target.wants/);
assert.match(read(base + 'systemd/system/jeneros-storage-create.path'), /PathExists=\/run\/jeneros\/storage.request/);
assert.doesNotMatch(read(base + 'systemd/system/jeneros-storage-create.path'), /After=jenerd/);
assert.match(read(base + 'jeneros/storage-create'), /exec \/usr\/bin\/jenerd storage-create/);
for (const file of ['jeneros/storage-create', 'systemd/system/jeneros-storage-create.service', 'systemd/system/jeneros-storage-create.path']) assert.ok(!read(base + file).includes('\r'), 'OS files use LF');
process.env.JENER_UI_FIXTURE = 'storage';
require('../setup/check-welcome-browser.cjs');
