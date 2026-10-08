// Run actual startup/handlers with markup-derived inputs and older WebKit APIs.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync('[DASHBOARD]/setup.html', 'utf8');
const css = fs.readFileSync('[DASHBOARD]/style.css', 'utf8');
assert.match(html, /class="privacy-check"><input id="acceptedPrivacy"[^>]*type="checkbox"[^>]*required><span class="privacy-check-box" aria-hidden="true"><svg/);
assert.match(css, /\.privacy-check \{[^}]*position: relative[^}]*width: 44px; height: 44px/);
assert.match(css, /\.privacy-check > input \{[^}]*position: absolute[^}]*width: 44px; height: 44px[^}]*opacity: 0[^}]*pointer-events: auto/);
assert.match(css, /\.privacy-check-box \{[^}]*place-items: center/);
assert.match(css, /input:checked \+ \.privacy-check-box svg \{ visibility: visible/);
assert.match(css, /\.privacy-check-box \*[^{}]*\{ pointer-events: none/);
assert.match(css, /forced-colors: active/);
assert.doesNotMatch(html, /<details[^>]*id="phoneCard"/);
assert.match(html, /<button[^>]*type="button"[^>]*id="phoneCard"/);
for (const file of fs.readdirSync('[DASHBOARD]').filter(name => /\.(js|css)$/.test(name))) {
  const source = fs.readFileSync('[DASHBOARD]/' + file, 'utf8');
  assert.doesNotMatch(source, /\?<!|\?<=|\.at\(|structuredClone\(|:has\(|\.replaceAll\(/, file + ': avoid unguarded newer syntax/APIs');
}
for (const page of ['setup', 'login', 'index', 'screen']) {
  const markup = fs.readFileSync(`[DASHBOARD]/${page}.html`, 'utf8');
  assert.match(markup, page === 'index' ? /src="ui-compat.js"><\/script>/ : /src="ui-compat.js" defer/);
  if (page === 'index') assert.ok(markup.indexOf('src="ui-compat.js"') < markup.indexOf('src="app.js"'));
}
class FakeEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); this.defaultPrevented = false; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
  stopImmediatePropagation() { this.stopped = true; }
}
function fixture({ native = false, local = true, code = '012345', fail = false, partialAnimation = false } = {}) {
  const elements = new Map(), requests = [], timers = [];
  let document;
  class Node {
    constructor(id = '') {
      this.id = id; this.attrs = {}; this.dataset = {}; this.handlers = {}; this.children = [];
      this.value = ''; this.textContent = ''; this.type = ''; this.checked = false; this.hidden = false; this.open = false; this.tabIndex = 0;
      const classes = new Set();
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), toggle(name, yes) { if (yes) classes.add(name); else classes.delete(name); } };
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    async emit(type, init = {}) {
      const e = new FakeEvent(type, { target: this, ...init });
      for (const fn of this.handlers[type] || []) await fn(e);
      if (e.bubbles && !e.stopped && this.parentElement) await this.parentElement.emit(type, { ...init, target: e.target });
      return e;
    }
    dispatchEvent(e) { for (const fn of this.handlers[e.type] || []) fn(e); return !e.defaultPrevented; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k]; }
    removeAttribute(k) { delete this.attrs[k]; }
    replaceChildren(...children) { this.children = children; }
    append(child) { child.parentElement = this; this.children.push(child); }
    appendChild(child) { this.append(child); }
    get firstChild() { return this.children[0]; }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
    remove() { this.removed = true; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    getClientRects() { return this.hidden ? [] : [{}]; }
    closest(selector) {
      if (selector === 'label') return this.label ||= new Node();
      if (selector === '[hidden]') return this.hidden ? this : this.parentElement?.closest(selector);
      if (selector === 'details') return null;
      return this;
    }
    querySelectorAll(selector) {
      if (selector === 'input, select') return this.inputs || [];
      return this.children;
    }
    checkValidity() {
      if (this.type === 'hidden') return true;
      if (this.required && (this.type === 'checkbox' ? !this.checked : !this.value)) return false;
      return !this.attrs.pattern || !this.value || new RegExp('^(?:' + this.attrs.pattern + ')$').test(this.value);
    }
  }
  if (!native) Node.prototype.replaceChildren = undefined;
  const $ = id => { if (id === 'timezoneButton') return null; if (!elements.has(id)) elements.set(id, new Node(id)); return elements.get(id); };
  for (const match of html.matchAll(/<\w+\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = $(match[1]);
    for (const attr of match[0].matchAll(/(\w+)="([^"]*)"/g)) node.attrs[attr[1]] = attr[2];
    node.type = node.attrs.type || ''; node.value = node.attrs.value || '';
    node.hidden = /\shidden(?:\s|>)/.test(match[0]); node.required = /\srequired(?:\s|>)/.test(match[0]); node.checked = /\schecked(?:\s|>)/.test(match[0]);
  }
  const sections = [...html.matchAll(/<section data-step="(\d)"([\s\S]*?)<\/section>/g)].map(match => {
    const section = new Node(); section.dataset.step = match[1]; section.parentElement = $('wizard');
    section.inputs = [...match[2].matchAll(/<input\b[^>]*id="([^"]+)"/g)].map(m => $(m[1]));
    section.inputs.forEach(input => { input.parentElement = section; });
    return section;
  });
  const mode = new Node(); mode.value = 'automatic'; mode.checked = true;
  const fixed = new Node(); fixed.value = 'fixed';
  const sheet = $('phoneSheet'); sheet.children = [$('phoneClose')]; $('phoneClose').parentElement = sheet;
  if (native) {
    for (const id of ['phoneSheet', 'privacySheet']) {
      $(id).showModal = function() { this.open = true; };
      $(id).close = function() { this.open = false; this.dispatchEvent(new FakeEvent('close')); };
    }
  }
  document = {
    body: new Node(), activeElement: $('next'), documentElement: new Node(), handlers: {},
    getElementById: $, createElement: () => new Node(),
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
    querySelectorAll(sel) { return sel === '[data-step]' ? sections : sel === '[name="networkMode"]' ? [mode, fixed] : []; },
    querySelector(sel) {
      if (sel === '[name="networkMode"]:checked') return mode;
      const match = sel.match(/data-step="(\d)"/);
      if (match) return sel.endsWith('h1') ? $(['welcomeTitle', 'ownerTitle', 'doneTitle'][Number(match[1])]) : sections[Number(match[1])];
      return new Node();
    },
  };
  const context = vm.createContext({ document, window: {}, Element: Node, location: { hostname: local ? '127.0.0.1' : '192.168.1.20', port: '', search: code ? '?code=' + code : '', pathname: '/setup.html' },
    URLSearchParams, Event: FakeEvent, getComputedStyle: node => ({ display: node.open ? 'flex' : 'none', visibility: 'visible' }), setTimeout: (fn, ms) => timers.push({ fn, ms }),
    QRCode: function(el, opts) { el.qr = opts.text; },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fail) throw Error('offline');
      return { ok: true, status: 200, json: async () => url === '/api/system' ? { hostname: 'jeneros', addresses: ['192.168.1.20'] }
        : url === '/api/setup/status' ? { state: 'waiting' }
        : { keymaps: [{ id: 'us', name: 'English (US)' }], timezones: ['UTC'], interfaces: ['eth0'], hostname: 'jeneros', reservedUsernames: [] } };
    },
  });
  context.QRCode.CorrectLevel = { L: 1 };
  if (partialAnimation) {
    $('wizard').animate = () => { throw Error('Animation unavailable'); };
    context.matchMedia = () => ({ matches: false });
    context.getComputedStyle = () => ({ getPropertyValue: () => '' });
  }
  vm.runInContext('Array.prototype.at = undefined; String.prototype.replaceAll = undefined;', context);
  for (const name of ['ui-compat', 'box-ui', 'setup-controls', 'setup']) {
    vm.runInContext(fs.readFileSync(`[DASHBOARD]/${name}.js`, 'utf8'), context);
    if (name === 'ui-compat') context.JenerUI = context.window.JenerUI;
    if (name === 'box-ui') context.BoxUI = context.window.BoxUI;
    if (name === 'setup-controls') context.SetupChoices = context.window.SetupChoices;
  }
  return { $, context, document, sections, requests,
    submit: () => $('wizard').emit('submit'),
    key: async key => { const e = new FakeEvent('keydown', { key }); for (const fn of document.handlers.keydown || []) { fn(e); if (e.stopped) break; } return e; },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  for (const native of [false, true]) {
    const f = fixture({ native }); await settle();
    const { $, sections } = f;
    assert.equal($('wizard').attrs['aria-busy'], 'false', 'Real startup loaded choices without newer APIs');
    assert.equal($('phoneCard').hidden, false);
    await $('phoneCard').emit('click'); assert.equal($('phoneSheet').open, true);
    assert.equal($('setupQR').qr, 'http://192.168.1.20/setup.html?code=012345');
    assert.equal($('phoneAddress').textContent, 'http://192.168.1.20');
    assert.equal($('phoneLocalAddress').textContent, 'http://jeneros.local');
    assert.match($('codeLabel').textContent, /012345/);
    assert.equal(f.document.activeElement, $('phoneClose'));
    if (!native) {
      f.document.activeElement = $('next'); await f.key('Tab');
      assert.equal(f.document.activeElement, $('phoneClose'), 'Fallback traps Tab inside sheet');
      await f.key('Escape');
    } else await $('phoneSheet').emit('cancel');
    assert.equal($('phoneSheet').open, false); assert.equal(f.document.activeElement, $('phoneCard'));
    await $('phoneCard').emit('click'); await $('phoneClose').emit('click');
    assert.equal($('phoneSheet').open, false);
    await $('privacyLink').emit('click'); await settle();
    assert.equal($('privacySheet').open, true, 'Policy uses the same native/fallback modal');
    await $('privacyClose').emit('click');
    assert.equal($('privacySheet').open, false); assert.equal(f.document.activeElement, $('acceptedPrivacy'));
    assert.equal($('next').disabled, false, 'Blocked steps remain actionable for inline explanations');
    await f.submit(); assert.match($('setupError').textContent, /accept.*Privacy Policy/);
    $('acceptedPrivacy').checked = true; await $('acceptedPrivacy').emit('change', { bubbles: true });
    assert.equal($('next').attrs['aria-disabled'], 'false');
    assert.equal($('username').checkValidity(), false, 'Untouched required account fields exist in the real markup');
    await f.submit(); assert.equal(sections[0].hidden, true); assert.equal(sections[1].hidden, false);
    assert.equal($('setupError').hidden, true);
    assert.equal(f.requests.some(request => request.options?.method === 'POST'), false, 'Welcome only advances; it never creates the owner');
  }
  const missing = fixture({ code: '' }); await settle(); missing.$('acceptedPrivacy').checked = true;
  await missing.submit(); assert.match(missing.$('setupError').textContent, /6-digit code/);
  missing.$('setupCode').value = '123456'; await missing.$('setupCode').emit('input', { bubbles: true });
  await missing.submit(); assert.equal(missing.sections[1].hidden, false, 'Manual code/Enter uses the same submit path');
  const offline = fixture({ fail: true }); await settle(); await offline.submit();
  assert.match(offline.$('setupError').textContent, /choices have not loaded/);
  const remote = fixture({ local: false }); await settle(); assert.equal(remote.$('phoneCard').hidden, true);
  const partial = fixture({ partialAnimation: true }); await settle(); partial.$('acceptedPrivacy').checked = true;
  await partial.submit(); assert.equal(partial.sections[1].hidden, false, 'Partial animation support cannot block advance');
  const brokenQR = fixture(); await settle();
  brokenQR.context.BoxUI.qr = () => { throw Error('Encoder unavailable'); };
  await brokenQR.$('phoneCard').emit('click');
  assert.equal(brokenQR.$('phoneSheet').open, true, 'Encoder errors cannot abort sheet opening');
  assert.equal(brokenQR.$('phoneAddress').textContent, 'http://192.168.1.20');
  assert.match(brokenQR.$('phoneHint').textContent, /Open either address/);
  console.log('Welcome checks passed: older APIs/startup, consent/code validation, native/fallback sheet, QR failure recovery, Close/Esc/focus/Tab and 44px input overlay.');
})().catch(err => { console.error(err); process.exitCode = 1; });
