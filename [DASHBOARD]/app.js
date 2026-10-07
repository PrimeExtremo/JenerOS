// JenerOS dashboard. Talks to jenerd; falls back to labelled sample data when
// opened without a box behind it (file preview, dev).

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const doodle = (id) => `<svg class="doodle" viewBox="0 0 28 28" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const icon = (id) => `<span class="icon icon-${id}">${doodle(id)}</span>`;
const POST = { method: 'POST', headers: { 'X-JenerOS': '1' } };

const SAMPLE_SYSTEM = {
  hostname: 'jeneros', arch: 'amd64', os: 'linux', cpus: 4, memTotalMB: 8192, memFreeMB: 5530,
  uptimeSec: 273600, load1: 0.42, diskTotalB: 28.7e9, diskFreeB: 24.1e9, addresses: ['192.168.1.20'],
};
const SAMPLE_STORE = [
  { id: 'photos', name: 'Photos', upstream: 'Immich', tagline: 'Every photo and video, backed up from every device.', status: 'not-installed' },
  { id: 'drive', name: 'Drive', upstream: 'Nextcloud', tagline: 'Your files, synced to every computer and phone.', status: 'not-installed' },
  { id: 'home', name: 'Home', upstream: 'Home Assistant', tagline: 'Lights, locks, cameras and automations in one place.', status: 'not-installed' },
  { id: 'tv', name: 'TV', upstream: 'Jellyfin', tagline: 'Movies and shows streamed to your TVs, phones and Fire TVs.', status: 'not-installed' },
  { id: 'relay', name: 'Relay', upstream: 'AdGuard Home', tagline: 'Blocks ads and trackers for every device on your network.', status: 'not-installed' },
];
const PAGE_TILES = [
  { view: 'apps', name: 'Apps', sub: 'See what you can add', icon: 'apps' },
  { view: 'storage', name: 'Storage', sub: 'Disks and space', icon: 'disk' },
  { view: 'machines', name: 'Machines', sub: 'VMs and containers', icon: 'machines' },
  { view: 'system', name: 'System', sub: 'Updates and details', icon: 'system' },
];

let demo = false;

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ---------- formatting ----------
const gb = (b) => (b / 1e9 >= 100 ? Math.round(b / 1e9) : (b / 1e9).toFixed(1)) + ' GB';
const pct = (part, whole) => (whole ? Math.min(100, Math.round((part / whole) * 100)) : 0);
function ago(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} day${d > 1 ? 's' : ''} ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}
const meter = (id, value) => { $(id).style.transform = `scaleX(${value / 100})`; };

// ---------- router ----------
const VIEWS = ['home', 'apps', 'storage', 'machines', 'system'];

function route(focus) {
  const view = VIEWS.includes(location.hash.slice(2)) ? location.hash.slice(2) : 'home';
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = view === 'home' ? 'JenerOS' : `${view[0].toUpperCase()}${view.slice(1)} · JenerOS`;
  if (focus) document.querySelector(`[data-view="${view}"] h1`).focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => route(true));

// ---------- live stats ----------
function renderSystem(s) {
  const addr = s.addresses && s.addresses[0];
  const used = s.memTotalMB - s.memFreeMB;
  const diskUsed = s.diskTotalB - s.diskFreeB;
  const busy = s.cpus ? Math.min(100, Math.round((s.load1 / s.cpus) * 100)) : 0;

  $('hostPill').textContent = demo ? 'Sample data' : `${s.hostname} · ${addr || 'no network'}`;
  $('hostPill').classList.toggle('demo', demo);
  const h = new Date().getHours();
  $('greeting').textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('homeLede').textContent = demo
    ? 'These are sample numbers. Open this page from your JenerOS box to see the real ones.'
    : `Your stuff lives at home, on ${s.hostname} at ${addr || 'no address yet'}.`;

  $('statAddr').textContent = addr || 'None';
  $('statDisk').textContent = s.diskTotalB ? `${gb(diskUsed)} of ${gb(s.diskTotalB)}` : 'Unknown';
  meter('meterDisk', pct(diskUsed, s.diskTotalB));
  $('statMem').textContent = s.memTotalMB ? `${(used / 1024).toFixed(1)} of ${Math.round(s.memTotalMB / 1024)} GB` : 'Unknown';
  meter('meterMem', pct(used, s.memTotalMB));
  $('statCpu').textContent = `${busy}%`;
  meter('meterCpu', busy);
  $('statUp').textContent = ago(s.uptimeSec);

  $('storageBig').textContent = s.diskTotalB ? `${gb(s.diskFreeB)} free` : 'Unknown';
  meter('meterDisk2', pct(diskUsed, s.diskTotalB));
  $('storageNote').textContent = s.diskTotalB
    ? `${gb(diskUsed)} used of ${gb(s.diskTotalB)}. Apps, settings and logs live here.`
    : 'Apps, settings and logs live here.';
  $('machinesBig').textContent = `${s.cpus} cores · ${(s.memFreeMB / 1024).toFixed(1)} GB free`;

  const facts = [
    ['Name', s.hostname],
    ['Address', (s.addresses || []).join(', ') || 'None'],
    ['Processor', `${s.cpus} cores, ${s.arch}`],
    ['Memory', `${Math.round(s.memTotalMB / 1024)} GB`],
    ['Awake for', ago(s.uptimeSec)],
  ];
  $('facts').innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}

async function pollSystem() {
  try {
    renderSystem(await getJSON('/api/system'));
  } catch {
    if (demo) renderSystem(SAMPLE_SYSTEM);
  }
  setTimeout(pollSystem, 5000);
}

// ---------- apps ----------
function renderApps(apps) {
  const installed = apps.filter((a) => a.status !== 'not-installed');
  const tiles = [
    ...installed.map((a) => ({ href: `http://${a.id}.jener.local`, name: a.name, sub: a.status === 'running' ? 'Running' : 'Stopped', icon: a.id })),
    ...PAGE_TILES.map((t) => ({ href: `#/${t.view}`, name: t.name, sub: t.sub, icon: t.icon })),
  ];
  $('homeTiles').innerHTML = tiles.map((t) => `
    <a class="tile" href="${esc(t.href)}">${icon(t.icon)}
      <span class="tile-name">${esc(t.name)}</span><span class="tile-sub">${esc(t.sub)}</span></a>`).join('');

  $('storeList').innerHTML = apps.map((a) => `
    <li class="app">
      ${icon(a.id)}
      <span><span class="app-name">${esc(a.name)}</span><br><span class="app-by">Made by ${esc(a.upstream)}</span></span>
      <button class="pill" disabled aria-describedby="appsTitle">Coming soon</button>
      <p class="app-tag">${esc(a.tagline)}</p>
    </li>`).join('');
}

// ---------- updates (polling logic by Codex) ----------
let updateTimer, updateVersion, updateOnline = false, updateBusy = false;

function pollUpdate(delay) {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(renderUpdate, delay);
}

function setUpdate(text, availVersion) {
  $('updateText').textContent = text;
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
    // Only a box that answered before can be "restarting"; otherwise this page has no box.
    if (updateOnline) {
      updateBusy = true;
      setUpdate('Restarting into the new version. This page comes back by itself.');
    } else {
      $('osVersion').textContent = 'JenerOS';
      setUpdate('Updates show up here when you open this page from your box.');
      $('checkBtn').disabled = true;
    }
    pollUpdate(updateBusy ? 3000 : 10000);
    return;
  }
  updateOnline = true;
  $('checkBtn').disabled = false;
  if (updateVersion && u.current && updateVersion !== u.current) toast(`Updated to JenerOS ${u.current}`);
  updateVersion = u.current;
  $('osVersion').textContent = `JenerOS ${u.current}`;

  const st = u.status && u.status.state;
  const av = u.available || {};
  updateBusy = !!u.requested || st === 'installing' || st === 'rebooting';
  pollUpdate(updateBusy ? 3000 : 10000);

  if (updateBusy) {
    const v = (u.status && u.status.version) || av.version;
    setUpdate(st === 'rebooting' ? `Restarting into JenerOS ${v}…` : st === 'installing' ? `Installing JenerOS ${v}. Your box restarts by itself.` : 'Starting the update…');
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
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Check now'; }, 4000);
});

// ---------- arrow keys: move focus like a TV remote ----------
document.addEventListener('keydown', (e) => {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  const here = document.activeElement;
  if (!here || here === document.body || here.matches('input, textarea, select')) return;
  const from = here.getBoundingClientRect();
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
  const items = [...document.querySelectorAll('.bar a, .bar button:not([hidden]), .view:not([hidden]) a, .view:not([hidden]) button:not([hidden])')]
    .filter((el) => el !== here && !el.disabled && el.offsetParent !== null);
  let best, bestScore = Infinity;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - fx, dy = r.top + r.height / 2 - fy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 4) continue;
    const across = Math.abs(dx * dir[1] + dy * dir[0]);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { e.preventDefault(); best.focus(); best.scrollIntoView({ block: 'nearest' }); }
});

// ---------- start ----------
(async function init() {
  route(false);
  try {
    renderSystem(await getJSON('/api/system'));
  } catch {
    demo = true;
    renderSystem(SAMPLE_SYSTEM);
  }
  try {
    renderApps(await getJSON('/api/store'));
  } catch {
    renderApps(SAMPLE_STORE);
  }
  setTimeout(pollSystem, 5000);
  renderUpdate();
})();
