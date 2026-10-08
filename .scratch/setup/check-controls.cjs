// Page-owned list keyboard behavior and policy sheet lifecycle, with fake DOM/services.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
function fixture(local = false) {
  const elements = new Map();
  let document, article, fetches = 0, fail = false;
  function node(id = '') {
    const el = { id, value: '', hidden: /List$/.test(id) && id !== 'timezoneList', children: [], attrs: {}, handlers: {}, textContent: '',
      classList: { toggle() {} }, addEventListener(type, fn) { this.handlers[type] = fn; },
      setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; },
      replaceChildren(...items) { this.children = items; }, append(item) { this.children.push(item); },
      scrollIntoView() {}, focus() { document.activeElement = this; }, dispatchEvent(e) { this.changed = e; },
      closest() { return this; }, parentElement: { contains: () => false },
      showModal() { this.open = true; }, close() { this.open = false; this.handlers.close(); },
      querySelector() { return { remove() {} }; }, querySelectorAll() { return []; } };
    return el;
  }
  const $ = id => { if (id === 'timezoneButton') return null; if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  document = { getElementById: $, createElement: () => node(), importNode: el => el, addEventListener(type, fn) { this[type] = fn; } };
  const context = vm.createContext({ document, window: {}, BoxUI: { local }, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    DOMParser: class { parseFromString() { article = node(); article.querySelectorAll = () => [{ removeAttribute(key) { article.removed = key; } }]; return { querySelector: () => article }; } },
    fetch: async url => { fetches++; assert.equal(url, 'privacy.html'); return { ok: !fail, text: async () => '<article>shared policy</article>' }; } });
  vm.runInContext(fs.readFileSync('[DASHBOARD]/setup-controls.js', 'utf8'), context);
  function key(id, key) {
    const e = { key, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    $(id).handlers.keydown(e); return e;
  }
  function click(id, target = $(id)) { return $(id).handlers.click({ target, preventDefault() {}, stopPropagation() {} }); }
  return { $, document, context, key, click, get article() { return article; }, get fetches() { return fetches; }, set fail(value) { fail = value; } };
}
(async () => {
  const f = fixture(), { $, key, click } = f;
  const set = (id, values, selected, preserve) => f.context.window.SetupChoices.set($(id), values, selected, preserve);
  set('keymap', [{ id: 'us', name: 'English (US)' }, { id: 'gb', name: 'English (UK)' }, { id: 'de', name: 'German' }], 'us');
  assert.equal($('keymap').value, 'us'); assert.equal($('keymapText').textContent, 'English (US)');
  assert.equal($('keymapList').children[0].attrs['aria-selected'], 'true');
  assert.ok(!$('keymapButton').attrs['aria-activedescendant']);
  click('keymapButton'); assert.equal($('keymapButton').attrs['aria-expanded'], 'true');
  const arrow = key('keymapButton', 'ArrowDown'); assert.ok(arrow.stopped && arrow.prevented);
  assert.equal($('keymap').value, 'us'); key('keymapButton', 'Escape'); assert.equal($('keymap').value, 'us');
  assert.equal($('keymapList').hidden, true); assert.ok(!$('keymapButton').attrs['aria-activedescendant']);
  key('keymapButton', 'Enter'); key('keymapButton', 'g'); key('keymapButton', 'Enter');
  assert.equal($('keymap').value, 'de'); assert.equal($('keymapText').textContent, 'German'); assert.ok($('keymap').changed.bubbles);
  click('keymapButton'); key('keymapButton', 'Home'); key('keymapButton', 'Tab'); assert.equal($('keymap').value, 'us');
  click('keymapButton'); click('keymapList', $('keymapList').children[1]); assert.equal($('keymap').value, 'gb');
  assert.equal(f.document.activeElement, $('keymapButton'));
  set('interface', ['eth0', 'eth1']); click('keymapButton'); click('interfaceButton'); assert.equal($('keymapList').hidden, true);
  key('interfaceButton', 'End'); key('interfaceButton', ' '); assert.equal($('interface').value, 'eth1');
  click('interfaceButton'); f.document.click({ target: {} }); assert.equal($('interfaceList').hidden, true);
  click('interfaceButton'); f.document.focusin({ target: {} }); assert.equal($('interfaceList').hidden, true);
  set('interface', []); assert.equal($('interfaceButton').attrs['aria-disabled'], 'true'); assert.equal($('interface').value, '');
  set('timezone', ['UTC', 'America/New_York', 'Europe/London'], 'UTC');
  key('timezoneList', 'ArrowDown'); assert.equal($('timezone').value, 'America/New_York');
  set('timezone', ['Europe/London'], $('timezone').value, true); assert.equal($('timezone').value, 'America/New_York');
  set('timezone', [], $('timezone').value, true); assert.equal($('timezone').value, 'America/New_York');
  assert.ok(!$('timezoneList').attrs['aria-activedescendant']);
  set('timezone', ['UTC', 'America/New_York', 'Europe/London'], $('timezone').value, true);
  key('zoneSearch', 'ArrowDown'); assert.equal(f.document.activeElement, $('timezoneList'));
  key('timezoneList', 'e'); assert.equal($('timezone').value, 'Europe/London');
  key('timezoneList', 'Escape'); assert.equal(f.document.activeElement, $('zoneSearch'));
  assert.equal($('privacyDownload').hidden, false);
  click('privacyLink'); await new Promise(resolve => setImmediate(resolve));
  assert.equal($('privacySheet').open, true); assert.equal(f.document.activeElement, $('privacyClose'));
  assert.equal($('privacyContent').children[0], f.article); assert.equal($('privacyContent').attrs['aria-busy'], 'false');
  assert.equal(f.article.removed, undefined);
  $('privacySheet').handlers.cancel({ preventDefault() {} }); assert.equal(f.document.activeElement, $('acceptedPrivacy'));
  click('privacyLink'); click('privacyClose'); assert.equal(f.fetches, 1);
  const box = fixture(true); box.fail = true; box.click('privacyLink'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(box.$('privacyDownload').hidden, true); assert.equal(box.$('privacyRetry').hidden, false);
  assert.match(box.$('privacyStatus').textContent, /could not load/);
  box.fail = false; await box.$('privacyRetry').handlers.click(); assert.equal(box.article.removed, 'href');
  box.click('privacyClose'); assert.equal(box.document.activeElement, box.$('acceptedPrivacy'));
  console.log('Setup controls passed: keyboard/type-ahead/click/Tab/Escape, selected values, filtered timezone, empty network, sheet load/retry/close/focus and kiosk download/contact guard.');
})().catch(err => { console.error(err); process.exitCode = 1; });
