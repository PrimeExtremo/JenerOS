const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { dataset: {}, hidden: false, textContent: '', replaceChildren() {}, removeAttribute(name) { delete this[name]; } });
  return elements.get(id);
}
const context = vm.createContext({ document: { getElementById: element, addEventListener() {} },
  setTimeout() {}, JenerRollback: { bind() { return { render() {}, offline() {} }; } },
  BoxUI: { address: ip => `http://${ip.includes(':') ? '[' + ip + ']' : ip}`, localAddress: host => `http://${host || 'jeneros'}.local`, qr(el, text) { el.dataset.text = text; } } });
const source = fs.readFileSync('[DASHBOARD]/screen.js', 'utf8').replace('refresh(); updates();', 'globalThis.refresh = refresh;');
vm.runInContext(source, context);
(async () => {
  context.fetch = async () => ({ ok: true, json: async () => ({ hostname: 'jeneros', osVersion: '0.3.1', addresses: ['192.168.1.20'], sshStatus: 'off', manufacturer: 'Test vendor', model: 'Test box', kernel: '6.12', buildDate: '2026-10-07', uptimeSec: 90061 }) });
  await context.refresh();
  assert.equal(element('screenVersion').textContent, 'JenerOS 0.3.1');
  assert.equal(element('screenManufacturer').textContent, 'Test vendor');
  assert.equal(element('screenUptime').textContent, '1 days 1 h');
  assert.equal(element('screenLocalAddress').href, 'http://jeneros.local');
  assert.equal(element('screenQR').dataset.text, 'http://192.168.1.20');
  assert.match(element('screenSSH').textContent, /off by default/);
  context.fetch = async () => ({ ok: true, json: async () => ({ hostname: 'my-box', addresses: ['fd12::20'], sshStatus: 'on' }) });
  await context.refresh();
  assert.equal(element('screenModel').textContent, 'Not available');
  assert.equal(element('screenAddress').href, 'http://[fd12::20]');
  assert.equal(element('screenLocalAddress').href, 'http://my-box.local');
  assert.match(element('screenSSH').textContent, /SSH is on/);
  context.fetch = async () => { throw new Error('offline'); };
  await context.refresh();
  assert.equal(element('screenAddress').hidden, true); assert.equal(element('screenAddress').href, undefined);
  assert.equal(element('screenQR').dataset.text, undefined);
  console.log('Screen checks passed: facts, version, SSH, hostname, IPv6, QR and stale-address cleanup.');
})().catch(err => { console.error(err); process.exitCode = 1; });
