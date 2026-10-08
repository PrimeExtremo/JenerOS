(async () => {
  const assert = (ok, text) => { if (!ok) throw Error(text); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);
  const click = selector => { const el = document.querySelector(selector); assert(el, 'Missing ' + selector); el.click(); };
  async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await wait(10); } throw Error('Timed out waiting for UI'); }
  try {
    await until(() => window.JenerSession && window.JenerStorage);
    if (mode === 'large-text') document.documentElement.style.fontSize = '200%';
    let status = {}, requested = false, posts = [], fail = false, offline = false, gate;
    const disks = [
      { path: '/dev/sda', model: 'System disk', size: 64e9, system: true, eligible: false, reason: 'System disk', identity: 'system' },
      ...['b', 'c', 'd', 'e'].map((n, i) => ({ path: '/dev/sd' + n, model: 'Family disk ' + (i + 1), serial: 'DISK-' + i, size: i ? 1e12 : 2e12, rotational: true, eligible: true, identity: 'disk-' + i })),
      { path: '/dev/sdf', model: '<img src=x onerror=alert(1)>', size: 1e12, eligible: false, reason: 'Contains data or partitions', identity: 'data' },
      { path: '/dev/sdg', model: 'Small disk', size: 1e6, eligible: false, reason: 'Needs at least 1 GB', identity: 'small' },
    ];
    const originalFetch = JenerSession.fetch.bind(JenerSession);
    JenerSession.fetch = async (url, options) => {
      if (!url.startsWith('/api/storage')) return originalFetch(url, options);
      if (url.endsWith('/create')) {
        assert(options.headers['X-JenerOS'] === '1', 'CSRF header required');
        posts.push(JSON.parse(options.body));
        if (gate) await gate;
        if (fail) return new Response(JSON.stringify({ error: 'A disk changed. Refresh your disks.' }), { status: 409 });
        status = { id: 'job-' + posts.length, name: posts[posts.length - 1].name, state: 'queued', message: 'Waiting to begin…', percent: 0 }; requested = true;
        return new Response(JSON.stringify(status), { status: 202 });
      }
      if (offline) throw Error('Offline');
      return new Response(JSON.stringify({ disks, pools: [], status, requested, available: true }));
    };
    openSettings('storage'); await JenerStorage.load();
    assert(!$('createStorage').disabled, 'creation available after inventory');
    assert(document.querySelectorAll('.storage-bay').length > disks.length, 'empty bay placeholder');
    assert(document.querySelector('.storage-system-list').textContent.includes('/dev/sda'), 'system disk row');
    const layout = () => {
      const win = $('storageWindow'), rect = win.getBoundingClientRect();
      assert(rect.left >= -1 && rect.right <= innerWidth + 1, 'sheet fits width');
      assert(rect.top >= -1 && rect.bottom <= innerHeight + 1, 'sheet fits height');
      assert($('storageContent').scrollWidth <= $('storageContent').clientWidth + 1, 'content has no sideways overflow');
      const next = $('storageNext').getBoundingClientRect();
      if (!$('storageNext').hidden) assert(next.top >= rect.top && next.bottom <= rect.bottom + 1 && next.height >= 43.9, 'footer stays visible with a touch target');
      if (innerWidth <= 680 || (innerHeight <= 500 && innerWidth <= 960)) assert(Math.abs(rect.bottom - innerHeight) < 2, 'phone sheet reaches bottom');
      assert(win.contains(document.activeElement), 'focus stays inside storage window');
    };
    async function start(profile) {
      status = {}; requested = false; await JenerStorage.load();
      click('#createStorage'); await wait(450); layout();
      click(`[data-storage-choice="${profile === 'single' ? 'single' : 'raid1'}"]`);
      assert($('storageContent').textContent.includes('RAID5 / RAID6'), 'parity is visible');
      assert(!document.querySelector('input[value="raid5"]'), 'parity cannot be chosen');
      if (profile === 'raid10') { const radio = document.querySelector('input[value="raid10"]'); radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      layout(); click('#storageNext'); layout();
      assert(document.querySelector('input[value="/dev/sda"]').disabled, 'system disk unavailable');
      assert(document.querySelector('input[value="/dev/sdf"]').disabled, 'data disk unavailable');
      assert(document.querySelector('input[value="/dev/sdg"]').disabled, 'small disk unavailable');
      assert(!document.querySelector('#storageContent img'), 'disk model is escaped');
      assert($('storageNext').disabled, 'minimum disks enforced');
      click('[data-storage-recommend]');
      assert(document.querySelectorAll('input[name="storageDisk"]:checked').length === ({ single: 1, raid1: 2, raid10: 4 }[profile]), 'recommendation count');
      assert(!$('storageNext').disabled, 'recommended set accepted');
      if (profile === 'raid1') assert($('storageEstimate').textContent.includes('1000 GB left over'), 'unequal disk estimate is honest');
      click('#storageNext'); layout();
      assert($('storageNext').disabled, 'erase consent required');
      click('#storageNext'); assert(posts.length === 0 || profile !== 'raid1', 'unchecked consent cannot send');
      const input = $('storageName'); input.value = '../bad'; input.dispatchEvent(new Event('input', { bubbles: true }));
      click('#storageErase'); assert($('storageNext').disabled, 'name validation');
      input.value = 'family-' + profile; input.dispatchEvent(new Event('input', { bubbles: true }));
      assert(!$('storageNext').disabled, 'valid summary ready');
    }
    for (const profile of ['raid1', 'raid10', 'single']) {
      await start(profile);
      let release; gate = new Promise(resolve => { release = resolve; });
      const count = posts.length; click('#storageNext'); click('#storageNext'); click('#storageBack'); click('#closeStorage');
      assert(posts.length === count + 1 && $('storageWindow').open, 'only one request and no step change during submit');
      release(); gate = null;
      await until(() => $('storageProgress'));
      const req = posts[posts.length - 1];
      assert(req.profile === profile && req.erase && !req.disks.includes('/dev/sda'), 'safe payload');
      assert(req.disks.every(d => req.identities[d]), 'identity pinned in payload');
      status = { ...status, state: 'working', message: 'Making storage…', percent: 35 };
      await JenerStorage.load(); layout();
      click('#storageNext'); await wait(450); assert(!$('storageWindow').open, 'background closes sheet');
      assert($('createStorage').disabled, 'second creation blocked');
      click('[data-storage-resume]'); await wait(450); assert($('storageProgress').value === 35, 'resumes actual progress');
      offline = true; await JenerStorage.load(); assert($('storageProgressMessage').textContent.includes('Connection lost'), 'offline status is honest');
      offline = false; status = { ...status, state: 'done', message: 'Your storage is ready.', percent: 100 }; requested = false;
      await JenerStorage.load(); assert($('storageProgress').value === 100, 'terminal progress');
      click('#storageNext'); await wait(450);
    }
    // A rejected request stays reviewable and clears erase consent.
    posts = []; await start('raid1'); fail = true; click('#storageNext');
    await until(() => !$('storageError').hidden);
    assert(!$('storageErase').checked && $('storageNext').disabled, 'failure requires new review');
    click('#storageBack'); assert(document.querySelector('input[name="storageDisk"]'), 'can go back after failure');
    const cancel = new Event('cancel', { cancelable: true }); $('storageWindow').dispatchEvent(cancel); await wait(450);
    assert(!$('storageWindow').open, 'Escape closes sheet');
    // Disk replacement after selection never inherits consent or identity.
    fail = false; posts = []; await start('raid1');
    disks[1].identity = 'replacement'; await JenerStorage.load(); click('#storageNext');
    assert(posts.length === 0, 'replaced disk was not submitted');
    parent.postMessage({ ok: true }, '*');
  } catch (error) { parent.postMessage({ error: error.stack || error.message }, '*'); }
})();
