const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const files = [...new Set(fs.readFileSync('.github/workflows/checks.yml', 'utf8').match(/\.scratch\/[\w/-]+\.cjs/g))];
const results = [];
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 300000, windowsHide: true, env: process.env });
  const entry = { file, status: result.status, error: result.error?.message, output: result.stdout + result.stderr };
  results.push(entry);
  fs.writeFileSync('.scratch/security/fixture-results.json', JSON.stringify(results, null, 2) + '\n');
  console.log((result.status === 0 ? 'PASS ' : 'FAIL ') + file);
}
process.exitCode = results.some(r => r.status !== 0) ? 1 : 0;
