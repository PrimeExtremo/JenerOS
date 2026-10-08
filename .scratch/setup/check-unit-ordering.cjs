// No systemd/VM required. Check ordering of activation units in the image overlay.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
function settings(sources) {
  const after = new Set();
  let defaults = true;
  for (const source of sources) {
    let section = '';
    const lines = source.replace(/\\\r?\n/g, ' ').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^[#;]/.test(line)) continue;
      if (line.startsWith('[')) { section = line; continue; }
      if (section !== '[Unit]') continue;
      const match = line.match(/^(After|DefaultDependencies)\s*=\s*(.*)$/);
      if (!match) continue;
      if (match[1] === 'After') {
        if (!match[2]) after.clear();
        else match[2].split(/\s+/).forEach(unit => after.add(unit));
      } else defaults = !['no', 'false', '0', 'off'].includes(match[2].toLowerCase());
    }
  }
  return after.has('jenerd.service') && defaults;
}
assert.equal(settings(['[Unit]\nAfter=network.target \\\n jenerd.service\n']), true);
assert.equal(settings(['[Unit]\nAfter=jenerd.service\nDefaultDependencies=no']), false);
assert.equal(settings(['[Unit]\nAfter=jenerd.service', '[Unit]\nAfter=\nAfter=network.target']), false);
assert.equal(settings(['[Unit]\nAfter=jenerd.service\nDefaultDependencies=no', '[Unit]\nDefaultDependencies=yes']), true);
assert.equal(settings(['# After=jenerd.service\n[Socket]\nAfter=jenerd.service']), false);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
const root = '[OS]/mkosi.extra';
const files = walk(root);
const units = [...new Set(files.flatMap(file => /\.(path|socket|timer)$/.test(file) ? [file]
  : /\.(path|socket|timer)\.d[\\/][^\\/]+\.conf$/.test(file) ? [path.dirname(file).slice(0, -2)] : []))];
assert.ok(units.length, 'No activation units found: fixture must inspect the image overlay.');
const failures = [];
for (const unit of units) {
  const dropDir = unit + '.d';
  const dropIns = fs.existsSync(dropDir) ? fs.readdirSync(dropDir).filter(name => name.endsWith('.conf')).sort().map(name => path.join(dropDir, name)) : [];
  const sources = [...(fs.existsSync(unit) ? [unit] : []), ...dropIns];
  if (settings(sources.map(file => fs.readFileSync(file, 'utf8')))) failures.push(unit);
}
assert.deepEqual(failures, [], 'Activation units with After=jenerd.service require [Unit] DefaultDependencies=no to avoid a boot ordering cycle.');
console.log(`Unit ordering checks passed: ${units.length} path/socket/timer units and their drop-ins.`);
