// Run the real build control flow with tiny artifacts and fake VM-only tools.
// This checks fail-closed wiring, not GPG cryptography or an actual OS image.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fixtureParent = path.resolve('.scratch/security');
const dir = fs.mkdtempSync(path.join(fixtureParent, 'jeneros-signing-fixture-'));
const posix = p => p.replaceAll('\\', '/');
const shellPath = p => process.platform === 'win32' ? posix(path.relative(process.cwd(), p)) : p;
const write = (name, body, mode = 0o644) => { const p = path.join(dir, name); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, body, {mode}); };
const read = p => fs.readFileSync(path.join(dir, p), 'utf8');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/bash.exe' : 'bash';
try {
  // Isolate the key path in this COPY; never repurpose HOME or read real keys.
  let source = fs.readFileSync('[OS]/build.sh', 'utf8').replaceAll('$HOME/.jeneros-signing', '$TEST_SIGNING_HOME');
  // Windows sandbox shell helpers require paths relative to the workspace.
  if (process.platform === 'win32') source = source.replace(/^ROOT=.*$/m, 'ROOT="$TEST_REPO_ROOT"');
  write('[OS]/build.sh', source);
  for (const file of ['mkosi.conf', 'mkosi.extra/usr/lib/issue', 'mkosi.extra/usr/lib/jeneros/sshd_config', ...fs.readdirSync('[OS]/sysupdate.d').map(f => 'sysupdate.d/' + f)]) write('[OS]/' + file, fs.readFileSync('[OS]/' + file));
  for (const f of ['mkosi.prepare.chroot', 'mkosi.postinst.chroot']) write('[OS]/' + f, '#!/bin/sh\nexit 0\n');
  for (const name of ['[CORE]', '[DASHBOARD]', '[STORE]/apps', 'signer', 'updates']) fs.mkdirSync(path.join(dir, name), {recursive:true});
  write('signer/signing-key', 'A'.repeat(40) + '\n');
  write('signer/trusted-keys.gpg', 'public-key-only\n');
  const mock = (name, body) => write('bin/' + name, '#!/bin/bash\nset -eu\n' + body + '\n', 0o755);
  mock('go', 'exit 0');
  mock('rsync', 'exit 0');
  mock('xz', 'cat "${@: -1}"');
  mock('mkosi', 'mkdir -p out\nfor arg; do case "$arg" in --image-version=*) version=${arg#*=};; esac; done\nfor ext in raw efi usr-x86-64.fixture.raw usr-x86-64-verity.fixture.raw; do printf artifact > "out/jeneros_$version.$ext"; done\ntouch "$TEST_MARKER"');
  mock('gpg', 'case " $* " in *" --list-secret-keys "*) exit 0;; esac\ninput=${@: -1}\nwhile [ "$#" -gt 0 ]; do if [ "$1" = --output ]; then output=$2; break; fi; shift; done\nsha256sum "$input" > "$output"');
  mock('gpgv', 'case " $* " in *" --keyring "*) ;; *) exit 9;; esac\nwhile [ "$#" -gt 0 ]; do if [ "$1" = --keyring ]; then ring=$2; shift 2; break; fi; shift; done\n[ "$(cat "$ring")" = public-key-only ]\nsha256sum -c "$1" >/dev/null');
  const env = {...process.env, PATH: [path.join(dir, 'bin'), process.env.PATH].join(path.delimiter), TEST_REPO_ROOT:shellPath(dir), TEST_SIGNING_HOME:shellPath(path.join(dir, 'signer')), TEST_MARKER:'../built', NO_VMDK:'1', DEV_SSH_KEY:shellPath(path.join(dir, 'absent-key')), VERSION:'0.4.99', UPDATES_DIR:shellPath(path.join(dir, 'updates')), VM_DIR:shellPath(path.join(dir, 'vm'))};
  const run = release => spawnSync(shell, [shellPath(path.join(dir, '[OS]/build.sh'))], {env:{...env, RELEASE:release}, encoding:'utf8', windowsHide:true, timeout:30000});
  let r = run('1');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(read('updates/SHA256SUMS.gpg'), /^[a-f0-9]{64}/);
  assert.equal(read('[OS]/build/staging/usr/lib/systemd/import-pubring.gpg'), 'public-key-only\n');
  for (const name of fs.readdirSync(path.join(dir, '[OS]/sysupdate.d'))) assert.match(read('[OS]/build/staging/usr/lib/sysupdate.d/' + name), /^Verify=yes$/m);
  // Mismatched public trust stops before even the mocked image builder runs.
  fs.unlinkSync(path.join(dir, 'built'));
  write('signer/trusted-keys.gpg', 'wrong-public-key\n');
  r = run('1');
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'built')));
  fs.unlinkSync(path.join(dir, 'signer/signing-key'));
  r = run('1');
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'built')));
  r = run('');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(path.join(dir, 'updates/SHA256SUMS.gpg')));
  assert.ok(!fs.existsSync(path.join(dir, '[OS]/build/staging/usr/lib/systemd/import-pubring.gpg')));
  for (const name of fs.readdirSync(path.join(dir, '[OS]/sysupdate.d'))) assert.match(read('[OS]/build/staging/usr/lib/sysupdate.d/' + name), /^Verify=no$/m);
  console.log('Mock release/dev builds passed: signed manifest/public ring, missing signer and mismatched trust fail closed, dev removes stale signature. No real image or release key created.');
} finally {
  const resolved = path.resolve(dir), parent = fixtureParent;
  if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('jeneros-signing-fixture-')) throw Error('Unsafe fixture cleanup path');
  fs.rmSync(resolved, {recursive:true, force:true});
}
