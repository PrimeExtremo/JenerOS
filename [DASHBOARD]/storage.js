// Storage has no simulated creation path. Only the owner API can create a pool.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const size = bytes => bytes ? `${+(bytes / 1e9).toFixed(1)} GB` : '0 GB';
  const profiles = {
    raid1: { title: 'Safe', label: 'Mirror', min: 2, speed: 2, capacity: 'Up to 50%', best: 'Photos & everyday files' },
    raid10: { title: 'Fast and safe', label: 'Stripe + mirror', min: 4, speed: 4, capacity: 'About 50%', best: 'Busy boxes & big projects' },
    single: { title: 'One disk', label: 'Single', min: 1, speed: 2, capacity: 'Up to 100%', best: 'An extra place for files' },
  };
  const win = $('storageWindow');
  const timeout = ms => typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
  let info = null, step = 'choice', profile = 'raid1', selected = new Map(), name = 'my-storage';
  let erase = false, sending = false, loading = null, timer = null, job = null, uncertain = false, previousJob = '';
  const motion = () => window.JenerMotion || { open: JenerUI.open, close: JenerUI.close, settled: (_d, fn) => fn() };
  const busy = () => sending || uncertain || !!(info && (info.requested || ['working', 'queued'].includes(info.status?.state)));
  const eligible = () => (info?.disks || []).filter(d => d.eligible);
  const chosen = () => eligible().filter(d => selected.get(d.path) === d.identity);
  const validCount = () => profile === 'single' ? chosen().length === 1 : chosen().length >= profiles[profile].min && chosen().length <= 32;
  function estimate(disks) {
    const sizes = disks.map(d => d.size), total = sizes.reduce((a, b) => a + b, 0);
    const usable = !sizes.length ? 0 : profile === 'single' ? total : profile === 'raid1' ? Math.min(total / 2, total - Math.max(...sizes)) : Math.min(...sizes) * Math.floor(sizes.length / 2);
    const protection = profile === 'single' ? 0 : usable;
    return { total, usable, protection, unused: total - usable - protection };
  }
  const diskReason = d => d.system ? 'System disk' : /partition|data|filesystem/i.test(d.reason || '') ? 'Has data on it' : d.reason;
  const diskArt = () => '<svg class="storage-disk-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-disk"/></svg>';
  function overview() {
    if (!info) return;
    const disks = info.disks || [], pools = info.pools || [];
    const slots = Math.max(4, Math.ceil((disks.length + 1) / 2) * 2);
    $('storageOverview').innerHTML = `<article class="settings-card storage-bays-card"><div><h4>Bays</h4><p class="muted">${disks.length} disk${disks.length === 1 ? '' : 's'} detected</p></div><ul class="storage-bays" aria-label="Detected disks and empty slots">${Array.from({ length: slots }, (_, i) => {
      const d = disks[i];
      return `<li class="storage-bay ${d ? 'occupied' : ''}">${d ? diskArt() : '<span class="empty-bay" aria-hidden="true"></span>'}<strong>${d ? esc(d.path.replace('/dev/', '')) : 'Empty'}</strong><small>${d ? d.system ? 'System' : size(d.size) : 'Slot'}</small></li>`;
    }).join('')}</ul><p class="sr-only">Connected disks are shown, not their physical position. Empty slots illustrate room to grow.</p></article>
    ${pools.length ? pools.map(p => {
      const used = Math.max(0, p.total - p.free), percent = p.total ? Math.min(100, used / p.total * 100) : 0;
      return `<article class="settings-card storage-pool"><div class="setting-row"><h4>${esc(p.name)}</h4><span>${p.mounted ? size(p.free) + ' free' : 'Needs attention'}</span></div><span class="meter meter-wide" role="meter" aria-label="${esc(p.name)} space used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><i style="width:${percent}%"></i></span><p class="setting-help">${p.mounted ? `${size(used)} used of ${size(p.total)}` : 'This storage is not connected. Its files have not been changed.'}</p></article>`;
    }).join('') : '<article class="settings-card storage-pool"><div class="setting-row"><h4>Your storage</h4><span>No pools yet</span></div><span class="meter meter-wide"><i style="width:0%"></i></span><p class="setting-help">Create storage below to make room for your files.</p></article>'}
    ${info.status?.state ? `<article class="settings-card"><div class="setting-row"><div><h4>${esc(info.status.name || 'Storage')}</h4><p class="setting-help">${esc(info.status.message)}</p></div><button class="pill" data-storage-resume>View progress</button></div></article>` : ''}`;
    $('storageDevices').textContent = disks.filter(d => d.system).map(d => `${d.model || 'System'} · ${d.path} · ${size(d.size)}`).join(' / ') || 'The system disk could not be identified. Creation stays off until disk checks pass.';
    $('createStorage').disabled = !info.available || busy();
    $('storageAvailability').textContent = !info.available ? 'Open Storage on your JenerOS box after setup to create a pool.' : busy() ? 'Storage is being created. You can keep using your box.' : `${eligible().length} empty disk${eligible().length === 1 ? '' : 's'} ready. Disks with data stay out of the selection.`;
  }
  function schedule() {
    clearTimeout(timer);
    if (busy() || (job && !['done', 'failed'].includes(job.state))) timer = setTimeout(load, 2500);
  }
  async function load() {
    if (!window.JenerSession) {
      if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', load, { once: true }); return; }
      return;
    }
    if (loading) return loading;
    loading = (async () => {
      try {
        const res = await JenerSession.fetch('/api/storage', { cache: 'no-store', signal: timeout(10000) });
        if (!res.ok) throw Error('Could not check your disks. Refresh to try again.');
        const fresh = await res.json();
        if (!Array.isArray(fresh.disks) || !Array.isArray(fresh.pools)) throw Error('Storage is not available on this box yet.');
        info = fresh;
        // A newer accepted job must not be replaced by an older terminal status.
        if ((!job || info.status?.id === job.id || (uncertain && info.status?.id !== previousJob)) && info.status?.state && (!uncertain || info.status.id !== previousJob)) { job = info.status; uncertain = false; }
        overview();
        if (step === 'progress' && win.open) progress();
        if (['disks', 'compare'].includes(step) && win.open) render();
        if (step === 'summary' && win.open && selected.size !== chosen().length) {
          erase = false; $('storageErase').checked = false; updateSummary();
          error('A selected disk changed. Go back and check your disks before continuing.');
        }
      } catch (error) {
        $('storageAvailability').textContent = error.message;
        $('createStorage').disabled = true;
        if (step === 'progress' && win.open) $('storageProgressMessage').textContent = 'Connection lost. Your box keeps working. Checking again…';
      } finally { loading = null; schedule(); }
    })();
    return loading;
  }
  function open(resume = false) {
    if (sending) return;
    if (resume || busy()) { step = 'progress'; job = info?.status?.state ? info.status : job; }
    else { step = 'choice'; selected = new Map(); name = 'my-storage'; erase = false; profile = 'raid1'; job = null; }
    render(); motion().open(win);
    motion().settled(win, () => $('storageTitle').focus({ preventScroll: true }));
  }
  function error(message) { $('storageError').textContent = message; $('storageError').hidden = !message; }
  function render() {
    error('');
    const content = $('storageContent'), titles = { choice: 'Create storage', compare: 'Find your fit', disks: 'Choose your disks', summary: 'One last check', progress: 'Creating storage' };
    $('storageTitle').textContent = titles[step];
    $('storageStep').textContent = step === 'progress' ? 'YOUR STORAGE' : `STEP ${['choice', 'compare', 'disks', 'summary'].indexOf(step) + 1} OF 4`;
    $('storageBack').hidden = step === 'choice' || step === 'progress';
    $('storageNext').hidden = step === 'choice';
    $('storageNext').disabled = false;
    $('storageNext').textContent = step === 'summary' ? 'Erase disks & create' : step === 'progress' ? 'Keep going in the background' : 'Next';
    if (step === 'choice') {
      content.innerHTML = `<div class="storage-choices"><button class="storage-choice" data-storage-choice="raid1"><h3>Combine</h3><p>Bring several disks together. Keep an extra copy of your files across your disks.</p><span class="storage-choice-arrow" aria-hidden="true">→</span><span class="storage-choice-art" aria-hidden="true">${diskArt().repeat(4)}</span></button><button class="storage-choice" data-storage-choice="single"><h3>Use one disk</h3><p>Give one empty disk a fresh start. Simple extra space, without a second copy.</p><span class="storage-choice-arrow" aria-hidden="true">→</span><span class="storage-choice-art" aria-hidden="true">${diskArt()}</span></button></div>`;
    } else if (step === 'compare') {
      content.innerHTML = `<p class="muted">Choose what matters most to you.</p><div class="storage-table-scroll" tabindex="0" role="region" aria-label="Storage layout comparison, scroll for more columns"><table class="storage-table"><caption class="sr-only">Storage layouts</caption><thead><tr><th scope="col">Layout</th><th scope="col">Spare disks</th><th scope="col">Min disks</th><th scope="col">Speed</th><th scope="col">Usable</th><th scope="col">Can grow</th><th scope="col">Best for</th></tr></thead><tbody>${Object.entries(profiles).map(([id, p]) => `<tr class="${eligible().length < p.min ? 'unavailable' : ''}"><th scope="row"><label><input type="radio" name="storageProfile" value="${id}" ${eligible().length < p.min ? 'disabled' : ''} ${id === profile ? 'checked' : ''}><span><strong>${p.title}</strong><small>${eligible().length < p.min ? `Needs ${p.min} disk${p.min === 1 ? '' : 's'}` : p.label}</small></span></label></th><td>0 dedicated<small>${id === 'single' ? 'No protection' : '1 disk can fail'}</small></td><td>${p.min}${id === 'single' ? '' : '+'}</td><td><span class="storage-speed" role="img" aria-label="${id === 'raid10' ? 'Higher potential speed' : 'Everyday speed'}">${[1, 2, 3, 4].map(n => `<i class="${n <= p.speed ? 'filled' : ''}"></i>`).join('')}</span></td><td>${p.capacity}</td><td>Yes<small>Tools coming later</small></td><td>${p.best}</td></tr>`).join('')}<tr class="storage-later"><th scope="row">RAID5 / RAID6<small>Coming later</small></th><td colspan="6">Not available. These Btrfs layouts do not meet our safety bar.</td></tr></tbody></table></div><p class="setting-help">Protection uses space across your disks, not a dedicated spare. It helps with one disk failing; keep a separate backup too. Speed depends on your disks and workload. Growing a pool is not available in this wizard yet.</p>`;
      $('storageNext').disabled = eligible().length < profiles[profile].min;
    } else if (step === 'disks') {
      content.innerHTML = `<div class="storage-pick-heading"><div><h3>${profiles[profile].title}</h3><p class="muted">Choose ${profile === 'single' ? 'one empty disk' : profiles[profile].min + ' or more empty disks'}.</p></div><button class="pill" data-storage-recommend>Use recommended</button></div><fieldset class="storage-disk-list"><legend class="sr-only">Choose disks to erase</legend>${(info?.disks || []).map(d => `<label class="storage-disk ${!d.eligible ? 'unavailable' : ''}"><input type="${profile === 'single' ? 'radio' : 'checkbox'}" name="storageDisk" value="${esc(d.path)}" ${!d.eligible ? 'disabled' : ''} ${selected.has(d.path) ? 'checked' : ''}>${diskArt()}<span><strong>${esc(d.model || 'Disk')}</strong><small>${esc(d.path)} · ${d.rotational ? 'Hard disk' : 'Solid state'}${d.transport ? ' · ' + esc(d.transport) : ''}${d.serial ? ' · ' + esc(d.serial) : ''}</small><small>${d.eligible ? 'Empty · ready to use' : esc(diskReason(d))}</small></span><strong>${size(d.size)}</strong></label>`).join('') || '<p>No disks found. Connect an empty disk, then refresh Storage.</p>'}</fieldset><div id="storageEstimate" aria-live="polite"></div>`;
      $('storageContent').querySelector('[data-storage-recommend]').disabled = eligible().length < profiles[profile].min;
      updateEstimate();
    } else if (step === 'summary') {
      const cap = estimate(chosen());
      content.innerHTML = `<div class="storage-summary-card"><strong>${profiles[profile].title}</strong><span>${size(cap.usable)} estimated usable</span><span>Btrfs · ${chosen().length} disk${chosen().length === 1 ? '' : 's'}</span></div><label class="storage-name" for="storageName">Storage name<input id="storageName" value="${esc(name)}" maxlength="32" pattern="[a-z][a-z0-9-]{0,31}" required autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="storageNameHelp"></label><p id="storageNameHelp" class="setting-help">Start with a letter. Use lowercase letters, numbers and dashes (up to 32).</p><section class="storage-warning"><h3>A fresh start erases these disks</h3><p>Everything on the disks below will be erased. Keep your box on and leave the disks connected until this finishes.</p><ul>${chosen().map(d => `<li><strong>${esc(d.path)}</strong> · ${esc(d.model)} · ${size(d.size)}${d.serial ? ' · ' + esc(d.serial) : ''}</li>`).join('')}</ul><label class="storage-consent"><input id="storageErase" type="checkbox" ${erase ? 'checked' : ''}><span>I understand this erases these disks</span></label></section>`;
      updateSummary();
    } else {
      content.innerHTML = `<div class="storage-progress-art" aria-hidden="true">${diskArt().repeat(3)}</div><h3 id="storageProgressHeading"></h3><p id="storageProgressMessage" role="status" aria-live="polite"></p><progress id="storageProgress" max="100" aria-label="Storage creation"></progress><p class="setting-help">Keep your box on and your disks connected. Closing this window does not cancel creation.</p><button class="pill" data-storage-check>Check status now</button>`;
      progress();
    }
    if (win.open) $('storageTitle').focus({ preventScroll: true });
  }
  function updateEstimate() {
    const cap = estimate(chosen());
    $('storageEstimate').innerHTML = `<div class="storage-capacity"><strong>${size(cap.usable)} usable</strong><span>${chosen().length} selected</span></div><div class="storage-capacity-bar" aria-hidden="true"><i style="width:${cap.total ? cap.usable / cap.total * 100 : 0}%"></i><i style="width:${cap.total ? cap.protection / cap.total * 100 : 0}%"></i></div><p class="setting-help">${size(cap.usable)} for files · ${size(cap.protection)} for protection${cap.unused ? ' · ' + size(cap.unused) + ' left over' : ''}</p><p class="setting-help">Estimate before formatting and filesystem overhead. Different disk sizes can leave space unused.</p>`;
    $('storageNext').disabled = !validCount();
  }
  function updateSummary() { $('storageNext').disabled = sending || !erase || !/^[a-z][a-z0-9-]{0,31}$/.test(name) || !validCount(); }
  function progress() {
    const status = job || info?.status || {}, terminal = ['done', 'failed'].includes(status.state);
    $('storageProgressHeading').textContent = status.state === 'done' ? 'Room for what comes next.' : status.state === 'failed' ? 'Let’s check those disks.' : 'Making room for you…';
    $('storageProgressMessage').textContent = uncertain ? 'We could not confirm the request. Checking your box before any further action…' : status.message || 'Waiting for your box…';
    const bar = $('storageProgress');
    if (status.state === 'queued' || uncertain) bar.removeAttribute('value'); else bar.value = status.percent || 0;
    $('storageNext').textContent = terminal ? 'Back to Storage' : 'Keep going in the background';
  }
  async function create() {
    if (sending || !info?.available || !erase || !validCount() || !/^[a-z][a-z0-9-]{0,31}$/.test(name)) return;
    sending = true; updateSummary(); error('');
    previousJob = info.status?.id || '';
    const req = { name, profile, disks: chosen().map(d => d.path), identities: Object.fromEntries(chosen().map(d => [d.path, d.identity])), erase };
    try {
      const res = await JenerSession.fetch('/api/storage/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-JenerOS': '1' }, body: JSON.stringify(req), signal: timeout(15000) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Could not create storage. Refresh your disks and try again.');
        erase = false; $('storageErase').checked = false;
        // Invalidate the selection on the next entry into disk selection.
        await load();
        return;
      }
      job = await res.json(); step = 'progress'; render();
    } catch {
      uncertain = true; step = 'progress'; render();
    } finally { sending = false; if (step === 'summary') updateSummary(); overview(); schedule(); }
  }
  function close() { if (!sending) motion().close(win); }
  $('createStorage').addEventListener('click', () => open());
  $('refreshStorage').addEventListener('click', load);
  $('closeStorage').addEventListener('click', close);
  win.addEventListener('cancel', event => { event.preventDefault(); close(); });
  $('storageOverview').addEventListener('click', event => { if (event.target.closest('[data-storage-resume]')) open(true); });
  $('storageBack').addEventListener('click', () => { if (sending) return; erase = false; step = step === 'summary' ? 'disks' : step === 'disks' ? 'compare' : 'choice'; render(); });
  $('storageNext').addEventListener('click', () => {
    if (step === 'progress') return close();
    if (step === 'summary') return create();
    if (step === 'disks' && !validCount()) return;
    if (step === 'compare' && eligible().length < profiles[profile].min) return;
    step = step === 'compare' ? 'disks' : 'summary'; erase = false; render();
  });
  $('storageContent').addEventListener('click', event => {
    const choice = event.target.closest('[data-storage-choice]');
    if (choice) { profile = choice.dataset.storageChoice; step = 'compare'; render(); }
    if (event.target.closest('[data-storage-recommend]')) {
      selected = new Map(eligible().sort((a, b) => b.size - a.size || a.path.localeCompare(b.path)).slice(0, profiles[profile].min).map(d => [d.path, d.identity]));
      $('storageContent').querySelectorAll('input[name="storageDisk"]').forEach(input => { input.checked = selected.has(input.value); });
      updateEstimate();
    }
    if (event.target.closest('[data-storage-check]')) load();
  });
  $('storageContent').addEventListener('change', event => {
    const input = event.target;
    if (input.name === 'storageProfile' && !input.disabled) { profile = input.value; selected.clear(); $('storageNext').disabled = eligible().length < profiles[profile].min; }
    if (input.name === 'storageDisk') {
      if (profile === 'single') selected.clear();
      if (input.checked) selected.set(input.value, eligible().find(d => d.path === input.value)?.identity); else selected.delete(input.value);
      updateEstimate();
    }
    if (input.id === 'storageErase') { erase = input.checked; updateSummary(); }
  });
  $('storageContent').addEventListener('input', event => { if (event.target.id === 'storageName') { name = event.target.value; updateSummary(); } });
  window.JenerStorage = { load, open };
})();
