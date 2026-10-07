// JenerOS dashboard. Talks to jenerd; falls back to sample data when offline.

const ICONS = {
  photos: '<path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM4 12a4 4 0 0 1 4-4h1a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4zm8 9a4 4 0 0 1-4-4v-1a4 4 0 0 1 8 0v1a4 4 0 0 1-4 4zm8-9a4 4 0 0 1-4 4h-1a4 4 0 0 1 0-8h1a4 4 0 0 1 4 4z" fill="currentColor" opacity=".9"/>',
  drive: '<path d="M7 18a5 5 0 0 1-.6-9.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z" fill="currentColor"/>',
  home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="currentColor"/>',
  tv: '<rect x="2" y="5" width="20" height="13" rx="2" fill="currentColor"/><path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  relay: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="currentColor"/>',
  machines: '<rect x="3" y="3" width="18" height="7" rx="2" fill="currentColor"/><rect x="3" y="14" width="18" height="7" rx="2" fill="currentColor" opacity=".7"/>',
  storage: '<ellipse cx="12" cy="6" rx="8" ry="3" fill="currentColor"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0 1.7-3.6 3-8 3S4 7.7 4 6z" fill="currentColor" opacity=".75"/>',
  store: '<path d="M5 8h14l-1 12H6L5 8zm4 0V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
};

const COLORS = {
  photos: 'linear-gradient(135deg,#ff9f0a,#ff375f)',
  drive: 'linear-gradient(135deg,#64d2ff,#0a84ff)',
  home: 'linear-gradient(135deg,#ffd60a,#ff9f0a)',
  tv: 'linear-gradient(135deg,#3a3a3c,#1c1c1e)',
  relay: 'linear-gradient(135deg,#30d158,#00a86b)',
  machines: 'linear-gradient(135deg,#5e5ce6,#bf5af2)',
  storage: 'linear-gradient(135deg,#8e8e93,#48484a)',
  store: 'linear-gradient(135deg,#0a84ff,#5e5ce6)',
};

// Built-in system tiles; store apps are added after them.
const SYSTEM_TILES = [
  { id: 'machines', name: 'Machines', state: 'VMs & containers' },
  { id: 'storage', name: 'Storage', state: 'Pools & shares' },
  { id: 'store', name: 'Store', state: 'Get apps', href: '#store' },
];

const SAMPLE_SYSTEM = { hostname: 'jener-demo', os: 'linux', arch: 'amd64', cpus: 8, memTotalMB: 16384, memFreeMB: 9830, uptimeSec: 352800 };
const SAMPLE_STORE = [
  { id: 'photos', name: 'Photos', upstream: 'Immich', tagline: 'Every photo and video, backed up from every device.', status: 'running' },
  { id: 'drive', name: 'Drive', upstream: 'Nextcloud', tagline: 'Your files, synced to every computer and phone.', status: 'running' },
  { id: 'home', name: 'Home', upstream: 'Home Assistant', tagline: 'Lights, locks, cameras and automations in one place.', status: 'running' },
  { id: 'tv', name: 'TV', upstream: 'Jellyfin', tagline: 'Movies and shows streamed to your TVs, phones and Fire TVs.', status: 'not-installed' },
  { id: 'relay', name: 'Relay', upstream: 'AdGuard Home', tagline: 'Blocks ads and trackers for every device on your network.', status: 'not-installed' },
];

const $ = (id) => document.getElementById(id);
const icon = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ICONS.store}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function fmtUptime(sec) {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((sec % 3600) / 60)}m`;
}

function renderSystem(sys) {
  $('host').textContent = `${sys.hostname} · ${sys.arch}`;
  $('greeting').textContent = greeting();
  const used = sys.memTotalMB ? sys.memTotalMB - sys.memFreeMB : 0;
  const pct = sys.memTotalMB ? Math.round((used / sys.memTotalMB) * 100) : 0;
  const stats = [
    { label: 'Memory', value: sys.memTotalMB ? `${(used / 1024).toFixed(1)} / ${(sys.memTotalMB / 1024).toFixed(0)} GB` : '—', pct },
    { label: 'Processors', value: `${sys.cpus} cores` },
    { label: 'Uptime', value: fmtUptime(sys.uptimeSec) },
    { label: 'Platform', value: `${sys.os} · ${sys.arch}` },
  ];
  $('stats').innerHTML = stats.map((s) => `
    <div class="stat">
      <div class="label">${esc(s.label)}</div>
      <div class="value">${esc(s.value)}</div>
      ${s.pct != null ? `<div class="bar"><i style="width:${s.pct}%"></i></div>` : ''}
    </div>`).join('');
}

function renderApps(apps) {
  const installed = apps.filter((a) => a.status !== 'not-installed')
    .map((a) => ({ id: a.id, name: a.name, state: a.status === 'running' ? 'Running' : 'Stopped' }));
  $('tiles').innerHTML = [...installed, ...SYSTEM_TILES].map((t) => `
    <a class="tile" href="${t.href || '#'}" data-id="${esc(t.id)}">
      <div class="icon" style="background:${COLORS[t.id] || COLORS.store}">${icon(t.id)}</div>
      <div class="name">${esc(t.name)}</div>
      <div class="state">${esc(t.state)}</div>
    </a>`).join('');

  $('storeList').innerHTML = apps.map((a) => `
    <div class="card">
      <div class="icon" style="background:${COLORS[a.id] || COLORS.store}">${icon(a.id)}</div>
      <div class="meta">
        <div class="title">${esc(a.name)}</div>
        <div class="by">${a.upstream ? `powered by ${esc(a.upstream)}` : 'JenerOS'}</div>
        <div class="tag">${esc(a.tagline)}</div>
      </div>
      <button class="btn" data-install="${esc(a.id)}">${a.status === 'not-installed' ? 'Get' : 'Open'}</button>
    </div>`).join('');
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-install]');
  if (!btn) return;
  const id = btn.dataset.install;
  if (btn.textContent !== 'Get') return toast(`Opening ${id}.jener.local…`);
  try {
    const res = await fetch(`/api/apps/${id}/install`, { method: 'POST' });
    if (res.status === 501) return toast('Installing arrives in Phase 2 — the runtime is next.');
    if (!res.ok) throw new Error(res.status);
    toast(`Installing ${id}…`);
  } catch {
    toast('Demo mode — start jenerd to install apps.');
  }
});

// System card: installed version + update status from /api/update.
const UPDATE_TEXT = {
  installing: (v) => `Installing JenerOS ${v}… the system will restart by itself.`,
  rebooting: (v) => `Restarting into JenerOS ${v}…`,
  failed: (v) => `Update to ${v} failed. You're still on the working version.`,
  uptodate: () => 'Up to date.',
};

async function renderUpdate() {
  let u;
  try {
    u = await getJSON('/api/update');
  } catch {
    $('osVersion').textContent = 'JenerOS (demo)';
    $('updateText').textContent = 'Updates show here on a real JenerOS machine.';
    return;
  }
  $('osVersion').textContent = `JenerOS ${u.current}`;
  const btn = $('updateBtn');
  const st = u.status && u.status.state;
  const avail = u.available && u.available.version;
  if (u.requested || st === 'installing' || st === 'rebooting') {
    $('updateText').textContent = (UPDATE_TEXT[st] || (() => 'Starting update…'))(u.status ? u.status.version : avail);
    btn.hidden = true;
    setTimeout(renderUpdate, 3000);
    return;
  }
  if (avail) {
    $('updateText').textContent = `JenerOS ${avail} is ready to install.`;
    btn.hidden = false;
  } else {
    $('updateText').textContent = st === 'failed' ? UPDATE_TEXT.failed(u.status.version) : 'Up to date.';
    btn.hidden = true;
  }
}

$('updateBtn').addEventListener('click', async () => {
  $('updateBtn').hidden = true;
  $('updateText').textContent = 'Starting update…';
  try {
    const res = await fetch('/api/update', { method: 'POST' });
    if (!res.ok) throw new Error(res.status);
  } catch {
    toast('Could not start the update.');
  }
  setTimeout(renderUpdate, 1500);
});

(async function init() {
  renderUpdate();
  try {
    const [sys, apps] = await Promise.all([getJSON('/api/system'), getJSON('/api/store')]);
    renderSystem(sys);
    renderApps(apps);
  } catch {
    $('demo').hidden = false;
    renderSystem(SAMPLE_SYSTEM);
    renderApps(SAMPLE_STORE);
  }
})();
