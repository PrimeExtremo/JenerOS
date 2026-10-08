// Local fixtures. No browser, services or system settings are operated here.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const html = fs.readFileSync('[DASHBOARD]/index.html', 'utf8');
const source = fs.readFileSync('[DASHBOARD]/app.js', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'duplicate HTML IDs');
for (const match of source.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), `missing DOM ID ${match[1]}`);
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  assert.ok(!/^(https?:)?\/\//.test(match[1]), 'no CDN assets');
  assert.ok(fs.existsSync(path.join('[DASHBOARD]', match[1])), `missing asset ${match[1]}`);
}
for (const match of html.matchAll(/<use href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `missing symbol ${match[1]}`);
for (const file of ['index.html', 'app.js', 'desktop.css', 'desktop-preferences.js', 'desktop-metrics.js', 'wallpaper-ribbon.svg', 'wallpaper-dune.svg']) {
  const data = fs.readFileSync(path.join('[DASHBOARD]', file), 'utf8');
  assert.ok(!data.includes('\r') && !data.startsWith('\uFEFF'), `${file}: use LF without BOM`);
  assert.ok(!/Zima|PeerDrop|ZVM|Network ID|Arvey/.test(data), `${file}: reference branding leaked`);
}
const metricsContext = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync('[DASHBOARD]/desktop-metrics.js', 'utf8'), metricsContext);
const metrics = metricsContext.window.DesktopMetrics;
const first = { uptimeSec: 100, cpuCounters: { total: 1000, idle: 800 }, network: [{ name: 'eth0', rxBytes: 1000, txBytes: 200 }] };
const next = { uptimeSec: 105, cpuCounters: { total: 3000, idle: 2300 }, network: [{ name: 'eth0', rxBytes: 51000, txBytes: 10200 }] };
assert.equal(metrics.cpu(first, next), 25);
assert.equal(metrics.cpu(null, first), null);
assert.equal(metrics.cpu(first, first), null);
assert.equal(metrics.cpu(next, first), null);
assert.equal(metrics.cpu(first, { ...next, cpuCounters: { total: 3000, idle: 100 } }), null, 'decreasing idle is unknown');
assert.equal(metrics.cpu(first, { ...next, cpuCounters: { total: 3000, idle: 5000 } }), null);
assert.equal(metrics.network(first, next, 'eth0').down, 10000);
assert.equal(metrics.network(first, next, 'eth0').up, 2000);
assert.equal(metrics.network(first, next, 'wlan0'), null);
assert.equal(metrics.network(next, first, 'eth0'), null);
assert.equal(metrics.network(first, { ...next, uptimeSec: 200 }, 'eth0'), null, 'long disconnect starts a fresh graph');
assert.equal(metrics.network(first, { ...next, network: [{ name: 'eth0', rxBytes: 0, txBytes: 0 }] }, 'eth0'), null);
assert.equal(metrics.network(first, { ...next, network: [{ name: 'eth0' }] }, 'eth0'), null, 'missing counters are not zero');
assert.equal(metrics.graph([], 'up', 1024), 'M0 84H240');
assert.equal(metrics.graph([{ down: 0 }, { down: 1024 }], 'down', 1024), 'M0.0 84.0 L240.0 10.0');

const preferencesSource = fs.readFileSync('[DASHBOARD]/desktop-preferences.js', 'utf8');
function preferences(saved, blocked = false) {
  const dataset = {}, writes = [];
  const context = vm.createContext({ window: {}, document: { documentElement: { dataset } }, localStorage: {
    getItem() { if (blocked) throw Error('blocked'); return saved; },
    setItem(key, value) { if (blocked) throw Error('blocked'); writes.push({ key, value }); },
  } });
  vm.runInContext(preferencesSource, context);
  return { prefs: context.window.DesktopPreferences, dataset, writes };
}
assert.equal(preferences(null).dataset.theme, 'dark');
assert.equal(preferences('{broken').dataset.theme, 'dark');
assert.equal(preferences('null').dataset.wallpaper, 'ribbon');
const persisted = preferences(JSON.stringify({ theme: 'light', wallpaper: 'dune', timeFormat: '12', timezone: 'UTC', avatar: 'sage', widgets: { network: false } }));
assert.equal(persisted.dataset.theme, 'light'); assert.equal(persisted.dataset.wallpaper, 'dune');
assert.equal(persisted.prefs.value.widgets.network, false); assert.equal(persisted.prefs.value.widgets.clock, true);
assert.equal(persisted.prefs.save(), true); assert.equal(persisted.writes[0].key, 'jeneros.desktop');
assert.equal(preferences(JSON.stringify({ theme: 'other', timezone: 'bogus', widgets: { clock: 'no' } })).prefs.value.timezone, 'local');
assert.equal(preferences(null, true).prefs.save(), false);

// A small DOM fixture exercises actual rendering and handlers, not a browser.
class Element {
  constructor(id = '') { this.id = id; this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; this.textContent = ''; this.style = {}; this.children = []; this.listeners = {}; this.open = false; this.classList = { add() {}, remove() {}, toggle() {} }; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  querySelector(name) { if (name === '.tile-name') return { textContent: this.textContent }; return this.child ||= new Element(); }
  closest() { return this; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  set innerHTML(value) {
    this.content = value;
    this.children = [...value.matchAll(/<button[^>]*data-app="([^"]+)"[\s\S]*?<span class="tile-name">([^<]*)<\/span>[\s\S]*?<\/button>/g)].map(m => { const el = new Element(); el.dataset.app = m[1]; el.textContent = m[2]; return el; });
  }
  get innerHTML() { return this.content || ''; }
}
const elements = new Map(ids.map(id => [id, new Element(id)]));
const element = id => { assert.ok(elements.has(id), `unknown element ${id}`); return elements.get(id); };
const panels = ['general', 'storage', 'network', 'apps', 'account', 'power'].map(page => { const el = new Element(); el.dataset.settingsPanel = page; return el; });
const nav = panels.map(panel => { const el = new Element(); el.dataset.settings = panel.dataset.settingsPanel; return el; });
const widgets = ['clock', 'system', 'storage', 'network'].map(name => { const el = new Element(); el.dataset.widget = name; return el; });
const toggles = widgets.map(widget => { const el = new Element(); el.dataset.widgetToggle = widget.dataset.widget; return el; });
const wallpaper = ['ribbon', 'dune', 'plain'].map(name => { const el = new Element(); el.value = name; return el; });
const avatar = ['orange', 'sage', 'clay'].map(name => { const el = new Element(); el.dataset.avatar = name; return el; });
const collections = { '[data-settings-panel]': panels, '.settings-sidebar [data-settings]': nav, '[data-widget]': widgets, '[data-widget-toggle]': toggles, '[name="wallpaper"]': wallpaper, '.avatar-options [data-avatar]': avatar };
const requests = [];
const context = vm.createContext({ window: { addEventListener() {} }, document: {
  getElementById: element, querySelectorAll: name => collections[name] || [], querySelector: () => new Element(), addEventListener() {},
}, DesktopPreferences: persisted.prefs, DesktopMetrics: metrics, location: { hash: '#/home' },
  setTimeout() {}, clearTimeout() {}, setInterval() {}, AbortSignal,
  JenerRollback: { bind() { return { pending: false, render() {}, offline() {} }; } },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({}) }; },
});
context.JenerUI = { open: d => d.showModal(), close: d => d.open && d.close() };
context.JenerSession = { fetch: (...args) => context.fetch(...args) };
vm.runInContext(source.slice(0, source.indexOf('// ---------- start ----------')), context);
const run = code => vm.runInContext(code, context);
run('renderApps(SAMPLE_STORE)');
assert.equal(element('homeTiles').children.length, 6);
element('appSearch').value = 'photos'; run('filterApps()');
assert.equal(element('homeTiles').children.filter(el => !el.hidden).length, 1);
element('appSearch').value = 'nothing matches'; run('filterApps()'); assert.equal(element('searchEmpty').hidden, false);
run('openSettings("network")'); assert.equal(element('settingsWindow').open, true);
assert.equal(panels.find(p => p.dataset.settingsPanel === 'network').hidden, false);
assert.equal(panels.find(p => p.dataset.settingsPanel === 'general').hidden, true);
run('openSettings("nonsense")'); assert.equal(element('settingsPageTitle').textContent, 'General');
run('openApp("files")'); assert.match(element('appWindowNote').textContent, /coming soon/);
run('renderSystem({ hostname: "<script>bad</script>", cpus: 4, arch: "amd64", uptimeSec: 100, memTotalMB: 8192, memFreeMB: 4096, diskTotalB: 100e9, diskFreeB: 4e9, addresses: ["fd12::20"], network: [], sshStatus: "off" })');
assert.equal(element('statMem').textContent, '50%'); assert.equal(element('diskHealth').textContent, 'Almost full');
assert.ok(!element('facts').innerHTML.includes('<script>')); assert.match(element('deviceIP').textContent, /fd12/);
run('sshInfo = {available: true, sshStatus: "off", status: {}}; renderSSH()'); assert.equal(element('sshToggle').disabled, false);
(async () => {
  element('sshToggle').checked = true; await element('sshToggle').listeners.change();
  assert.equal(requests.at(-1).url, '/api/settings/ssh'); assert.equal(requests.at(-1).options.headers['X-JenerOS'], '1');
  assert.equal(JSON.parse(requests.at(-1).options.body).enabled, true);
  assert.equal(element('sshToggle').disabled, true, 'queued actions disable the switch');
  assert.equal(element('sshToggle').checked, false, 'switch waits for the actual listener');
  run('sshInfo = {available: true, sshStatus: "on", devMode: true}; renderSSH()'); assert.equal(element('sshToggle').disabled, true);
  run('sshInfo = {available: true, sshStatus: "off", status: {state: "failed", message: "Could not start SSH."}}; renderSSH()');
  assert.match(element('sshNote').textContent, /Could not start SSH/);
  assert.equal(element('sshToggle').disabled, false, 'failed changes can be retried');
  context.fetch = async () => ({ ok: false, json: async () => ({error: 'Please finish setup.'}) });
  element('sshToggle').checked = true; await element('sshToggle').listeners.change();
  assert.equal(element('sshNote').textContent, 'Please finish setup.', 'failure remains visible in settings');
  context.fetch = async () => { throw Error('offline'); };
  await run('renderUpdate()'); assert.equal(element('checkBtn').disabled, true);
  assert.ok(!element('updateText').textContent.includes('Restarting'), 'offline is not automatically a restart');
  console.log('Desktop fixtures passed: assets/IDs, counters/reset/offline, saved preferences, search/windows, escaping, SSH submission and observed state, update offline state.');
})().catch(err => { console.error(err); process.exitCode = 1; });
