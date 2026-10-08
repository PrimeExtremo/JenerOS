const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
for (const page of ['setup', 'screen', 'privacy', 'index']) {
  const html = read(`[DASHBOARD]/${page}.html`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${page}: duplicate ID`);
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:https?:|mailto:)/.test(m[1])) continue;
    assert.ok(fs.existsSync(path.join('[DASHBOARD]', m[1])), `${page}: missing ${m[1]}`);
  }
  if (['setup', 'screen'].includes(page)) {
    for (const m of read(`[DASHBOARD]/${page}.js`).matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]), `${page}: missing DOM id ${m[1]}`);
  }
}
const policyText = read('[DASHBOARD]/privacy.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
for (const raw of read('[DOCS]/PRIVACY.md').split(/\r?\n/)) {
  const line = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/^#+\s*|^-\s*/g, '').trim();
  if (!line || /^\|[ -]+\|/.test(line)) continue;
  const cells = line.startsWith('|') ? line.split('|').map(s => s.trim()).filter(Boolean) : [line];
  for (const cell of cells) assert.ok(policyText.includes(cell), `missing policy text: ${cell}`);
}
const issue = read('[OS]/mkosi.extra/usr/lib/issue');
const expanded = issue.replace(/\\e\[[0-9;]*m/g, '').replaceAll('@VERSION@', '0.3.0').replaceAll('\\n', 'a'.repeat(63)).replaceAll('\\r', '6.12.0-25-amd64').replaceAll('\\4', '192.168.100.100');
const lines = expanded.trimEnd().split('\n');
assert.ok(lines.length <= 23, `banner has ${lines.length} lines; leave room for login`);
assert.ok(Math.max(...lines.map(s => s.length)) <= 80, 'banner exceeds 80 columns');
for (let tty = 2; tty <= 6; tty++) assert.match(read(`[OS]/mkosi.extra/usr/lib/systemd/system/getty@tty${tty}.service.d/jeneros.conf`), /--issue-file \/usr\/lib\/issue/);
assert.equal(fs.existsSync('[OS]/mkosi.extra/etc/issue'), false);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const codeFiles = [...walk('[CORE]'), ...walk('[DASHBOARD]'), ...walk('[OS]/mkosi.extra/usr/lib'), '[OS]/build.sh', '[OS]/mkosi.postinst.chroot'].filter(file => /\.(?:go|html|js|css|sh|service|path|conf)$/.test(file) || /(?:issue|jeneros[\\/](?:rollback|update))$/.test(file));
for (const file of codeFiles) {
  const bytes = fs.readFileSync(file);
  assert.ok(!bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])), `${file}: BOM`);
  // Existing untouched files can still have CRLF in this Windows checkout.
  if (/facts|rollback|validation|privacy|screen|setup\.js|getty@|ssh\.service\.d|ssh\.socket\.d|[\\/]issue$/.test(file)) assert.ok(!bytes.includes(13), `${file}: CRLF`);
}
console.log(`Page checks passed: IDs/assets, exact policy text, ${lines.length}-line banner (max ${Math.max(...lines.map(s => s.length))} columns), tty2–6 and code encodings.`);
