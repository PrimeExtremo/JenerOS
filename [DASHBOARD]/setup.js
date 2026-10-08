(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = ['Welcome', 'Keyboard', 'Timezone', 'Box name', 'Owner', 'Network', 'Summary', 'Done'];
  let step = 0, info, network, busy = false, finished = false, submitted = false;
  let code = new URLSearchParams(location.search).get('code') || '';
  const touched = new Set();
  function ownerErrors() {
    const username = $('username').value, password = $('password').value;
    return {
      username: !/^[a-z][a-z0-9_-]{0,31}$/.test(username)
        ? 'Start with a lowercase letter. Use up to 32 lowercase letters, numbers, - or _.'
        : info?.reservedUsernames?.includes(username) ? 'That name is reserved for the system. Choose your own.' : '',
      password: [...password].length < 8 ? 'Use at least 8 characters.'
        : new TextEncoder().encode(password).length > 256 || /[\r\n\0]/.test(password) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(password)
          ? 'Use up to 256 bytes, without line breaks.' : '',
      passwordConfirm: $('passwordConfirm').value !== password || !$('passwordConfirm').value ? 'Type the same password again.' : '',
    };
  }
  function validateFields() {
    const errors = ownerErrors();
    for (const [id, message] of Object.entries(errors)) {
      const visible = touched.has(id) && !!message;
      $(id + 'Error').textContent = visible ? message : '';
      $(id + 'Error').hidden = !visible;
      $(id).setAttribute('aria-invalid', String(visible));
    }
    $('next').disabled = !info || busy
      || (step === 0 && (!$('acceptedPrivacy').checked || !/^\d{6}$/.test(code)))
      || (step === 4 && Object.values(errors).some(Boolean));
    return !Object.values(errors).some(Boolean);
  }
  $('wizard').addEventListener('input', e => {
    if (['username', 'password', 'passwordConfirm'].includes(e.target.id)) touched.add(e.target.id);
    validateFields();
  });
  $('wizard').addEventListener('change', validateFields);
  if (!/^\d{6}$/.test(code)) code = '';
  // No browser storage: a code or password never survives in localStorage.
  $('codeField').hidden = !!code;
  $('setupCode').required = !code;
  $('setupCode').addEventListener('input', () => { code = $('setupCode').value; renderPhone(); });

  function error(message) { $('setupError').textContent = message; $('setupError').hidden = !message; }
  function show(focus = true) {
    document.querySelectorAll('[data-step]').forEach(el => { el.hidden = Number(el.dataset.step) !== step || busy; });
    $('progress').replaceChildren(...labels.map((label, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1} ${label}`;
      if (i === step) li.setAttribute('aria-current', 'step');
      if (i < step) li.className = 'complete';
      return li;
    }));
    $('back').hidden = step === 0;
    $('actions').hidden = busy || step === 7;
    $('next').textContent = step === 0 ? "Let's begin" : step === 6 ? 'Set up my box' : 'Continue';
    $('wizard').setAttribute('aria-busy', String(busy || !info));
    $('applying').hidden = !busy;
    if (step === 6 && info) summary();
    validateFields();
    if (focus && !busy) document.querySelector(`[data-step="${step}"] h1`).focus();
  }
  function choices(select, values, selected) {
    select.replaceChildren(...values.map(v => new Option(v.name || v.replaceAll('_', ' '), v.id || v)));
    if (selected && [...select.options].some(o => o.value === selected)) select.value = selected;
  }
  function renderPhone() {
    const enabled = network?.addresses?.[0] && /^\d{6}$/.test(code) && !finished;
    $('phoneCard').hidden = finished || !info;
    $('phoneLinks').hidden = !enabled;
    $('phoneHint').textContent = !network
      ? "Checking your box's network connection..."
      : !network.addresses?.[0]
        ? 'Connect a network cable from your box to your router. Your phone link will appear here.'
        : 'Scan with your camera. Your phone must be on the same Wi-Fi as the box\'s network.';
    if (!enabled) {
      $('setupQR').replaceChildren();
      delete $('setupQR').dataset.text;
      for (const id of ['phoneAddress', 'phoneLocalAddress']) {
        $(id).removeAttribute('href'); $(id).textContent = '';
      }
      return;
    }
    const base = BoxUI.address(network.addresses[0]);
    const local = BoxUI.localAddress(network.hostname);
    const suffix = '/setup.html?code=' + encodeURIComponent(code);
    BoxUI.qr($('setupQR'), base + suffix);
    $('phoneAddress').href = base + suffix;
    $('phoneAddress').textContent = base;
    $('phoneLocalAddress').href = local + suffix;
    $('phoneLocalAddress').textContent = local;
    $('codeLabel').textContent = 'Open either address, or enter code ' + code + ' if asked.';
  }
  async function refreshNetwork() {
    try {
      const res = await fetch('/api/system', { cache: 'no-store' });
      if (!res.ok) throw new Error('Disconnected');
      network = await res.json();
    } catch { network = null; }
    if (!finished) { renderPhone(); setTimeout(refreshNetwork, 3000); }
  }
  function request() {
    const mode = document.querySelector('[name="networkMode"]:checked').value;
    return {
      acceptedPrivacy: $('acceptedPrivacy').checked, language: $('language').value,
      code, keymap: $('keymap').value, timezone: $('timezone').value,
      hostname: $('hostname').value, username: $('username').value,
      password: $('password').value, passwordConfirm: $('passwordConfirm').value,
      network: mode === 'automatic' ? { mode } : {
        mode, interface: $('interface').value, address: $('address').value.trim(),
        gateway: $('gateway').value.trim(), dns: $('dns').value.split(/[,\s]+/).filter(Boolean),
      },
    };
  }
  function summary() {
    const req = request();
    const rows = [
      ['Keyboard', info.keymaps.find(k => k.id === req.keymap)?.name],
      ['Language', 'English'], ['Privacy Policy', `Accepted · ${info.privacyPolicyVersion}`],
      ['Timezone', req.timezone.replaceAll('_', ' ')], ['Box name', req.hostname],
      ['Owner', req.username], ['Password', 'Set · kept private'],
      ['Network', req.network.mode === 'automatic' ? 'Automatic (recommended)' : `${req.network.interface} · ${req.network.address}`],
    ];
    if (req.network.mode === 'fixed') rows.push(['Router', req.network.gateway], ['DNS servers', req.network.dns.join(', ')]);
    $('summary').replaceChildren(...rows.flatMap(([label, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; return [dt, dd];
    }));
  }
  $('zoneSearch').addEventListener('input', () => {
    const selected = $('timezone').value;
    const query = $('zoneSearch').value.trim().toLowerCase().replaceAll(' ', '_');
    const zones = info.timezones.filter(z => z.toLowerCase().includes(query));
    choices($('timezone'), zones, selected);
    $('zoneHint').textContent = zones.length ? `${zones.length} timezones. Choose one below.` : 'No match. Try a nearby city.';
  });
  document.querySelectorAll('[name="networkMode"]').forEach(radio => radio.addEventListener('change', () => {
    const fixed = radio.value === 'fixed';
    $('fixedFields').hidden = !fixed;
    for (const el of $('fixedFields').querySelectorAll('input, select')) el.required = fixed;
  }));
  $('togglePassword').addEventListener('click', () => {
    const visible = $('password').type === 'password';
    for (const id of ['password', 'passwordConfirm']) $(id).type = visible ? 'text' : 'password';
    $('togglePassword').textContent = visible ? 'Hide passwords' : 'Show passwords';
    $('togglePassword').setAttribute('aria-pressed', String(visible));
  });
  $('back').addEventListener('click', () => { step--; error(''); show(); });
  $('wizard').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !info) return;
    error('');
    if (step === 0 && !$('acceptedPrivacy').checked) { error('Please accept the JenerOS Privacy Policy to continue.'); return; }
    if (step === 0 && !/^\d{6}$/.test(code)) { error('Enter the 6-digit code from your box, or scan its setup QR.'); $('setupCode').focus(); return; }
    for (const input of document.querySelector(`[data-step="${step}"]`).querySelectorAll('input, select')) {
      if (input.closest('[hidden]')) continue;
      if (!input.reportValidity()) return;
    }
    if (step === 4) {
      for (const id of ['username', 'password', 'passwordConfirm']) touched.add(id);
      if (!validateFields()) return;
    }
    if (step < 6) { step++; show(); return; }
    const req = request();
    busy = true; show(false);
    if (req.network.mode === 'fixed') {
      const ip = req.network.address.split('/')[0];
      const base = BoxUI.address(ip);
      $('newAddress').href = `${base}/setup.html?code=${encodeURIComponent(code)}`;
      $('newAddress').textContent = `Moving to ${base} · Continue there if this page loses touch.`;
      $('newAddress').hidden = BoxUI.local;
    }
    try {
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'X-JenerOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
      if (res.status === 409) { submitted = true; $('password').value = ''; $('passwordConfirm').value = ''; return; }
      if (!res.ok) { const body = await res.json(); throw new Error(body.error || "Couldn't start setup. Try again."); }
      submitted = true;
      // Release form-held passwords as soon as the request is accepted.
      $('password').value = ''; $('passwordConfirm').value = '';
    } catch (err) {
      busy = false; show(false); error(err.message || "Couldn't reach your box. Try again.");
    }
  });
  async function done() {
    if (finished) return;
    finished = true; busy = false; step = 7;
    $('password').value = ''; $('passwordConfirm').value = '';
    code = ''; history.replaceState(null, '', location.pathname);
    $('phoneCard').hidden = true; $('connectionMessage').hidden = true; error(''); show();
    if (BoxUI.local) { location.replace('/screen.html'); return; }
    let ip = network?.addresses?.[0];
    try { const res = await fetch('/api/system', { cache: 'no-store' }); if (res.ok) ip = (await res.json()).addresses?.[0]; } catch { /* the chosen fixed address is also offered below */ }
    const address = ip ? BoxUI.address(ip) : location.origin;
    $('doneAddress').textContent = address; $('doneAddress').href = address;
    $('dashboardLink').href = address;
  }
  async function load() {
    try {
      const res = await fetch('/api/setup', { cache: 'no-store' });
      if (res.status === 403) { await done(); return; }
      if (!res.ok) throw new Error('Could not load setup choices.');
      info = await res.json();
      choices($('keymap'), info.keymaps, 'us');
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      choices($('timezone'), info.timezones, info.timezones.includes(zone) ? zone : 'UTC');
      if (!info.timezones.includes(zone)) $('zoneHint').textContent = 'Choose a nearby city. Your browser timezone was not in this list.';
      choices($('interface'), info.interfaces);
      $('hostname').value = info.hostname || 'jeneros';
      $('connectionMessage').hidden = true;
      renderPhone(); show(false);
    } catch {
      $('connectionMessage').textContent = "Can't reach your box yet. We'll try again in a moment.";
      setTimeout(load, 3000);
    }
  }
  async function poll() {
    try {
      const res = await fetch('/api/setup/status', { cache: 'no-store' });
      if (res.status === 403) { await done(); return; }
      if (!res.ok) throw new Error('Disconnected');
      const status = await res.json();
      if (status.state === 'done') { await done(); return; }
      if (status.state === 'applying') { busy = true; step = 6; show(false); $('applyMessage').textContent = status.message || 'Keep your box switched on while we finish.'; }
      if (status.state === 'failed' && busy) {
        busy = false; submitted = false; step = 4; show();
        error(status.message || "Setup couldn't finish. Please try again.");
        $('password').value = ''; $('passwordConfirm').value = '';
        validateFields();
      }
    } catch {
      if (busy || submitted) $('applyMessage').textContent = "Waiting for your box to reconnect. If you chose a fixed address, open the new address below.";
    }
    if (!finished) setTimeout(poll, 2000);
  }
  show(false); refreshNetwork(); load().then(() => { if (!finished) poll(); });
})();
