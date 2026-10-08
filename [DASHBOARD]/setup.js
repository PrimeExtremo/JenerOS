(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = ['Welcome', 'Create account', 'Introducing JenerOS'];
  let step = 0, info, network, busy = false, finished = false, submitted = false;
  let code = new URLSearchParams(location.search).get('code') || '';
  const touched = new Set();
  function invalidUnicode(value) {
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit >= 0xD800 && unit <= 0xDBFF) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      } else if (unit >= 0xDC00 && unit <= 0xDFFF) return true;
    }
    return false;
  }
  function ownerErrors() {
    const username = $('username').value, password = $('password').value;
    return {
      username: !/^[a-z][a-z0-9_-]{0,31}$/.test(username)
        ? 'Start with a lowercase letter. Use up to 32 lowercase letters, numbers, - or _.'
        : info?.reservedUsernames?.includes(username) ? 'That name is reserved for the system. Choose your own.' : '',
      password: [...password].length < 8 ? 'Use at least 8 characters.'
        : [...password].reduce((bytes, char) => bytes + (char.codePointAt(0) < 0x80 ? 1 : char.codePointAt(0) < 0x800 ? 2 : char.codePointAt(0) < 0x10000 ? 3 : 4), 0) > 256 || /[\r\n\0]/.test(password) || invalidUnicode(password)
          ? 'Use up to 256 bytes, without line breaks.' : '',
      passwordConfirm: $('passwordConfirm').value !== password || !$('passwordConfirm').value ? 'Type the same password again.' : '',
    };
  }
  function validateFields() {
    const errors = step === 1 ? ownerErrors() : {};
    for (const [id, message] of Object.entries(errors)) {
      const visible = touched.has(id) && !!message;
      $(id + 'Error').textContent = visible ? message : '';
      $(id + 'Error').hidden = !visible;
      $(id).setAttribute('aria-invalid', String(visible));
    }
    const blocked = !info || busy
      || (step === 0 && (!$('acceptedPrivacy').checked || !/^\d{6}$/.test(code)))
      || (step === 1 && Object.values(errors).some(Boolean));
    // Keep invalid steps clickable so an attempt can explain what is missing.
    $('next').disabled = busy;
    $('next').setAttribute('aria-disabled', String(blocked));
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

  // Motion (.scratch/motion/BRIEF.md): the old card slides out, the new one in.
  // Without animation support (or with reduced motion) steps change at once or fade.
  const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'ease';
  const moving = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finishSlide = null;
  function slide(direction, update) {
    finishSlide?.();
    const card = $('wizard');
    if (typeof card.animate !== 'function' || typeof matchMedia !== 'function') { update(); return; }
    // A partial animation implementation must never block setup.
    const animate = (frames, options) => {
      try { return card.animate(frames, options); } catch { return null; }
    };
    if (!moving()) { update(); animate([{ opacity: 0 }, { opacity: 1 }], { duration: parseFloat(token('--t-quick')) || 120, easing: token('--ease') }); return; }
    const out = animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * direction}px)` }], { duration: 200, easing: token('--ease-in'), fill: 'forwards' });
    if (!out) { update(); return; }
    let done = false;
    finishSlide = () => {
      if (done) return;
      done = true; finishSlide = null; out.cancel(); update();
      animate([{ opacity: 0, transform: `translateX(${24 * direction}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: token('--ease-out') });
    };
    out.onfinish = finishSlide;
  }
  // Setup finished: a check pops and draws next to its label, and six dots burst once.
  function celebrate() {
    const note = document.querySelector('[data-step="2"] .note');
    if (!note?.insertAdjacentHTML || note.querySelector('.success-check')) return;
    note.insertAdjacentHTML('afterbegin', '<span class="success-check pop" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg></span>');
    if (typeof matchMedia !== 'function' || !moving()) return;
    const check = note.querySelector('.success-check');
    check.insertAdjacentHTML('beforeend', [0, 1, 2, 3, 4, 5].map(i => {
      const a = i * Math.PI / 3 + .3;
      return `<span class="confetti" style="--dx:${Math.round(Math.cos(a) * 26)}px;--dy:${Math.round(Math.sin(a) * 26)}px"></span>`;
    }).join(''));
    setTimeout(() => check.querySelectorAll('.confetti').forEach(dot => dot.remove()), 700);
  }
  document.addEventListener?.('visibilitychange', () => document.documentElement.classList.toggle('page-hidden', document.hidden));
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
    $('actions').hidden = busy || step === 2;
    $('next').setAttribute('aria-label', step === 0 ? 'Continue to create your account' : 'Create account and set up my box');
    $('wizard').setAttribute('aria-busy', String(!finished && (busy || !info)));
    $('applying').hidden = !busy;
    validateFields();
    if (focus && !busy) document.querySelector(`[data-step="${step}"] h1`).focus();
  }
  function choices(field, values, selected, preserve = false) {
    SetupChoices.set(field, values, selected, preserve);
  }
  function renderPhone() {
    const enabled = network?.addresses?.[0] && /^\d{6}$/.test(code) && !finished;
    $('phoneCard').hidden = finished || !info || !BoxUI.local;
    $('phoneLinks').hidden = !enabled;
    $('codeLabel').textContent = /^\d{6}$/.test(code) && !finished
      ? 'Your setup code: ' + code + '. Open either address, or enter this code if asked.'
      : 'The setup code is not ready. Reopen setup from your box\'s screen.';
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
    $('phoneAddress').href = base + suffix;
    $('phoneAddress').textContent = base;
    $('phoneLocalAddress').href = local + suffix;
    $('phoneLocalAddress').textContent = local;
    // QR is optional: an encoder failure must not prevent opening the sheet.
    try { BoxUI.qr($('setupQR'), base + suffix); }
    catch {
      $('setupQR').replaceChildren(); delete $('setupQR').dataset.text;
      $('phoneHint').textContent = 'Open either address on your phone and enter the setup code below.';
    }
  }
  $('phoneCard').addEventListener('click', () => {
    JenerUI.open($('phoneSheet')); $('phoneClose').focus(); renderPhone();
  });
  $('phoneClose').addEventListener('click', () => JenerUI.close($('phoneSheet')));
  $('phoneSheet').addEventListener('cancel', e => { e.preventDefault(); JenerUI.close($('phoneSheet')); });
  $('phoneSheet').addEventListener('close', () => $('phoneCard').focus());
  async function refreshNetwork() {
    if (!BoxUI.local) return;
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
  $('zoneSearch').addEventListener('input', () => {
    if (!info) return;
    const selected = $('timezone').value;
    const query = $('zoneSearch').value.trim().toLowerCase().replace(/ /g, '_');
    const zones = info.timezones.filter(z => z.toLowerCase().includes(query));
    choices($('timezone'), zones, selected, true);
    $('zoneHint').textContent = zones.length ? `${zones.length} timezones. Choose one below.` : 'No match. Try a nearby city.';
  });
  document.querySelectorAll('[name="networkMode"]').forEach(radio => {
    radio.closest('label').classList.toggle('is-selected', radio.checked);
    radio.addEventListener('change', () => {
      document.querySelectorAll('[name="networkMode"]').forEach(input => input.closest('label').classList.toggle('is-selected', input.checked));
      const fixed = radio.value === 'fixed';
      $('fixedFields').hidden = !fixed;
      $('interfaceButton').setAttribute('aria-required', String(fixed));
      for (const el of $('fixedFields').querySelectorAll('input, select')) el.required = fixed;
    });
  });
  $('togglePassword').addEventListener('click', () => {
    const visible = $('password').type === 'password';
    for (const id of ['password', 'passwordConfirm']) $(id).type = visible ? 'text' : 'password';
    $('togglePassword').textContent = visible ? 'Hide passwords' : 'Show passwords';
    $('togglePassword').setAttribute('aria-pressed', String(visible));
  });
  $('back').addEventListener('click', () => {
    if (finishSlide) { finishSlide(); return; }
    slide(-1, () => { step--; error(''); show(); });
  });
  $('wizard').addEventListener('submit', async e => {
    e.preventDefault();
    // A click or key during a step slide finishes the slide instead.
    if (finishSlide) { finishSlide(); return; }
    if (busy) { error('Your box is applying setup. Keep it switched on while we finish.'); return; }
    if (!info) { error('Setup choices have not loaded. Check your box\'s connection and try again in a moment.'); return; }
    error('');
    if (step === 0 && !$('acceptedPrivacy').checked) { error('Please accept the JenerOS Privacy Policy to continue.'); return; }
    if (step === 0 && !/^\d{6}$/.test(code)) { error('Enter the 6-digit code from your box, or scan its setup QR.'); $('setupCode').focus(); return; }
    // Welcome has only consent and code gates. Account/optional settings cannot block it.
    for (const input of step === 1 ? document.querySelector('[data-step="1"]').querySelectorAll('input, select') : []) {
      if (input.type === 'hidden' || input.closest('[hidden]')) continue;
      if (!input.checkValidity()) {
        const details = input.closest('details'); if (details) details.open = true;
        const label = input.labels?.[0]?.textContent.trim() || input.id;
        error(label + ': ' + (input.validationMessage || 'Check this value before continuing.'));
        input.focus(); return;
      }
    }
    if (step === 1) {
      const requiredChoices = ['keymap', 'timezone'];
      if (document.querySelector('[name="networkMode"]:checked').value === 'fixed') requiredChoices.push('interface');
      for (const id of requiredChoices) {
        if (!$(id).value) {
          document.querySelector('.box-options').open = true;
          error('Choose ' + (id === 'interface' ? 'a network connection.' : id === 'timezone' ? 'a timezone.' : 'a keyboard layout.'));
          $(id === 'timezone' ? 'timezoneList' : id + 'Button').focus();
          return;
        }
      }
      for (const id of ['username', 'password', 'passwordConfirm']) touched.add(id);
      if (!validateFields()) {
        const errors = ownerErrors(), id = Object.keys(errors).find(key => errors[key]);
        error(errors[id]); $(id).focus(); return;
      }
    }
    if (step === 0) { slide(1, () => { step = 1; show(); }); return; }
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
    // Celebrate only a setup that finished here, not a reopened old link.
    const justFinished = busy || submitted;
    finished = true; busy = false; step = 2;
    $('password').value = ''; $('passwordConfirm').value = '';
    code = ''; history.replaceState(null, '', location.pathname);
    JenerUI.close($('phoneSheet'));
    $('phoneCard').hidden = true; $('connectionMessage').hidden = true; error('');
    if (justFinished) slide(1, () => { show(); celebrate(); }); else show();
    $('boxScreenLink').hidden = !BoxUI.local;
    let ip = network?.addresses?.[0];
    try { const res = await fetch('/api/system', { cache: 'no-store' }); if (res.ok) ip = (await res.json()).addresses?.[0]; } catch { /* the chosen fixed address is also offered below */ }
    const address = ip ? BoxUI.address(ip) : location.origin;
    const reqAddress = $('address').value.split('/')[0];
    const base = document.querySelector('[name="networkMode"]:checked').value === 'fixed' && reqAddress ? BoxUI.address(reqAddress) : address;
    $('doneAddress').textContent = base; $('doneAddress').href = base + '/login';
    $('dashboardLink').href = base + '/login';
    $('filesLink').href = base + '/login?next=%2F%23%2Ffiles';
    $('storeLink').href = base + '/login?next=%2F%23%2Fapps';
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
      if (status.state === 'applying') { busy = true; step = 1; show(false); $('applyMessage').textContent = status.message || 'Keep your box switched on while we finish.'; }
      if (status.state === 'failed' && busy) {
        busy = false; submitted = false; step = 1; show();
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
