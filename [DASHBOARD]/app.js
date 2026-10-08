// JenerOS desktop. No dependencies, CDNs or copied reference artwork.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const doodle = id => `<svg class="doodle" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${esc(id)}"/></svg>`;
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
  { id: 'files', name: 'Files', icon: 'files', soon: 'Your folders, together in one place. File browsing is coming soon.' },
  { id: 'catalog', name: 'App Store', icon: 'apps' },
  { id: 'settings', name: 'Settings', icon: 'system' },
  { id: 'photos', name: 'Photos', icon: 'photos', soon: 'A home for every memory. Photo browsing and backup are coming soon.' },
  { id: 'backup', name: 'Backup', icon: 'backup', soon: 'Keep another copy of the things you love. Backup tools are coming soon.' },
  { id: 'machines', name: 'Machines', icon: 'machines', soon: 'Room for another computer inside your box. Virtual machines are coming soon.' },
];
// Motion helpers (.scratch/motion/BRIEF.md). Timing comes from the CSS tokens.
// Every helper falls back to an instant change when animation is unavailable,
// and under reduced motion keeps only short opacity fades.
const JenerMotion = window.JenerMotion = (() => {
  const root = document.documentElement;
  const token = name => root && typeof getComputedStyle === 'function' ? getComputedStyle(root).getPropertyValue(name).trim() : '';
  const ms = name => parseFloat(token(name)) || 0;
  const can = el => !!el && typeof el.animate === 'function' && typeof matchMedia === 'function';
  const moving = () => typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // cubic-bezier(x1, y1, x2, y2) as a function of progress, for tweens the browser can't run.
  function curve(name) {
    const [x1, y1, x2, y2] = (token(name).match(/-?[\d.]+/g) || [0, 0, 1, 1]).map(Number);
    const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return k => {
      let lo = 0, hi = 1, t = k;
      for (let i = 0; i < 20; i++) { t = (lo + hi) / 2; if (at(x1, x2, t) < k) lo = t; else hi = t; }
      return at(y1, y2, t);
    };
  }
  const running = new WeakMap();
  function stop(key) {
    if (running.has(key) && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(running.get(key));
    running.delete(key);
  }
  // Calls draw(eased 0..1, done) for `duration` ms; instant under reduced motion or in fixtures.
  function tween(key, duration, easing, draw) {
    stop(key);
    if (!moving() || typeof requestAnimationFrame !== 'function') { draw(1, true); return; }
    const ease = curve(easing), start = performance.now();
    const frame = now => {
      const k = Math.min(1, (now - start) / duration);
      draw(k === 1 ? 1 : ease(k), k === 1);
      if (k < 1) running.set(key, requestAnimationFrame(frame)); else running.delete(key);
    };
    running.set(key, requestAnimationFrame(frame));
  }
  function open(dialog) {
    dialog.closing?.cancel();
    if (!dialog.open) JenerUI.open(dialog);
  }
  // Plays the close animation, then calls the real close(). Reopening cancels it.
  function close(dialog) {
    if (!dialog?.open || dialog.closing) return;
    if (!can(dialog) || typeof dialog.getAnimations !== 'function') { JenerUI.close(dialog); return; }
    let cancelled = false;
    dialog.classList.add('is-closing');
    dialog.closing = { cancel() { cancelled = true; dialog.closing = null; dialog.classList.remove('is-closing'); } };
    const outro = dialog.getAnimations().filter(a => /j-(window|fade)-out/.test(a.animationName || ''));
    Promise.all(outro.map(a => a.finished)).then(() => {
      if (cancelled) return;
      dialog.closing = null; dialog.classList.remove('is-closing'); JenerUI.close(dialog);
    }, () => {});
  }
  // Runs fn once a just-opened window has settled, unless focus already moved.
  function settled(dialog, fn) {
    const intro = typeof dialog?.getAnimations === 'function' ? dialog.getAnimations().filter(a => a.animationName === 'j-window-in' && a.playState === 'running') : [];
    if (!intro.length) { fn(); return; }
    const before = document.activeElement;
    Promise.all(intro.map(a => a.finished)).then(() => { if (document.activeElement === before) fn(); }, () => {});
  }
  // New window content: 8px slide from the right with a crossfade.
  function enter(el) {
    if (!can(el)) return;
    el.animate(moving() ? [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: ms(moving() ? '--t-std' : '--t-quick'), easing: token('--ease') });
  }
  // Moves one highlight between sidebar items instead of repainting each item.
  function pill(nav) {
    if (!nav?.querySelector) return;
    let marker = nav.querySelector(':scope > .nav-pill');
    if (!marker) {
      if (typeof nav.prepend !== 'function') return;
      marker = document.createElement('span'); marker.className = 'nav-pill'; marker.setAttribute('aria-hidden', 'true'); marker.hidden = true;
      nav.prepend(marker); nav.classList.add('has-pill');
    }
    const current = nav.querySelector('button[aria-current]');
    if (!current || !current.offsetWidth) { marker.hidden = true; return; }
    const first = marker.hidden;
    marker.hidden = false;
    marker.style.width = `${current.offsetWidth}px`; marker.style.height = `${current.offsetHeight}px`;
    marker.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
    if (first || !moving()) { marker.style.transition = 'none'; void marker.offsetWidth; marker.style.transition = ''; }
  }
  // The only celebration: a check that pops and draws, and six dots that burst once.
  function celebrate(host) {
    if (!host?.insertAdjacentHTML || !moving()) return;
    host.insertAdjacentHTML('beforeend', [0, 1, 2, 3, 4, 5].map(i => {
      const a = i * Math.PI / 3 + .3;
      return `<span class="confetti" aria-hidden="true" style="--dx:${Math.round(Math.cos(a) * 26)}px;--dy:${Math.round(Math.sin(a) * 26)}px"></span>`;
    }).join(''));
    setTimeout(() => host.querySelectorAll(':scope > .confetti').forEach(dot => dot.remove()), 700);
  }
  if (typeof document.addEventListener === 'function') {
    // Escape plays the same close animation as the close buttons.
    document.addEventListener('cancel', e => { if (e.target?.localName === 'dialog') { e.preventDefault(); close(e.target); } }, true);
    document.addEventListener('visibilitychange', () => root?.classList.toggle('page-hidden', document.hidden));
  }
  return { token, ms, can, moving, curve, stop, tween, open, close, settled, enter, pill, celebrate };
})();
let demo = false, systemOnline = false, boxOnline = false, lastSystem = null, previousSystem = null;
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
  // session.js is deferred; app.js can run before it on the first page load.
  if (!window.JenerSession && document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  const res = await JenerSession.fetch(path, { cache: 'no-store', signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
  if (!res.ok) { const error = new Error(res.status); error.status = res.status; throw error; }
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
  const element = $(id), fill = element.querySelector('.gauge-fill');
  const from = Number(fill.dataset.value) || 0, to = value ?? 0;
  fill.dataset.value = to;
  // The ring sweeps to the new value and the number counts along with it.
  JenerMotion.tween(fill, 600, '--ease', (k, done) => {
    const now = done ? to : from + (to - from) * k;
    fill.style.strokeDasharray = `${now * 1.885} 251.3`;
    $(textID).textContent = value === null ? '—' : `${Math.round(now)}%`;
  });
  if (value === null) { element.removeAttribute('aria-valuenow'); element.setAttribute('aria-valuetext', 'Not available yet'); }
  else { element.setAttribute('aria-valuenow', value); element.removeAttribute('aria-valuetext'); }
}
function clock() {
  const now = new Date(), zone = preferences.timezone === 'local' ? {} : { timeZone: preferences.timezone };
  $('clockTime').textContent = new Intl.DateTimeFormat('en', { ...zone, hour: '2-digit', minute: '2-digit', hourCycle: preferences.timeFormat === '24' ? 'h23' : 'h12' }).format(now);
  $('clockTime').dateTime = now.toISOString();
  $('clockDate').textContent = new Intl.DateTimeFormat('en', { ...zone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
}
// Only unreachable servers and missing API routes qualify as static previews.
const previewFailure = error => !boxOnline && (error.status === 404 || (error.status === undefined && error.message !== 'Sign in to your owner account to continue.'));
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
  const shift = !!rates && graphSamples.length >= 48;
  if (rates) graphSamples.push(rates); else graphSamples = [];
  graphSamples = graphSamples.slice(-48);
  const scale = Math.max(1024, ...graphSamples.flatMap(p => [p.down, p.up]));
  $('networkDown').setAttribute('d', DesktopMetrics.graph(graphSamples, 'down', scale));
  $('networkUp').setAttribute('d', DesktopMetrics.graph(graphSamples, 'up', scale));
  // A full graph scrolls: the newest point slides in from the right.
  if (shift && JenerMotion.moving()) for (const id of ['networkDown', 'networkUp']) {
    if (JenerMotion.can($(id))) $(id).animate([{ transform: `translateX(${240 / 47}px)` }, { transform: 'none' }], { duration: JenerMotion.ms('--t-slow'), easing: JenerMotion.token('--ease') });
  }
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
function renderPendingSystem() {
  demo = false; lastSystem = null;
  $('previewNote').hidden = true;
  $('hostPill').textContent = 'Checking…';
  $('hostPill').classList.remove('demo');
  clearGraph();
  gauge('cpuGauge', 'statCpu', null); gauge('ramGauge', 'statMem', null);
  for (const id of ['cpuNote', 'ramNote', 'statDisk', 'diskTotal', 'storageBig', 'deviceIP', 'deviceName']) $(id).textContent = '—';
  $('temperature').hidden = true;
  meter('meterDisk', 0); meter('meterDisk2', 0);
  $('diskMeter').removeAttribute('aria-valuenow');
  $('diskHealth').textContent = 'Checking…';
  $('diskHealth').classList.remove('warning');
  $('storageNote').textContent = 'Checking…';
  $('storageNotice').textContent = 'Checking storage…';
  $('facts').innerHTML = '<dt>Device info</dt><dd>Checking…</dd>';
  $('connectionRows').innerHTML = '<p class="muted">Checking…</p>';
  $('networkNote').textContent = 'Checking…';
  $('networkName').textContent = '—';
  $('graphTitle').textContent = 'Checking network traffic…';
  renderSSH();
}
async function pollSystem() {
  try {
    const s = await getJSON('/api/system');
    if (demo) clearGraph();
    demo = false; systemOnline = true; boxOnline = true; renderSystem(s);
  } catch (error) {
    if (!systemOnline && previewFailure(error)) { demo = true; renderSystem(sampleSystem()); }
    else if (!systemOnline) { renderPendingSystem(); }
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
  JenerUI.close($('settingsWindow')); JenerUI.close($('appWindow'));
  JenerStore.open();
}
function openApp(id) {
  if (id === 'settings') return openSettings('general');
  if (id === 'catalog') return openCatalog();
  JenerUI.close($('settingsWindow'));
  const builtin = BUILTIN_TILES.find(t => t.id === id);
  const app = appCatalog.find(a => a.id === id);
  $('appWindowTitle').textContent = app?.name || builtin?.name || 'App';
  $('appWindowNote').textContent = app?.status === 'running' || app?.status === 'stopped'
    ? `${app.name} is ${app.status}. Launch and management controls are coming with app management.`
    : builtin?.soon || 'This app is coming soon. Take a look in the app catalog.';
  $('storeList').hidden = true;
  JenerMotion.open($('appWindow'));
}
function openSettings(page = 'general') {
  const titles = { general: 'General', storage: 'Storage', network: 'Network', apps: 'Apps', account: 'Account', power: 'Power' };
  if (!titles[page]) page = 'general';
  JenerUI.close($('appWindow'));
  $('settingsFeedback').hidden = true;
  const win = $('settingsWindow'), opening = !win.open || !!win.closing;
  const panels = [...document.querySelectorAll('[data-settings-panel]')];
  const before = panels.find(panel => !panel.hidden)?.dataset.settingsPanel;
  panels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== page; });
  document.querySelectorAll('.settings-sidebar [data-settings]').forEach(button => {
    if (button.dataset.settings === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('settingsPageTitle').textContent = titles[page];
  JenerMotion.open(win);
  win.querySelector('.settings-scroll').scrollTop = 0;
  JenerMotion.pill(win.querySelector('.settings-sidebar nav'));
  if (!opening && before !== page) JenerMotion.enter(panels.find(panel => !panel.hidden));
  // Focus moves once the window has settled (instantly if it was already open).
  JenerMotion.settled(win, () => $('settingsPageTitle').focus({ preventScroll: true }));
}
function route() {
  const view = location.hash.slice(2);
  if (['system', 'storage', 'network', 'account', 'settings'].includes(view)) openSettings(view === 'system' || view === 'settings' ? 'general' : view);
  else if (view === 'apps') openCatalog();
  else if (['files', 'photos', 'backup', 'machines'].includes(view)) openApp(view);
  else { JenerMotion.close($('settingsWindow')); JenerMotion.close($('appWindow')); JenerStore.close(); }
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
    const res = await JenerSession.fetch('/api/settings/ssh', { method: 'POST', headers: { 'X-JenerOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }), signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Could not change developer access.'); }
    sshInfo = { ...sshInfo, requested: true };
  } catch (err) { sshError = err.message || 'Could not reach your box. Please try again.'; }
  sshSubmitting = false; renderSSH();
});
// ---------- updates ----------
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
  } catch (error) {
    updateOnline = false;
    rollback.offline();
    // Only an operation already in progress can imply a restart.
    if (updateVersion && updateBusy) {
      setUpdate('Restarting into the new version. This page comes back by itself.');
    } else {
      if (!updateVersion) $('osVersion').textContent = 'JenerOS';
      setUpdate(updateVersion || !previewFailure(error) ? 'Connection lost. Trying your box again…' : 'Updates show up here when you open this page from your box.');
      $('checkBtn').disabled = true;
    }
    pollUpdate(updateBusy ? 3000 : 10000);
    return;
  }
  updateOnline = true; boxOnline = true;
  if (demo && !systemOnline) renderPendingSystem();
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
  } else if (av.noRelease) {
    setUpdate("You're on the newest version. No updates have been published yet.");
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
    const res = await JenerSession.fetch('/api/update', POST);
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
    const res = await JenerSession.fetch('/api/update/check', POST);
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
  else if (close) JenerMotion.close($(close.dataset.close));
});
$('closeSettings').addEventListener('click', () => JenerMotion.close($('settingsWindow')));
$('addApp').addEventListener('click', openCatalog);
$('browseApps').addEventListener('click', openCatalog);
$('widgetSettings').addEventListener('click', () => JenerMotion.open($('widgetWindow')));
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
  input.closest('label').classList.toggle('is-selected', input.checked);
  input.addEventListener('change', () => {
    preferences.wallpaper = input.value;
    document.querySelectorAll('[name="wallpaper"]').forEach(radio => radio.closest('label').classList.toggle('is-selected', radio.checked));
    savePreferences();
  });
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
  scrollNotices(stops[noticeIndex]);
}
// Slides by one card with the signature curve; touch, wheel or a key stops it.
function scrollNotices(left) {
  if (!JenerMotion.moving()) {
    track.scrollLeft = left;
    if (JenerMotion.can(track)) track.animate([{ opacity: .4 }, { opacity: 1 }], { duration: JenerMotion.ms('--t-quick'), easing: JenerMotion.token('--ease') });
    return;
  }
  const from = track.scrollLeft;
  track.style.scrollSnapType = 'none';
  JenerMotion.tween(track, 320, '--ease', (k, done) => {
    track.scrollLeft = from + (left - from) * k;
    if (done) track.style.scrollSnapType = '';
  });
}
function stopNotices() { JenerMotion.stop(track); track.style.scrollSnapType = ''; restartNotices(); }
// Auto-advance no faster than every 8s; paused on hover, focus, open windows,
// hidden tabs and reduced motion.
let noticeTimer;
function restartNotices() { clearInterval(noticeTimer); noticeTimer = setInterval(autoNotice, 8000); }
function autoNotice() {
  if (!JenerMotion.moving() || document.hidden || document.querySelector('dialog[open]') || track.closest('.notices').matches(':hover, :focus-within')) return;
  const stops = noticeStops();
  if (stops.length > 1) notice(noticeIndex + 1 >= stops.length ? 0 : noticeIndex + 1);
}
function syncNotices() {
  const stops = noticeStops();
  const max = stops[stops.length - 1];
  if ($('noticeDots').children.length !== stops.length) {
    $('noticeDots').innerHTML = stops.map((_, i) => `<button data-notice="${i}" aria-label="Notice page ${i + 1}"></button>`).join('');
  }
  noticeIndex = stops.reduce((best, left, i) => Math.abs(left - track.scrollLeft) < Math.abs(stops[best] - track.scrollLeft) ? i : best, 0);
  [...$('noticeDots').children].forEach((dot, i) => { if (i === noticeIndex) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
  $('noticePrev').disabled = track.scrollLeft <= 1;
  $('noticeNext').disabled = track.scrollLeft >= max - 1;
}
$('noticePrev').addEventListener('click', () => { restartNotices(); notice(noticeIndex - 1); });
$('noticeNext').addEventListener('click', () => { restartNotices(); notice(noticeIndex + 1); });
$('noticeDots').addEventListener('click', e => {
  const dot = e.target.closest('[data-notice]');
  if (dot) { restartNotices(); notice(Number(dot.dataset.notice)); }
});
track.addEventListener('scroll', syncNotices, { passive: true });
for (const name of ['pointerdown', 'wheel', 'touchstart']) track.addEventListener(name, stopNotices, { passive: true });
window.addEventListener('resize', () => {
  syncNotices();
  document.querySelectorAll('.settings-sidebar nav.has-pill').forEach(JenerMotion.pill);
});

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
  const scope = dialogs[dialogs.length - 1] || document;
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
renderPendingSystem(); setUpdate('Checking…');
renderApps([]); route(); syncNotices(); pollSystem(); pollSSH(); renderUpdate(); restartNotices();
// The load cascade plays once; later re-renders appear without it.
setTimeout(() => document.body.classList.remove('is-arriving'), 700);
(async () => {
  try { renderApps(await getJSON('/api/store')); } catch { renderApps(SAMPLE_STORE); }
})();

$('signOut').addEventListener('click', async () => {
  $('signOut').disabled = true;
  try {
    const res = await JenerSession.fetch('/api/auth/logout', POST);
    if (!res.ok) throw new Error('Could not sign out. Please try again.');
    location.replace('/login');
  } catch (err) { toast(err.message); $('signOut').disabled = false; }
});
(async () => {
  try { const session = await getJSON('/api/auth/session'); $('ownerName').textContent = session.username; }
  catch { /* Static previews can still show their sample data. */ }
})();
