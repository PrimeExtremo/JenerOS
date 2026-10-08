// JenerOS App Store window. Plain JS, no dependencies. The catalog comes from
// jenerd's /api/store; installs, start and stop are not in jenerd yet, so the
// window says so instead of pretending.
window.JenerStore = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const use = id => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${esc(id)}"/></svg>`;
  const CATEGORIES = [
    { id: 'media', name: 'Media', icon: 'i-tv', kind: 'movie and music' },
    { id: 'photos', name: 'Photos', icon: 'i-photos', kind: 'photo' },
    { id: 'files', name: 'Files', icon: 'i-drive', kind: 'file' },
    { id: 'home', name: 'Home', icon: 'i-home', kind: 'smart home' },
    { id: 'network', name: 'Network', icon: 'i-net', kind: 'network' },
    { id: 'ai', name: 'AI', icon: 'i-store-spark', kind: 'private AI' },
    { id: 'tools', name: 'Tools', icon: 'i-system', kind: 'handy tool' },
  ];
  const POPULAR = ['photos', 'tv', 'drive', 'home', 'relay'];
  const ICONS = new Set(['photos', 'drive', 'home', 'tv', 'relay', 'apps', 'machines', 'system', 'disk']);
  const POOLS = ['files', 'media', 'photos', 'backups', 'data'];
  const SOON = 'is coming soon. Nothing was changed on your box.';
  const SAMPLE = [
    { id: 'photos', name: 'Photos', upstream: 'Immich', developer: 'Immich team', category: 'photos', icon: 'photos', version: '0.1.0', added: '2026-10-07', tagline: 'Every photo and video, backed up from every device.', requirements: { memoryMB: 4096, diskGB: 20 }, web: { port: 2283 } },
    { id: 'drive', name: 'Drive', upstream: 'Nextcloud', developer: 'Nextcloud', category: 'files', icon: 'drive', version: '0.1.0', added: '2026-10-07', tagline: 'Your files, synced to every computer and phone.', requirements: { memoryMB: 1024, diskGB: 10 }, web: { port: 80 } },
    { id: 'home', name: 'Home', upstream: 'Home Assistant', developer: 'Open Home Foundation', category: 'home', icon: 'home', version: '0.1.0', added: '2026-10-07', tagline: 'Lights, locks, cameras and automations in one place.', requirements: { memoryMB: 2048, diskGB: 8 }, web: { port: 8123 } },
    { id: 'tv', name: 'TV', upstream: 'Jellyfin', developer: 'Jellyfin team', category: 'media', icon: 'tv', version: '0.1.0', added: '2026-10-07', tagline: 'Movies and shows streamed to your TVs, phones and Fire TVs.', requirements: { memoryMB: 2048, diskGB: 5 }, web: { port: 8096 } },
    { id: 'relay', name: 'Relay', upstream: 'AdGuard Home', developer: 'AdGuard', category: 'network', icon: 'relay', version: '0.1.0', added: '2026-10-07', tagline: 'Blocks ads and trackers for every device on your network.', requirements: { memoryMB: 256, diskGB: 1 }, web: { port: 3000 } },
  ].map(a => ({ ...a, status: 'not-installed', whatsNew: 'Sample catalog entry.', description: 'Sample catalog. Open this page from your box to see the full story for each app.' }));

  // Motion helpers live in app.js; without them windows open and close instantly.
  // app.js loads after this file, so look the helpers up when they're used.
  const instant = { open: d => d.open || JenerUI.open(d), close: d => JenerUI.close(d), settled: (d, fn) => fn(), enter() {}, pill() {}, celebrate() {} };
  const motion = () => window.JenerMotion || instant;
  let opened = false;
  let win, sheet, apps = [], sample = false, loaded = false, loading;
  let view = { page: 'discover' }, back = [], query = '';
  const installs = {};
  const $ = sel => win.querySelector(sel);

  const iconFor = a => ICONS.has(a.icon) ? a.icon : ICONS.has(a.id) ? a.id : 'apps';
  const appIcon = (a, cls = '') => `<span class="icon icon-${iconFor(a)} ${cls}"><svg class="doodle" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${iconFor(a)}"/></svg></span>`;
  const installed = a => a.status === 'running' || a.status === 'stopped';
  const category = id => CATEGORIES.find(c => c.id === id);
  const size = mb => !mb ? 'Not listed' : mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
  const statusText = a => a.status === 'running' ? 'Running' : a.status === 'stopped' ? 'Stopped' : 'Not installed';
  const popular = () => [...POPULAR.map(id => apps.find(a => a.id === id)).filter(Boolean), ...apps.filter(a => !POPULAR.includes(a.id))];
  const newest = () => [...apps].sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')) || a.name.localeCompare(b.name));

  // ---------- window ----------
  function build() {
    if (win) return;
    document.body.insertAdjacentHTML('beforeend', `
<dialog class="settings-window store-window" id="storeWindow" aria-labelledby="storeTitle">
  <aside class="settings-sidebar store-sidebar">
    <div class="settings-brand"><h2 id="storeTitle">App Store</h2></div>
    <nav aria-label="App Store sections">
      <button data-store-nav="discover">${use('i-store-compass')}Discover</button>
      <button data-store-nav="search">${use('i-search')}Search</button>
      <button data-store-nav="myapps">${use('i-store-grid')}My Apps</button>
      <p class="store-nav-caption" id="storeCategories">Categories</p>
      <div class="store-nav-group" role="group" aria-labelledby="storeCategories">
        ${CATEGORIES.map(c => `<button data-store-nav="cat:${c.id}">${use(c.icon)}${c.name}</button>`).join('')}
      </div>
    </nav>
    <button class="power-button" data-store-custom>${use('i-store-code')}<span>Custom install</span></button>
  </aside>
  <div class="settings-body">
    <header class="window-header">
      <div class="store-heading"><button class="icon-button" data-store-back aria-label="Back" hidden>${use('i-store-back')}</button><h3 id="storePageTitle" tabindex="-1">Discover</h3></div>
      <button class="icon-button" data-store-close aria-label="Close App Store">${use('i-close')}</button>
    </header>
    <p class="window-feedback" id="storeNotice" role="status" hidden></p>
    <div class="settings-scroll store-scroll" id="storePage"></div>
  </div>
</dialog>
<dialog class="desktop-dialog store-sheet" id="storeCustom" aria-labelledby="storeCustomTitle" aria-describedby="storeCustomIntro">
  <form method="dialog" id="storeCustomForm" novalidate>
    <header class="window-header"><h2 id="storeCustomTitle">Custom install</h2><button type="button" class="icon-button" data-sheet-close aria-label="Close custom install">${use('i-close')}</button></header>
    <p class="muted" id="storeCustomIntro">Bring an app that isn't in the store yet. Fill in the form, or paste your own YAML.</p>
    <fieldset class="store-toggle"><legend class="sr-only">How to describe the app</legend>
      <label><input type="radio" name="storeMode" value="form" checked><span>Form</span></label>
      <label><input type="radio" name="storeMode" value="yaml"><span>YAML</span></label>
    </fieldset>
    <div class="store-form" data-mode="form">
      <p class="store-yaml-note" id="storeYamlNote" hidden>You edited the YAML by hand, so the form is paused. <button type="button" class="text-button" data-yaml-reset>Use the form again</button></p>
      <div class="store-field"><label for="customName">App name</label><input id="customName" name="name" autocomplete="off" placeholder="my-notes" required aria-describedby="customNameError"><p class="field-error" id="customNameError" hidden></p></div>
      <div class="store-field"><label for="customImage">Image</label><input id="customImage" name="image" autocomplete="off" spellcheck="false" placeholder="docker.io/library/nginx" required aria-describedby="customImageHelp customImageError"><p class="store-help" id="customImageHelp">Where the app comes from, like a container registry address.</p><p class="field-error" id="customImageError" hidden></p></div>
      <div class="store-field-row">
        <div class="store-field"><label for="customTag">Version tag</label><input id="customTag" name="tag" autocomplete="off" spellcheck="false" value="latest"></div>
        <div class="store-field"><label for="customRestart">Restart</label><select id="customRestart" name="restart"><option value="unless-stopped">Unless I stop it</option><option value="always">Always</option><option value="on-failure">Only after a crash</option><option value="no">Never</option></select></div>
      </div>
      <div class="store-field-row">
        <div class="store-field"><label for="customHostPort">Box port</label><input id="customHostPort" name="hostPort" inputmode="numeric" placeholder="8080" aria-describedby="customPortError"></div>
        <div class="store-field"><label for="customAppPort">App port</label><input id="customAppPort" name="appPort" inputmode="numeric" placeholder="80" aria-describedby="customPortError"></div>
      </div>
      <p class="field-error" id="customPortError" hidden></p>
      <div class="store-field-row">
        <div class="store-field"><label for="customPool">Shared folder</label><select id="customPool" name="pool"><option value="">None</option>${POOLS.map(p => `<option>${p}</option>`).join('')}</select></div>
        <div class="store-field"><label for="customPath">Inside the app at</label><input id="customPath" name="path" autocomplete="off" spellcheck="false" placeholder="/data"></div>
      </div>
      <div class="store-field"><label for="customEnv">Settings (one KEY=value per line)</label><textarea id="customEnv" name="env" rows="3" spellcheck="false" placeholder="TZ=Europe/London"></textarea></div>
    </div>
    <div class="store-form" data-mode="yaml" hidden>
      <div class="store-field"><label for="customYaml">YAML</label><textarea id="customYaml" rows="14" wrap="off" spellcheck="false" aria-describedby="customYamlHelp customYamlError"></textarea><p class="store-help" id="customYamlHelp">Made from the form. Edit it freely; the form stays as you left it.</p><p class="field-error" id="customYamlError" hidden></p></div>
    </div>
    <p class="window-feedback" id="storeCustomStatus" role="status" hidden></p>
    <div class="row store-sheet-actions"><button type="button" class="pill" data-sheet-close>Cancel</button><button type="submit" class="pill pill-accent">Install</button></div>
  </form>
</dialog>`);
    win = document.getElementById('storeWindow');
    sheet = document.getElementById('storeCustom');
    win.addEventListener('click', onClick);
    win.addEventListener('input', e => { if (e.target.id === 'storeSearch') { query = e.target.value; renderResults(); } });
    win.addEventListener('submit', e => e.preventDefault());
    win.addEventListener('close', () => sheet.open && JenerUI.close(sheet));
    bindSheet();
  }

  function open(page) {
    build();
    opened = win.open && !win.closing;
    document.querySelectorAll('dialog[open]').forEach(d => { if (d !== win) JenerUI.close(d); });
    motion().open(win);
    go(page ? { page } : view, false);
    load();
  }
  function close() { if (win?.open) motion().close(win); }

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const res = await fetch('/api/store', { cache: 'no-store', signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('bad catalog');
        apps = data; sample = false;
      } catch {
        if (!loaded || sample) { apps = SAMPLE; sample = true; }
      }
      loaded = true; loading = null;
      if (win.open) render(false);
    })();
    return loading;
  }

  // ---------- navigation ----------
  function go(next, remember = true) {
    if (remember && next.page === 'app') back.push(view);
    else if (next.page !== 'app') back = [];
    view = next;
    render(true);
  }
  function onClick(e) {
    const t = e.target.closest('button, a');
    if (!t || t.closest('[aria-disabled="true"]') && !t.matches('[data-store-power], [data-store-install]')) return;
    const d = t.dataset;
    if (d.storeClose !== undefined) close();
    else if (d.storeBack !== undefined) { view = back.pop() || { page: 'discover' }; render(true); }
    else if (d.storeNav) { const [page, id] = d.storeNav.split(':'); go(id ? { page, id } : { page }); }
    else if (d.storeApp) go({ page: 'app', id: d.storeApp });
    else if (d.storeInstall) install(d.storeInstall);
    else if (d.storePower) notice(`${d.storePower === 'start' ? 'Starting' : 'Stopping'} apps ${SOON}`);
    else if (d.storeCustom !== undefined) openSheet();
  }
  function notice(text) {
    const box = $('#storeNotice');
    box.textContent = text; box.hidden = !text;
  }

  // ---------- pages ----------
  function render(moveFocus) {
    const titles = { discover: 'Discover', search: 'Search', myapps: 'My Apps' };
    if (loaded && (view.page === 'app' && !apps.some(a => a.id === view.id) || view.page === 'cat' && !category(view.id))) { view = { page: 'discover' }; back = []; }
    const cat = view.page === 'cat' && category(view.id);
    const app = view.page === 'app' && apps.find(a => a.id === view.id);
    const from = view.page === 'app' ? back[back.length - 1] || { page: 'discover' } : view;
    const current = from.page === 'cat' ? `cat:${from.id}` : from.page;
    win.querySelectorAll('[data-store-nav]').forEach(b => {
      if (b.closest('nav') && b.dataset.storeNav === current) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('[data-store-back]').hidden = view.page !== 'app';
    $('#storePageTitle').textContent = app ? app.name : cat ? cat.name : titles[view.page] || 'Discover';
    notice(sample ? 'Sample catalog. Open this page from your box to see its real app list.' : '');
    const page = $('#storePage'), active = document.activeElement, scroll = page.scrollTop;
    const attr = page.contains(active) && [...active.attributes].find(x => x.name === 'id' || x.name.startsWith('data-store-'));
    const keep = attr && `[${attr.name}="${CSS.escape(attr.value)}"]`;
    page.innerHTML = !loaded && !apps.length && view.page !== 'search' ? '<p class="muted store-empty">Opening the App Store…</p>'
      : app ? appPage(app)
      : cat ? categoryPage(cat)
      : view.page === 'search' ? searchPage()
      : view.page === 'myapps' ? myAppsPage()
      : discoverPage();
    if (view.page === 'search') renderResults();
    if (!moveFocus) {
      // Background refresh: keep the reader's place and focus.
      page.scrollTop = scroll;
      const again = keep && page.querySelector(keep);
      if (again) { again.focus({ preventScroll: true }); if (again.id === 'storeSearch') again.setSelectionRange(query.length, query.length); }
      return;
    }
    page.scrollTop = 0;
    // A new page crossfades in; a just-opened window takes focus once it settles.
    motion().pill(win.querySelector('.settings-sidebar nav'));
    if (opened) motion().enter(page);
    opened = true;
    motion().settled(win, () => (view.page === 'search' ? $('#storeSearch') : $('#storePageTitle')).focus({ preventScroll: true }));
  }

  function discoverPage() {
    if (!apps.length) return '<div class="store-empty"><h4>The shelves are empty</h4><p class="muted">No apps came back from your box. Try again in a moment.</p></div>';
    const [hero] = popular();
    return `
<section class="store-hero" aria-labelledby="storeHeroTitle">
  <div class="store-hero-text"><span class="tag">Featured</span><h4 id="storeHeroTitle">${esc(hero.name)}</h4><p>${esc(hero.tagline)}</p>
    <button class="pill pill-accent" data-store-app="${esc(hero.id)}">Take a look<span class="sr-only"> at ${esc(hero.name)}</span></button></div>
  <div class="store-hero-art store-art store-art-${iconFor(hero)}" aria-hidden="true">${appIcon(hero, 'store-hero-icon')}<svg class="store-art-ghost" viewBox="0 0 24 24"><use href="#i-${iconFor(hero)}"/></svg><span class="store-art-dot"></span><span class="store-art-dot"></span></div>
</section>
<section class="store-section" aria-labelledby="storePopular"><h4 id="storePopular">Popular</h4>
  <div class="store-cards">${popular().map(card).join('')}</div></section>
<section class="store-section" aria-labelledby="storeNew"><h4 id="storeNew">New</h4>
  <ul class="store-list">${newest().slice(0, 6).map(row).join('')}</ul></section>`;
  }
  const card = a => `<button class="store-card" data-store-app="${esc(a.id)}"><span class="store-card-art store-art store-art-${iconFor(a)}" aria-hidden="true">${appIcon(a)}<svg class="store-art-ghost" viewBox="0 0 24 24"><use href="#i-${iconFor(a)}"/></svg></span><span class="store-card-text"><strong>${esc(a.name)}</strong><span>${esc(a.tagline)}</span></span></button>`;
  const row = a => `<li><button class="store-row" data-store-app="${esc(a.id)}">${appIcon(a)}<span class="store-row-text"><strong>${esc(a.name)}</strong><span>${esc(a.tagline)}</span></span><span class="store-row-meta">${installed(a) ? statusText(a) : esc(category(a.category)?.name || 'App')}</span></button></li>`;

  function categoryPage(cat) {
    const list = apps.filter(a => a.category === cat.id);
    return list.length ? `<p class="section-caption">${esc(cat.name)} apps for your box.</p><ul class="store-list">${list.map(row).join('')}</ul>`
      : `<div class="store-empty">${use(cat.icon)}<h4>Nothing here yet</h4><p class="muted">We're still picking good ${esc(cat.kind)} apps. Peek at Discover in the meantime.</p><button class="pill" data-store-nav="discover">Back to Discover</button></div>`;
  }

  function searchPage() {
    return `<form class="desktop-search store-search" role="search">${use('i-search')}<label class="sr-only" for="storeSearch">Search the App Store</label><input type="search" id="storeSearch" placeholder="Search apps, like photos or ads…" autocomplete="off" value="${esc(query)}"></form>
<p class="sr-only" id="storeResultCount" role="status"></p><ul class="store-list" id="storeResults"></ul>`;
  }
  function renderResults() {
    const q = query.trim().toLocaleLowerCase();
    const found = !q ? apps : apps.filter(a => [a.name, a.tagline, a.upstream, a.developer, category(a.category)?.name].some(v => String(v || '').toLocaleLowerCase().includes(q)));
    $('#storeResults').innerHTML = !loaded ? '<li class="store-empty"><p class="muted">Loading apps…</p></li>' : found.length ? found.map(row).join('') : `<li class="store-empty"><p class="muted">No apps match “${esc(query.trim())}”. Try a shorter word.</p></li>`;
    $('#storeResultCount').textContent = q ? `${found.length} ${found.length === 1 ? 'app' : 'apps'} found` : '';
  }

  function installButton(a) {
    const st = installs[a.id] || {};
    const busy = st.state === 'busy' || st.state === 'installing';
    const label = installed(a) ? 'Installed' : st.state === 'installing' ? 'Installing…' : busy ? 'Asking your box…' : st.state === 'soon' ? 'Coming soon' : 'Install';
    const off = installed(a) || busy || st.state === 'soon';
    return `<div class="store-install">
  <button class="pill pill-accent store-install-button${busy ? ' busy' : ''}" data-store-install="${esc(a.id)}" aria-describedby="storeInstallNote"${off ? ' aria-disabled="true"' : ''}${busy ? ' aria-busy="true"' : ''}>
    <svg class="store-ring" viewBox="0 0 36 36" aria-hidden="true"><g transform="rotate(-90 18 18)"><circle class="store-ring-track" cx="18" cy="18" r="14"/>${installed(a) || st.progress ? `<circle class="store-ring-fill" cx="18" cy="18" r="14" style="--progress:${installed(a) ? 100 : st.progress}"/>` : ''}</g>${installed(a) ? '<path class="store-ring-check" d="M12.5 18.5l3.5 3.5 7.5-8" pathLength="1"/>' : ''}</svg>
    <span>${label}<span class="sr-only"> ${esc(a.name)}</span></span></button>
  <p class="store-help" id="storeInstallNote">${esc(st.message || (installed(a) ? `${a.name} is ${statusText(a).toLowerCase()}.` : `Needs about ${size(a.requirements?.memoryMB)} of memory.`))}</p></div>`;
  }
  async function install(id) {
    const a = apps.find(x => x.id === id);
    if (!a || installed(a) || ['busy', 'installing', 'soon'].includes(installs[id]?.state)) return;
    if (sample) { installs[id] = { state: 'soon', message: 'This is a sample catalog. Open this page from your box to install apps.' }; return rerenderInstall(a); }
    installs[id] = { state: 'busy' }; rerenderInstall(a);
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(id)}/install`, { method: 'POST', headers: { 'X-JenerOS': '1' }, signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
      if (res.status === 501) installs[id] = { state: 'soon', message: `Installing apps ${SOON}` };
      else if (res.ok) { installs[id] = { state: 'installing', message: `${a.name} is installing. This can take a few minutes.` }; watch(id); }
      else { const data = await res.json().catch(() => ({})); installs[id] = { state: 'error', message: data.error ? `Your box said: ${data.error}` : 'Your box could not start the install. Please try again.' }; }
    } catch { installs[id] = { state: 'error', message: 'Could not reach your box. Please try again.' }; }
    rerenderInstall(a);
  }
  // Follows a real install once jenerd supports it: the store status flips.
  async function watch(id) {
    await new Promise(done => setTimeout(done, 3000));
    if (!win.open) return;
    await load();
    const a = apps.find(x => x.id === id);
    if (a && installed(a)) { delete installs[id]; rerenderInstall(a, true); } else if (a) watch(id);
  }
  function rerenderInstall(a, celebrate = false) {
    const box = view.page === 'app' && view.id === a.id && $('.store-install');
    if (!box) return;
    const hadFocus = box.contains(document.activeElement);
    box.outerHTML = installButton(a);
    if (hadFocus) $('.store-install-button').focus();
    // The joy moment: the ring becomes a check that pops, plus one small burst.
    if (celebrate) { $('.store-install-button').classList.add('pop'); motion().celebrate($('.store-install-button')); }
  }

  function appPage(a) {
    const cat = category(a.category);
    const shots = Array.isArray(a.screenshots) ? a.screenshots : [];
    const chips = [['Category', cat?.name || 'App'], ['Developer', a.developer || a.upstream || 'Not listed'], ['Min memory', size(a.requirements?.memoryMB)], ['Disk use', a.requirements?.diskGB ? `${a.requirements.diskGB} GB` : 'Not listed']];
    return `
<section class="store-app-head">${appIcon(a, 'store-app-icon')}
  <div class="store-app-title"><h4>${esc(a.name)}</h4><p>${esc(a.tagline)}</p>${a.upstream ? `<p class="store-help">Built on ${esc(a.upstream)}</p>` : ''}</div>
  ${installButton(a)}
</section>
<dl class="store-chips">${chips.map(([k, v]) => `<div class="store-chip"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
<section class="store-section" aria-labelledby="storeShots"><h4 id="storeShots">Screenshots</h4>
  ${shots.length ? `<div class="store-shots" tabindex="0" role="group" aria-label="${esc(a.name)} screenshots, scroll sideways">${shots.map((_, i) => `<img src="/api/store/${encodeURIComponent(a.id)}/screenshots/${i}" alt="${esc(a.name)} screenshot ${i + 1} of ${shots.length}" loading="lazy">`).join('')}</div>`
    : `<div class="store-shots-empty store-art store-art-${iconFor(a)}">${appIcon(a)}<p>Screenshots are on their way. Until then, here's the gist: ${esc(a.tagline)}</p></div>`}</section>
<section class="store-section store-text" aria-labelledby="storeWhatsNew"><h4 id="storeWhatsNew">What's new</h4><p class="store-help">Version ${esc(a.version || '—')}</p><p>${esc(a.whatsNew || 'No notes for this version yet.')}</p></section>
<section class="store-section store-text" aria-labelledby="storeAbout"><h4 id="storeAbout">About</h4>${String(a.description || a.tagline).split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}
  ${a.web?.port ? `<p class="store-help">Opens on port ${esc(a.web.port)} inside your box.</p>` : ''}</section>`;
  }

  function myAppsPage() {
    const mine = apps.filter(installed);
    const dash = '<span aria-hidden="true">—</span><span class="sr-only">Not measured yet</span>';
    const rows = mine.map(a => `<tr><th scope="row"><span class="store-cell-app">${appIcon(a)}${esc(a.name)}</span></th>
  <td data-label="Status"><span class="store-status store-status-${a.status === 'running' ? 'on' : 'off'}">${statusText(a)}</span></td>
  <td data-label="Port">${esc(a.web?.port || '—')}</td><td data-label="Uptime">${dash}</td><td data-label="Memory">${dash}</td><td data-label="CPU">${dash}</td>
  <td data-label="Actions"><button class="pill" data-store-power="${a.status === 'running' ? 'stop' : 'start'}" aria-disabled="true">${a.status === 'running' ? 'Stop' : 'Start'}<span class="sr-only"> ${esc(a.name)}, coming soon</span></button></td></tr>`).join('');
    return `<p class="section-caption">Apps on this box. Live memory, CPU and start/stop controls arrive with app management.</p>
<div class="store-table-wrap"><table class="store-table"><caption class="sr-only">Installed apps</caption>
<thead><tr><th scope="col">App</th><th scope="col">Status</th><th scope="col">Port</th><th scope="col">Uptime</th><th scope="col">Memory</th><th scope="col">CPU</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
<tbody>${rows || `<tr class="store-table-empty"><td colspan="7"><strong>No apps yet</strong><p class="muted">Apps you install show up here with their status and port.</p><button class="pill" data-store-nav="discover">Find an app</button></td></tr>`}</tbody></table></div>`;
  }

  // ---------- custom install ----------
  let yamlEdited = false;
  const field = id => document.getElementById(id);
  function mode() { return sheet.querySelector('[name="storeMode"]:checked').value; }
  function setMode(next) {
    if (next === 'yaml' && !yamlEdited) field('customYaml').value = toYaml();
    sheet.querySelectorAll('.store-form').forEach(f => { f.hidden = f.dataset.mode !== next; });
    field('storeYamlNote').hidden = !(next === 'form' && yamlEdited);
    sheet.querySelectorAll('.store-form[data-mode="form"] :is(input, select, textarea)').forEach(el => { el.disabled = yamlEdited; });
  }
  function toYaml() {
    const v = Object.fromEntries(new FormData(field('storeCustomForm')));
    const q = s => JSON.stringify(String(s));
    const slug = String(v.name || 'my-app').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-app';
    const lines = [`name: ${slug}`, 'services:', '  app:', `    image: ${q(`${String(v.image || '').trim() || 'registry/image'}:${String(v.tag || '').trim() || 'latest'}`)}`, `    restart: ${v.restart || 'unless-stopped'}`];
    if (v.hostPort || v.appPort) lines.push('    ports:', `      - ${q(`${String(v.hostPort).trim() || v.appPort}:${String(v.appPort).trim() || v.hostPort}`)}`);
    if (v.pool) lines.push('    volumes:', `      - ${q(`${v.pool}:${String(v.path || '').trim() || '/data'}`)}`);
    const env = String(v.env || '').split('\n').map(l => l.trim()).filter(l => l.includes('='));
    if (env.length) lines.push('    environment:', ...env.map(l => `      ${l.slice(0, l.indexOf('=')).trim()}: ${q(l.slice(l.indexOf('=') + 1).trim())}`));
    return lines.join('\n') + '\n';
  }
  function fieldError(id, message, input) {
    field(id).textContent = message; field(id).hidden = !message;
    (Array.isArray(input) ? input : [input]).forEach(el => el && el.setAttribute('aria-invalid', String(!!message)));
    return !message;
  }
  function validate() {
    if (mode() === 'yaml' || yamlEdited) {
      if (mode() !== 'yaml') { sheet.querySelector('[name="storeMode"][value="yaml"]').checked = true; setMode('yaml'); }
      const y = field('customYaml').value;
      return fieldError('customYamlError', !/^\s*services\s*:/m.test(y) ? 'Add a services: section so your box knows what to run.' : '', field('customYaml')) ? null : field('customYaml');
    }
    const port = v => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 65535);
    const host = field('customHostPort').value.trim(), app = field('customAppPort').value.trim();
    const results = [
      fieldError('customNameError', field('customName').value.trim() ? '' : 'Give the app a name.', field('customName')) || field('customName'),
      fieldError('customImageError', /^[\w.\-/:@]+$/.test(field('customImage').value.trim()) ? '' : 'Add the image address, like docker.io/library/nginx.', field('customImage')) || field('customImage'),
      fieldError('customPortError', port(host) && port(app) ? '' : 'Ports are numbers from 1 to 65535.', [field('customHostPort'), field('customAppPort')]) || (port(host) ? field('customAppPort') : field('customHostPort')),
    ];
    return results.find(r => r !== true) || null;
  }
  function openSheet() {
    field('storeCustomStatus').hidden = true;
    motion().open(sheet);
    motion().settled(sheet, () => sheet.querySelector('[name="storeMode"]:checked').focus());
  }
  function bindSheet() {
    sheet.querySelectorAll('[name="storeMode"]').forEach(r => r.addEventListener('change', () => setMode(r.value)));
    field('customYaml').addEventListener('input', () => { yamlEdited = true; });
    sheet.addEventListener('click', e => {
      if (e.target.closest('[data-sheet-close]')) motion().close(sheet);
      if (e.target.closest('[data-yaml-reset]')) { yamlEdited = false; setMode('form'); field('customName').focus(); }
    });
    field('storeCustomForm').addEventListener('submit', e => {
      e.preventDefault();
      const bad = validate();
      const status = field('storeCustomStatus');
      if (bad) { status.hidden = true; bad.focus(); return; }
      status.textContent = `Custom installs are coming soon. Nothing was changed on your box. Your ${mode() === 'yaml' ? 'YAML stays' : 'answers stay'} here until you leave this page.`;
      status.hidden = false;
    });
  }

  return { open, close };
})();
