// JenerOS desktop. No dependencies, CDNs or copied reference artwork.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const doodle = id => `<svg class="doodle" viewBox="0 0 28 28" aria-hidden="true"><use href="#i-${esc(id)}"/></svg>`;
const icon = id => `<span class="icon icon-${esc(id)}">${doodle(id)}</span>`;
const POST = { method: 'POST', headers: { 'X-JenerOS': '1' } };
const preferences = DesktopPreferences.value;
const SAMPLE_STORE = [
  { id: 'photos', name: 'Photos', upstream: 'Immich', tagline: 'Every photo and video, backed up from every device.', status: 'not-installed' },
  { id: 'drive', name: 'Drive', upstream: 'Nextcloud', tagline: 'Your files, synced to every computer and phone.', status: 'not-installed' },
  { id: 'home', name: 'Home', upstream: 'Home Assistant', tagline: 'Lights, locks, cameras and automations in one place.', status: 'not-installed' },
  { id: 'tv', name: 'TV', upstream: 'Jellyfin', tagline: 'Movies and shows streamed to your TVs, phones and Fire TVs.', status: 'not-installed' },
  { id: 'relay', name: 'Relay', upstream: 'AdGuard Home', tagline: 'Blocks ads and trackers for every device on your network.', status: 'not-installed' },
];
const BUILTIN_TILES = [
  { id: 'files', name: 'Files', icon: 'drive', soon: 'Your folders, together in one place. File browsing is coming soon.' },
  { id: 'catalog', name: 'App Store', icon: 'apps' },
  { id: 'settings', name: 'Settings', icon: 'system' },
  { id: 'photos', name: 'Photos', icon: 'photos', soon: 'A home for every memory. Photo browsing and backup are coming soon.' },
  { id: 'backup', name: 'Backup', icon: 'backup', soon: 'Keep another copy of the things you love. Backup tools are coming soon.' },
  { id: 'machines', name: 'Machines', icon: 'machines', soon: 'Room for another computer inside your box. Virtual machines are coming soon.' },
];
let demo = false, systemOnline = false, lastSystem = null, previousSystem = null;
let appCatalog = [], graphSamples = [], graphInterface = '';
let sshInfo = null, sshSubmitting = false, sshError = '';
let toastTimer;
function toast(message) {
  if ($('settingsWindow').open) {
    $('settingsFeedback').textContent = message;
    $('settingsFeedback').hidden = false;
    return;
  }
  if ($('widgetWindow').open) {
    $('widgetWindow').querySelector('.setting-help').textContent = message;
    return;
  }
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
}
async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
const gb = bytes => (bytes / 1e9 >= 100 ? Math.round(bytes / 1e9) : (bytes / 1e9).toFixed(1)) + ' GB';
const pct = (part, whole) => whole > 0 ? Math.min(100, Math.max(0, Math.round(part / whole * 100))) : 0;
function ago(seconds) {
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600);
  return days ? `${days} days ${hours} h` : hours ? `${hours} h ${Math.floor(seconds % 3600 / 60)} min` : `${Math.floor(seconds / 60)} min`;
}
function meter(id, value) { $(id).style.transform = `scaleX(${value / 100})`; }
function gauge(id, textID, value) {
  const element = $(id);
  $(textID).textContent = value === null ? '—' : `${value}%`;
  element.querySelector('.gauge-fill').style.strokeDasharray = `${value === null ? 0 : value * 1.885} 251.3`;
  if (value === null) { element.removeAttribute('aria-valuenow'); element.setAttribute('aria-valuetext', 'Not available yet'); }
  else { element.setAttribute('aria-valuenow', value); element.removeAttribute('aria-valuetext'); }
}
function clock() {
  const now = new Date(), zone = preferences.timezone === 'local' ? {} : { timeZone: preferences.timezone };
  $('clockTime').textContent = new Intl.DateTimeFormat('en', { ...zone, hour: '2-digit', minute: '2-digit', hourCycle: preferences.timeFormat === '24' ? 'h23' : 'h12' }).format(now);
  $('clockTime').dateTime = now.toISOString();
  $('clockDate').textContent = new Intl.DateTimeFormat('en', { ...zone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
}
function sampleSystem() {
  const tick = Math.floor(performance.now() / 5000);
  return { hostname: 'jeneros', manufacturer: 'Jener, Inc.', model: 'Sample box', arch: 'amd64', cpus: 4,
    memTotalMB: 8192, memFreeMB: 6500, uptimeSec: 273600 + tick * 5,
    diskTotalB: 128e9, diskFreeB: 94e9, addresses: ['192.168.1.20'], sshStatus: 'off',
    cpuCounters: { total: 100000 + tick * 2000, idle: 85000 + tick * 1840 },
    network: [{ name: 'eth0', addresses: ['192.168.1.20'], rxBytes: 1000000 + tick * 52000, txBytes: 500000 + tick * 8000 }] };
}
function clearGraph() {
  previousSystem = null; graphSamples = []; graphInterface = '';
  $('networkDown').setAttribute('d', 'M0 84H240'); $('networkUp').setAttribute('d', 'M0 84H240');
  $('downloadRate').textContent = '—'; $('uploadRate').textContent = '—';
}
function renderNetwork(s) {
  const networks = Array.isArray(s.network) ? s.network : [];
  const selected = networks.find(n => n.addresses?.includes(s.addresses?.[0])) || networks[0];
  const name = selected?.name || '';
  if (name !== graphInterface) { graphSamples = []; graphInterface = name; }
  const rates = name ? DesktopMetrics.network(previousSystem, s, name) : null;
  if (rates) graphSamples.push(rates); else graphSamples = [];
  graphSamples = graphSamples.slice(-48);
  const scale = Math.max(1024, ...graphSamples.flatMap(p => [p.down, p.up]));
  $('networkDown').setAttribute('d', DesktopMetrics.graph(graphSamples, 'down', scale));
  $('networkUp').setAttribute('d', DesktopMetrics.graph(graphSamples, 'up', scale));
  const rate = bytes => bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB/s` : `${(bytes / 1000).toFixed(1)} KB/s`;
  $('downloadRate').textContent = rates ? rate(rates.down) : '—';
  $('uploadRate').textContent = rates ? rate(rates.up) : '—';
  $('networkName').textContent = name || 'LAN';
  $('graphScale').textContent = rates ? rate(scale) : 'KB/s';
  $('networkNote').textContent = demo ? 'Sample traffic · 5-second readings' : rates ? 'Live traffic · last 4 minutes' : name ? 'Waiting for the next reading' : 'Traffic readings unavailable';
  $('graphTitle').textContent = rates ? `${demo ? 'Sample' : 'Live'} traffic on ${name}: download ${rate(rates.down)}, upload ${rate(rates.up)}` : 'Network traffic readings unavailable';
  $('connectionRows').innerHTML = networks.length
    ? networks.map(n => `<div class="connection-row"><strong>${esc(n.name)}</strong><p>Connected · ${esc((n.addresses || []).join(' · '))}</p></div>`).join('')
    : `<div class="connection-row"><strong>Home network</strong><p>${esc((s.addresses || []).join(' · ') || 'No home address yet')}${s.addresses?.length ? ' · Connection details unavailable' : ''}</p></div>`;
}
function renderSystem(s) {
  lastSystem = s;
  $('previewNote').hidden = !demo;
  $('hostPill').textContent = demo ? 'Sample data' : s.hostname;
  $('hostPill').classList.toggle('demo', demo);
  $('connectionNote').hidden = true;
  document.querySelector('.widgets').classList.remove('stale');
  const usedMemory = Math.max(0, s.memTotalMB - s.memFreeMB);
  const usedDisk = Math.max(0, s.diskTotalB - s.diskFreeB);
  const diskPercent = pct(usedDisk, s.diskTotalB);
  gauge('cpuGauge', 'statCpu', DesktopMetrics.cpu(previousSystem, s));
  gauge('ramGauge', 'statMem', s.memTotalMB ? pct(usedMemory, s.memTotalMB) : null);
  $('cpuNote').textContent = `${s.cpus || '—'} cores`;
  $('ramNote').textContent = s.memTotalMB ? `${(s.memTotalMB / 1024).toFixed(1)} GB` : 'Unknown';
  const temp = s.temperatureC;
  $('temperature').hidden = !Number.isFinite(temp);
  $('temperature').textContent = Number.isFinite(temp) ? `Temperature · ${temp.toFixed(0)} °C` : '';
  $('statDisk').textContent = s.diskTotalB ? `Used: ${gb(usedDisk)}` : 'Used: unknown';
  $('diskTotal').textContent = s.diskTotalB ? `Total: ${gb(s.diskTotalB)}` : 'Total: unknown';
  $('diskHealth').textContent = diskPercent >= 90 ? 'Almost full' : 'System disk';
  $('diskHealth').classList.toggle('warning', diskPercent >= 90);
  $('diskHealth').title = 'Drive health checks arrive with storage management.';
  meter('meterDisk', diskPercent); meter('meterDisk2', diskPercent);
  if (s.diskTotalB) $('diskMeter').setAttribute('aria-valuenow', diskPercent); else $('diskMeter').removeAttribute('aria-valuenow');
  $('storageBig').textContent = s.diskTotalB ? `${gb(s.diskFreeB)} free` : 'Space unknown';
  $('storageNote').textContent = s.diskTotalB ? `${gb(usedDisk)} used of ${gb(s.diskTotalB)}. Apps, settings and logs live here.` : 'Apps, settings and logs live here.';
  $('storageNotice').textContent = s.diskTotalB ? `${gb(s.diskFreeB)} free on your system disk. Disk pools and extra drives will be managed here soon.` : 'Your system disk keeps apps, settings and logs. More storage options are coming soon.';
  $('deviceName').textContent = s.hostname || 'JenerOS';
  $('deviceIP').textContent = s.addresses?.join(' · ') || 'No address yet';
  if (!sshInfo) renderSSH();
  const facts = [['Name', s.hostname], ['Manufacturer', s.manufacturer], ['Model', s.model], ['Address', s.addresses?.join(', ')],
    ['Processor', `${s.cpus} cores · ${s.arch}`], ['Memory', s.memTotalMB ? `${(s.memTotalMB / 1024).toFixed(1)} GB` : ''], ['Kernel', s.kernel], ['Build date', s.buildDate], ['Awake for', ago(s.uptimeSec)]];
  $('facts').innerHTML = facts.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value || 'Not available')}</dd>`).join('');
  renderNetwork(s);
  previousSystem = s;
}
async function pollSystem() {
  try {
    const s = await getJSON('/api/system');
    if (demo) clearGraph();
    demo = false; systemOnline = true; renderSystem(s);
  } catch {
    if (!systemOnline) { demo = true; renderSystem(sampleSystem()); }
    else {
      clearGraph(); gauge('cpuGauge', 'statCpu', null);
      $('hostPill').textContent = 'Reconnecting…';
      document.querySelector('.widgets').classList.add('stale');
      $('connectionNote').hidden = false;
      $('connectionNote').textContent = 'Connection lost. Disk and memory show the last reading; trying again…';
      $('networkNote').textContent = 'Connection lost';
      $('graphTitle').textContent = 'Connection lost. Traffic readings are unavailable.';
      $('deviceIP').textContent = 'Connection lost';
      if (!sshInfo) renderSSH();
      $('connectionRows').innerHTML = '<p class="muted">Connection lost. Trying again…</p>';
    }
  }
  setTimeout(pollSystem, 5000);
}
function renderApps(apps) {
  appCatalog = Array.isArray(apps) ? apps : [];
  const installed = appCatalog.filter(a => a.status === 'running' || a.status === 'stopped');
  const tiles = BUILTIN_TILES.filter(t => !installed.some(a => a.id === t.id));
  $('homeTiles').innerHTML = [...tiles, ...installed.map(a => ({ id: a.id, name: a.name, icon: ['photos', 'drive', 'home', 'tv', 'relay'].includes(a.id) ? a.id : 'apps', status: a.status }))].map(t =>
    `<button class="desktop-tile" data-app="${esc(t.id)}">${icon(t.icon)}<span class="tile-name">${esc(t.name)}</span>${t.soon ? '<span class="tile-status">Coming soon</span>' : t.status ? `<span class="tile-status">${esc(t.status === 'running' ? 'Running' : 'Stopped')}</span>` : ''}</button>`).join('');
  filterApps();
}
function filterApps() {
  const query = $('appSearch').value.trim().toLocaleLowerCase();
  const tiles = [...$('homeTiles').children];
  tiles.forEach(tile => { tile.hidden = !tile.querySelector('.tile-name').textContent.toLocaleLowerCase().includes(query); });
  $('searchEmpty').hidden = tiles.some(tile => !tile.hidden);
}
function openCatalog() {
  $('settingsWindow').close(); $('appWindow').close();
  JenerStore.open();
}
function openApp(id) {
  if (id === 'settings') return openSettings('general');
  if (id === 'catalog') return openCatalog();
  $('settingsWindow').close();
  const builtin = BUILTIN_TILES.find(t => t.id === id);
  const app = appCatalog.find(a => a.id === id);
  $('appWindowTitle').textContent = app?.name || builtin?.name || 'App';
  $('appWindowNote').textContent = app?.status === 'running' || app?.status === 'stopped'
    ? `${app.name} is ${app.status}. Launch and management controls are coming with app management.`
    : builtin?.soon || 'This app is coming soon. Take a look in the app catalog.';
  $('storeList').hidden = true;
  if (!$('appWindow').open) $('appWindow').showModal();
}
function openSettings(page = 'general') {
  const titles = { general: 'General', storage: 'Storage', network: 'Network', apps: 'Apps', account: 'Account', power: 'Power' };
  if (!titles[page]) page = 'general';
  $('appWindow').close();
  $('settingsFeedback').hidden = true;
  document.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== page; });
  document.querySelectorAll('.settings-sidebar [data-settings]').forEach(button => {
    if (button.dataset.settings === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('settingsPageTitle').textContent = titles[page];
  if (!$('settingsWindow').open) $('settingsWindow').showModal();
  $('settingsWindow').querySelector('.settings-scroll').scrollTop = 0;
  $('settingsPageTitle').focus({ preventScroll: true });
}
function route() {
  const view = location.hash.slice(2);
  if (['system', 'storage', 'network', 'account', 'settings'].includes(view)) openSettings(view === 'system' || view === 'settings' ? 'general' : view);
  else if (view === 'apps') openCatalog();
  else if (view === 'machines') openApp('machines');
  else { $('settingsWindow').close(); $('appWindow').close(); JenerStore.close(); }
}
function savePreferences() {
  if (!DesktopPreferences.save()) toast('Changed for now. This browser could not save your choices.');
}
function applyWidgets() {
  document.querySelectorAll('[data-widget]').forEach(widget => { widget.hidden = !preferences.widgets[widget.dataset.widget]; });
  document.querySelectorAll('[data-widget-toggle]').forEach(input => { input.checked = preferences.widgets[input.dataset.widgetToggle]; });
}

// The API queues one fixed action. The separate root worker applies it;
// the switch follows the actual port-22 listener, including socket activation.
function renderSSH() {
  const state = sshInfo?.sshStatus || (systemOnline ? lastSystem?.sshStatus : 'unknown');
  const busy = sshSubmitting || sshInfo?.requested || sshInfo?.status?.state === 'applying';
  $('sshToggle').checked = state === 'on';
  $('sshToggle').disabled = !sshInfo?.available || sshInfo.devMode || busy || !['on', 'off'].includes(state);
  $('sshNote').textContent = busy ? 'Changing developer access…'
    : sshError ? sshError
    : sshInfo?.status?.state === 'failed' ? sshInfo.status.message
    : sshInfo?.devMode ? 'This development image keeps SSH on for testing.'
    : sshInfo?.available ? state === 'on' ? 'SSH is on (port 22). Use your local account to sign in.' : state === 'off' ? 'SSH is off. Turn it on when you need developer access.' : 'SSH status is unavailable. Please check your box locally.'
    : demo ? 'Sample status. Open this page from your box to change SSH.' : 'SSH controls need the updated box after setup. Current status: ' + (state === 'on' ? 'on' : state === 'off' ? 'off' : 'unavailable') + '.';
}
async function pollSSH() {
  try { sshInfo = await getJSON('/api/settings/ssh'); } catch { sshInfo = null; }
  renderSSH();
  setTimeout(pollSSH, 3000);
}
$('sshToggle').addEventListener('change', async () => {
  const enabled = $('sshToggle').checked;
  if (sshSubmitting || !sshInfo?.available || sshInfo.devMode) { renderSSH(); return; }
  sshError = ''; sshSubmitting = true; renderSSH();
  try {
    const res = await fetch('/api/settings/ssh', { method: 'POST', headers: { 'X-JenerOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }), signal: AbortSignal.timeout(8000) });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Could not change developer access.'); }
    sshInfo = { ...sshInfo, requested: true };
  } catch (err) { sshError = err.message || 'Could not reach your box. Please try again.'; }
  sshSubmitting = false; renderSSH();
});
// ---------- updates (polling logic by Codex) ----------
let updateTimer, updateVersion, updateOnline = false, updateBusy = false;
const rollback = JenerRollback.bind($('rollbackBtn'), message => { $('rollbackMessage').textContent = message; });

function pollUpdate(delay) {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(renderUpdate, delay);
}

function setUpdate(text, availVersion) {
  $('updateText').textContent = text;
  $('rollbackBtn').disabled = !updateOnline || updateBusy || rollback.pending;
  $('checkBtn').disabled = !updateOnline || updateBusy;
  const show = !!availVersion && !updateBusy;
  $('updateBtn').hidden = !show;
  $('barUpdate').hidden = !show;
  if (show) {
    $('updateBtn').textContent = `Update to ${availVersion}`;
    $('barUpdate').textContent = `Update to ${availVersion}`;
  }
}

async function renderUpdate() {
  clearTimeout(updateTimer);
  let u;
  try {
    u = await getJSON('/api/update');
  } catch {
    updateOnline = false;
    rollback.offline();
    // Only an operation already in progress can imply a restart.
    if (updateVersion && updateBusy) {
      setUpdate('Restarting into the new version. This page comes back by itself.');
    } else {
      if (!updateVersion) $('osVersion').textContent = 'JenerOS';
      setUpdate(updateVersion ? 'Connection lost. Trying your box again…' : 'Updates show up here when you open this page from your box.');
      $('checkBtn').disabled = true;
    }
    pollUpdate(updateBusy ? 3000 : 10000);
    return;
  }
  updateOnline = true;
  rollback.render(u);
  $('checkBtn').disabled = false;
  if (updateVersion && u.current && updateVersion !== u.current) toast(`Now running JenerOS ${u.current}`);
  updateVersion = u.current;
  $('osVersion').textContent = `JenerOS ${u.current}`;

  const st = u.status && u.status.state;
  const av = u.available || {};
  updateBusy = rollback.pending || !!u.requested || st === 'installing' || st === 'rebooting';
  pollUpdate(updateBusy ? 3000 : 10000);

  if (updateBusy) {
    const v = (u.status && u.status.version) || av.version;
    setUpdate(rollback.pending ? 'Starting the other installed version. Your box will restart.' : st === 'rebooting' ? `Restarting into JenerOS ${v}…` : st === 'installing' ? `Installing JenerOS ${v}. Your box restarts by itself.` : 'Starting the update…');
  } else if (av.error) {
    setUpdate("Can't reach the update server. Check that the box is online, then try again.");
  } else if (av.version) {
    setUpdate(`JenerOS ${av.version} is ready to install.`, av.version);
  } else if (st === 'failed') {
    setUpdate(`The update to ${u.status.version || 'the new version'} didn't install. You're still on ${u.current}.`);
  } else if (av.rolledBack) {
    setUpdate(`JenerOS ${av.rolledBack} didn't start properly, so your box went back to ${u.current} by itself. Nothing was lost.`);
  } else if (av.checked) {
    setUpdate(`You're up to date. Last checked ${new Date(av.checked).toLocaleString()}.`);
  } else {
    setUpdate("You're on the newest version we know about.");
  }
}

async function startUpdate() {
  if (!updateOnline || updateBusy || rollback.pending) return;
  updateBusy = true;
  setUpdate('Starting the update…');
  try {
    const res = await fetch('/api/update', POST);
    if (!res.ok) throw new Error(res.status);
  } catch {
    updateBusy = false;
    toast("Couldn't start the update.");
  }
  pollUpdate(1500);
}

$('updateBtn').addEventListener('click', startUpdate);
$('barUpdate').addEventListener('click', startUpdate);
$('checkBtn').addEventListener('click', async () => {
  const btn = $('checkBtn');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    const res = await fetch('/api/update/check', POST);
    if (!res.ok) throw new Error(res.status);
    setTimeout(renderUpdate, 4000);
  } catch {
    toast("Couldn't check for updates.");
  }
  setTimeout(() => { btn.disabled = !updateOnline || updateBusy; btn.textContent = 'Check now'; }, 4000);
});


// ---------- desktop windows and preferences ----------
document.addEventListener('click', e => {
  const settings = e.target.closest('[data-settings]'), app = e.target.closest('[data-app]'), close = e.target.closest('[data-close]');
  if (settings) openSettings(settings.dataset.settings);
  else if (app) openApp(app.dataset.app);
  else if (close) $(close.dataset.close).close();
});
$('closeSettings').addEventListener('click', () => $('settingsWindow').close());
$('addApp').addEventListener('click', openCatalog);
$('browseApps').addEventListener('click', openCatalog);
$('widgetSettings').addEventListener('click', () => $('widgetWindow').showModal());
$('powerRollback').addEventListener('click', () => { openSettings('general'); $('rollbackBtn').focus(); });
$('deviceInfo').addEventListener('click', () => {
  $('facts').hidden = !$('facts').hidden;
  $('deviceInfo').setAttribute('aria-expanded', String(!$('facts').hidden));
});
for (const [id, key] of [['appearance', 'theme'], ['timezone', 'timezone'], ['timeFormat', 'timeFormat']]) {
  $(id).value = preferences[key];
  $(id).addEventListener('change', () => { preferences[key] = $(id).value; savePreferences(); clock(); });
}
document.querySelectorAll('[name="wallpaper"]').forEach(input => {
  input.checked = input.value === preferences.wallpaper;
  input.addEventListener('change', () => { preferences.wallpaper = input.value; savePreferences(); });
});
document.querySelectorAll('[data-widget-toggle]').forEach(input => input.addEventListener('change', () => {
  preferences.widgets[input.dataset.widgetToggle] = input.checked; savePreferences(); applyWidgets();
}));
function updateAvatarChoices() {
  document.querySelectorAll('.avatar-options [data-avatar]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.avatar === preferences.avatar)));
}
document.querySelectorAll('.avatar-options [data-avatar]').forEach(button => button.addEventListener('click', () => {
  preferences.avatar = button.dataset.avatar; savePreferences(); updateAvatarChoices();
}));
$('searchForm').addEventListener('submit', e => { e.preventDefault(); $('homeTiles').querySelector('button:not([hidden])')?.focus(); });
$('appSearch').addEventListener('input', filterApps);
window.addEventListener('hashchange', route);

// Touch scroll, keyboard controls and dots all use the same scroll position.
let noticeIndex = 0;
const track = $('noticeTrack');
function noticeStops() {
  const max = Math.max(0, track.scrollWidth - track.clientWidth);
  return [...track.children].map(card => Math.min(max, card.offsetLeft - track.children[0].offsetLeft))
    .filter((left, i, all) => !i || left - all[i - 1] > 1);
}
function notice(index) {
  const stops = noticeStops();
  noticeIndex = Math.max(0, Math.min(stops.length - 1, index));
  const left = stops[noticeIndex];
  track.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function syncNotices() {
  const stops = noticeStops();
  const max = stops.at(-1);
  if ($('noticeDots').children.length !== stops.length) {
    $('noticeDots').innerHTML = stops.map((_, i) => `<button data-notice="${i}" aria-label="Notice page ${i + 1}"></button>`).join('');
  }
  noticeIndex = stops.reduce((best, left, i) => Math.abs(left - track.scrollLeft) < Math.abs(stops[best] - track.scrollLeft) ? i : best, 0);
  [...$('noticeDots').children].forEach((dot, i) => { if (i === noticeIndex) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
  $('noticePrev').disabled = track.scrollLeft <= 1;
  $('noticeNext').disabled = track.scrollLeft >= max - 1;
}
$('noticePrev').addEventListener('click', () => notice(noticeIndex - 1));
$('noticeNext').addEventListener('click', () => notice(noticeIndex + 1));
$('noticeDots').addEventListener('click', e => {
  const dot = e.target.closest('[data-notice]');
  if (dot) notice(Number(dot.dataset.notice));
});
track.addEventListener('scroll', syncNotices, { passive: true });
window.addEventListener('resize', syncNotices);

// Arrow keys stay inside the top dialog. Native editors and radios keep their
// own keyboard behavior; the desktop keeps TV remote navigation.
document.addEventListener('keydown', e => {
  const editing = document.activeElement?.matches('input, textarea, select');
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  if (e.key === '/' && !editing && !dialogs.length) { e.preventDefault(); $('appSearch').focus(); return; }
  if (e.key === 'Escape' && document.activeElement === $('appSearch') && $('appSearch').value) {
    $('appSearch').value = ''; filterApps(); e.preventDefault(); return;
  }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir || editing || e.altKey || e.ctrlKey || e.metaKey) return;
  const here = document.activeElement;
  if (here === track && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); notice(noticeIndex + dir[0]); return; }
  const scope = dialogs.at(-1) || document;
  const items = [...scope.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el !== here && el.getClientRects().length);
  if (!items.length) return;
  if (!here || here === document.body || here.matches('h3')) { e.preventDefault(); items[0].focus(); return; }
  const from = here.getBoundingClientRect();
  let best, score = Infinity;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - from.left - from.width / 2, dy = r.top + r.height / 2 - from.top - from.height / 2;
    const along = dx * dir[0] + dy * dir[1], candidate = along + Math.abs(dx * dir[1] + dy * dir[0]) * 2;
    if (along > 4 && candidate < score) { score = candidate; best = el; }
  }
  if (best) { e.preventDefault(); best.focus(); best.scrollIntoView({ block: 'nearest' }); }
});

// ---------- start ----------
applyWidgets(); updateAvatarChoices(); clock(); setInterval(clock, 1000);
renderApps([]); route(); syncNotices(); pollSystem(); pollSSH(); renderUpdate();
(async () => {
  try { renderApps(await getJSON('/api/store')); } catch { renderApps(SAMPLE_STORE); }
})();
