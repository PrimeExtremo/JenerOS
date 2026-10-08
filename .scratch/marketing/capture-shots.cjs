// Capture real JenerOS dashboard screens for jener.dev.
// Serves [DASHBOARD]/ as static files; /api/* gets demo answers in the same
// shape jenerd sends, so every screen shows its normal state (no jenerd needed).
// Run from the repo root:  node .scratch/marketing/capture-shots.cjs
// Needs Playwright (Chromium). Writes PNGs to [SITE]/assets/shots/src/ (not published).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const root = path.resolve('[DASHBOARD]');
const out = path.resolve('[SITE]/assets/shots/src');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.pdf': 'application/pdf' };

const TB = 1e12, GB = 1e9;
// The real [STORE]/apps catalog as jenerd serves it (made with catalog.Load; see VIDEO.md).
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'store-catalog.json'), 'utf8'));
let tick = 0, rx = 1e6, tx = 5e5;
// Same fields as [CORE]/internal/system. Counters move a little on every poll so the gauges and graph draw.
const system = () => {
  tick++;
  const wave = Math.sin(tick / 2.3) * .5 + .5, ripple = Math.sin(tick * 1.9) * .5 + .5;
  rx += 18000 + wave * 22000 + ripple * 2500; tx += 3000 + ripple * 2500;
  return { hostname: 'jeneros', manufacturer: 'Dell Inc.', model: 'OptiPlex 7050', kernel: '6.12.9', osVersion: '0.1.0', arch: 'amd64', os: 'linux', cpus: 4,
    memTotalMB: 8192, memFreeMB: 5900, uptimeSec: 273600 + tick * 5, load1: .4, diskTotalB: 250 * GB, diskFreeB: 196 * GB,
    addresses: ['192.168.1.42'], sshStatus: 'off',
    cpuCounters: { total: 100000 + tick * 2000, idle: 85000 + tick * 1820 - Math.round(wave * 160) },
    network: [{ name: 'eth0', addresses: ['192.168.1.42'], rxBytes: Math.round(rx), txBytes: Math.round(tx) }] };
};
const api = {
  '/api/system': system,
  '/api/store': () => catalog,
  '/api/update': { current: '0.1.0', available: { checked: '2026-10-08T09:30:00-04:00' }, requested: false },
  '/api/auth/session': { username: 'jener' },
  '/api/settings/ssh': { enabled: false, state: 'off' },
  '/api/setup': { keymaps: [{ id: 'us', name: 'English (US)' }, { id: 'gb', name: 'English (UK)' }], timezones: ['UTC', 'America/New_York', 'Europe/London'], interfaces: ['eth0'], hostname: 'jeneros', reservedUsernames: [] },
  '/api/setup/status': { state: 'waiting' },
  '/api/storage': {
    available: true, requested: false, status: {}, pools: [],
    disks: [
      { path: '/dev/nvme0n1', model: 'Samsung SSD 970 EVO', serial: 'S46XNX0M', size: 250 * GB, rotational: false, transport: 'nvme', system: true, eligible: false, reason: 'System disk', identity: 'a' },
      { path: '/dev/sda', model: 'WD Red Plus', serial: 'WD-WX12A', size: 4 * TB, rotational: true, transport: 'sata', system: false, eligible: true, reason: '', identity: 'b' },
      { path: '/dev/sdb', model: 'WD Red Plus', serial: 'WD-WX34B', size: 4 * TB, rotational: true, transport: 'sata', system: false, eligible: true, reason: '', identity: 'c' },
      { path: '/dev/sdc', model: 'Seagate IronWolf', serial: 'ZA56C', size: 2 * TB, rotational: true, transport: 'usb', system: false, eligible: true, reason: '', identity: 'd' },
    ],
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    let body = api[url.pathname];
    if (typeof body === 'function') body = body();
    // Anything else (store catalog, update, session) falls back to the page's own sample data.
    res.writeHead(body ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body || {}));
    return;
  }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ });
  const shoot = async (name, { theme = 'dark', width = 1440, height = 900, page: url = '/index.html', act } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce', timezoneId: 'America/New_York', locale: 'en-US' });
    await ctx.addInitScript(theme => {
      // The dashboard keeps its own theme choice (Settings > General), not the system one.
      try { localStorage.setItem('jeneros.desktop', JSON.stringify({ theme, timeFormat: '12' })); } catch { /* Use defaults. */ }
      // A calm, fixed clock for every shot.
      const fixed = new Date('2026-10-08T09:41:00-04:00').getTime();
      const RealDate = Date;
      globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
      // Polls every 5s on a real box; run them faster so the network graph has history.
      const realTimeout = setTimeout;
      globalThis.setTimeout = (fn, ms, ...a) => realTimeout(fn, ms >= 2000 ? 150 : ms, ...a);
    }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error(name, 'page error:', e.message));
    await page.goto(base + url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(4500);
    if (act) await act(page);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('saved', name);
    await ctx.close();
  };

  const settings = p => p.click('header [data-settings="general"]');
  const storage = async p => { await settings(p); await p.waitForTimeout(500); await p.click('.settings-sidebar [data-settings="storage"]'); };
  const shots = {
    dashboard: {},
    'settings-general': { act: settings },
    'settings-storage': { act: storage },
    'storage-table': { act: async p => { await storage(p); await p.waitForTimeout(500); await p.click('#createStorage'); await p.waitForTimeout(500); await p.click('[data-storage-choice="raid1"]'); } },
    'store-discover': { act: p => p.click('#addApp') },
    'setup-welcome': { page: '/setup.html' },
    'phone-dashboard': { width: 390, height: 844 },
    'phone-setup': { width: 390, height: 844, page: '/setup.html' },
  };
  const only = process.argv.slice(2);
  for (const [name, opts] of Object.entries(shots)) {
    if (only.length && !only.includes(name)) continue;
    await shoot(name, opts);
    await shoot(name + '-light', { ...opts, theme: 'light' });
  }

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
