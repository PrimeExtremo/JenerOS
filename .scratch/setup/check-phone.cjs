const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { dataset: {}, hidden: false, textContent: '', value: '',
    addEventListener() {}, replaceChildren(...children) { this.children = children; },
    removeAttribute(name) { delete this[name]; }, setAttribute() {} });
  return elements.get(id);
}
const document = { getElementById: element, addEventListener() {}, querySelectorAll: () => [] };
const location = { hostname: '127.0.0.1', port: '', search: '?code=012345' };
const context = vm.createContext({ document, location, window: {}, URLSearchParams, console,
  setTimeout() {}, QRCode: function(el, opts) { el.qr = opts.text; } });
context.QRCode.CorrectLevel = { L: 1 };
vm.runInContext(fs.readFileSync('[DASHBOARD]/box-ui.js', 'utf8'), context);
context.BoxUI = context.window.BoxUI;
let source = fs.readFileSync('[DASHBOARD]/setup.js', 'utf8');
source = source.replace('show(false); refreshNetwork(); load().then(() => { if (!finished) poll(); });',
  'globalThis.phoneTest = { set(n, c = "012345", f = false) { info = {}; network = n; code = c; finished = f; renderPhone(); }, refreshNetwork };');
vm.runInContext(source, context);
const test = context.phoneTest;
test.set({ hostname: 'jeneros', addresses: [] });
assert.equal(element('phoneCard').hidden, false);
assert.equal(element('phoneLinks').hidden, true);
assert.match(element('phoneHint').textContent, /Connect a network cable/);
assert.equal(element('phoneAddress').href, undefined);
test.set({ hostname: 'jeneros', addresses: ['192.168.1.20'] });
assert.equal(element('phoneLinks').hidden, false);
assert.equal(element('setupQR').qr, 'http://192.168.1.20/setup.html?code=012345');
assert.equal(element('phoneAddress').textContent, 'http://192.168.1.20');
assert.equal(element('phoneLocalAddress').href, 'http://jeneros.local/setup.html?code=012345');
assert.match(element('phoneHint').textContent, /same Wi-Fi/);
test.set({ hostname: 'my-box', addresses: ['192.168.1.21'] });
assert.equal(element('setupQR').qr, 'http://192.168.1.21/setup.html?code=012345');
assert.equal(element('phoneLocalAddress').textContent, 'http://my-box.local');
location.port = '8080';
test.set({ hostname: 'my-box', addresses: ['fd12::20'] });
assert.equal(element('setupQR').qr, 'http://[fd12::20]:8080/setup.html?code=012345');
assert.equal(element('phoneLocalAddress').textContent, 'http://my-box.local:8080');
assert.equal(context.BoxUI.localAddress(''), 'http://jeneros.local:8080');
test.set({ hostname: 'my-box', addresses: [] });
assert.equal(element('phoneLinks').hidden, true);
assert.equal(element('setupQR').dataset.text, undefined);
assert.deepEqual(element('setupQR').children, []);
assert.equal(element('phoneLocalAddress').href, undefined);
test.set({ addresses: ['192.168.1.22'] }, 'invalid');
assert.equal(element('phoneLinks').hidden, true);
test.set({ addresses: ['192.168.1.22'] }, '012345', true);
assert.equal(element('phoneCard').hidden, true);
(async () => {
  test.set(null);
  context.fetch = async () => ({ ok: true, json: async () => ({hostname:'restored', addresses:['192.168.1.30']}) });
  await test.refreshNetwork();
  assert.equal(element('phoneLocalAddress').textContent, 'http://restored.local:8080');
  context.fetch = async () => { throw new Error('offline'); };
  await test.refreshNetwork();
  assert.equal(element('phoneLinks').hidden, true);
  assert.equal(element('phoneAddress').href, undefined);
  console.log('Phone checks passed: no network, recovery, address change, hostname, code, IPv6, port and completion.');
})().catch(err => { console.error(err); process.exitCode = 1; });
