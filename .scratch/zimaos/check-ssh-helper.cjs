// Execute only a rewritten copy against workspace fixtures and fake commands.
// Never invoke the installed helper or a real systemctl.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert/strict');
const source = fs.readFileSync('[OS]/mkosi.extra/usr/lib/jeneros/ssh-access', 'utf8');
const shellPath = p => path.relative(process.cwd(), p).replace(/\\/g, '/');
const fixtures = path.resolve('.scratch/zimaos/fixtures/ssh');
assert.ok(fixtures.startsWith(path.resolve('.scratch/zimaos') + path.sep));
for (const tc of [
  { name: 'enable', action: 'enable', marker: true, commands: 'start ssh.service' },
  { name: 'disable', action: 'disable', initial: true, marker: false, commands: 'stop ssh.socket ssh.service' },
  { name: 'invalid', action: 'enable; echo bad', marker: false, failed: true },
  { name: 'no-setup', action: 'enable', noSetup: true, marker: false, failed: true },
  { name: 'dev', action: 'disable', initial: true, dev: true, marker: true, failed: true },
  { name: 'start-fails', action: 'enable', fail: true, marker: false, failed: true, commands: 'start ssh.service' },
  { name: 'start-fails-existing', action: 'enable', fail: true, initial: true, marker: true, failed: true, commands: 'start ssh.service' },
  { name: 'stop-fails', action: 'disable', fail: true, initial: true, marker: true, failed: true, commands: 'stop ssh.socket ssh.service' },
]) {
  const dir = path.join(fixtures, tc.name);
  for (const sub of ['state', 'run', 'status', 'bin']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  const files = { request: path.join(dir, 'run/ssh.request'), flag: path.join(dir, 'state/ssh-enabled'), done: path.join(dir, 'state/setup-done'), dev: path.join(dir, 'state/dev-key'), log: path.join(dir, 'commands.log'), fail: path.join(dir, 'fail') };
  for (const file of Object.values(files)) if (fs.existsSync(file)) fs.unlinkSync(file);
  if (!tc.noSetup) fs.writeFileSync(files.done, '');
  if (tc.initial) fs.writeFileSync(files.flag, '');
  if (tc.dev) fs.writeFileSync(files.dev, '');
  if (tc.fail) fs.writeFileSync(files.fail, '');
  fs.writeFileSync(files.request, tc.action + '\n');
  fs.writeFileSync(path.join(dir, 'bin/systemctl'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$MOCK_LOG"\n[ ! -f "$MOCK_FAIL" ]\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'bin/flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const fixtureScript = source
    .replace('/run/jeneros-ssh', shellPath(path.join(dir, 'status')))
    .replace('/run/jeneros/ssh.request', shellPath(files.request))
    .replace('/var/lib/jeneros/ssh-enabled', shellPath(files.flag))
    .replace('/var/lib/jeneros/setup-done', shellPath(files.done))
    .replace('/usr/share/jeneros/dev/authorized_keys', shellPath(files.dev))
    .replace('set -eu', `set -eu\nPATH='${shellPath(path.join(dir, 'bin'))}':"$PATH"\nexport PATH\nMOCK_LOG='${shellPath(files.log)}'\nMOCK_FAIL='${shellPath(files.fail)}'\nexport MOCK_LOG MOCK_FAIL`);
  const script = path.join(dir, 'helper.sh'); fs.writeFileSync(script, fixtureScript);
  const result = spawnSync('sh', [script], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, tc.failed ? 1 : 0, `${tc.name}: ${result.stderr || result.error || ''}`);
  assert.equal(fs.existsSync(files.request), false, `${tc.name}: request was not consumed`);
  assert.equal(fs.existsSync(files.flag), tc.marker, `${tc.name}: incorrect persistent flag`);
  const status = JSON.parse(fs.readFileSync(path.join(dir, 'status/status.json'), 'utf8'));
  assert.equal(status.state, tc.failed ? 'failed' : 'done', tc.name);
  const commands = fs.existsSync(files.log) ? fs.readFileSync(files.log, 'utf8').trim() : '';
  assert.equal(commands, tc.commands || '', tc.name);
}
console.log('SSH helper fixtures passed: enable, disable/socket stop, malformed request, setup/dev guards, failed start flag rollback and failed stop preservation. Only fake systemctl/flock ran.');
