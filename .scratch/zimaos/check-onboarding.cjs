// Exercise the three-card transition and real setup submission shape.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { value: '', type: 'text', hidden: false, checked: false, dataset: {}, handlers: {}, attributes: {},
    addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute(k) { delete this.attributes[k]; },
    replaceChildren(...items) { this.children = items; }, querySelectorAll() { return []; }, focus() {} });
  return elements.get(id);
}
const sections = [0, 1, 2].map(step => ({ dataset: { step: String(step) }, hidden: false, querySelectorAll: () => [], focus() {} }));
const fixedRadio = { value: 'fixed' }, autoRadio = { value: 'automatic' };
let mode = autoRadio, requests = [], replaced = [], address = 'http://192.168.1.20';
const context = vm.createContext({ document: { getElementById: element, createElement: () => ({ setAttribute() {} }), querySelectorAll: sel => sel === '[data-step]' ? sections : [],
  querySelector: sel => sel === '[name="networkMode"]:checked' ? mode : { focus() {}, querySelectorAll: () => [] } },
  location: { search: '?code=012345', pathname: '/setup.html', origin: address }, history: { replaceState(...args) { replaced.push(args); } },
  URLSearchParams, TextEncoder, BoxUI: { local: false, address: ip => 'http://' + ip },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return url === '/api/setup' ? { ok: true, status: 202 } : { ok: false, status: 401 };
  } });
let source = fs.readFileSync('[DASHBOARD]/setup.js', 'utf8');
source = source.replace('show(false); refreshNetwork(); load().then(() => { if (!finished) poll(); });',
  'globalThis.flow = { init(i) { info = i; }, show, done, get step() { return step; } };');
vm.runInContext(source, context);
context.flow.init({ reservedUsernames: [], timezones: ['UTC'], keymaps: [{ id: 'us', name: 'English (US)' }], hostname: 'jeneros' });
const submit = () => element('wizard').handlers.submit({ preventDefault() {} });
(async () => {
  context.flow.show(false);
  assert.equal(element('next').disabled, true);
  element('acceptedPrivacy').checked = true; element('language').value = 'en';
  await submit(); assert.equal(context.flow.step, 1); assert.equal(sections[1].hidden, false); assert.equal(sections[0].hidden, true);
  assert.equal(element('next').disabled, true);
  element('username').value = 'owner'; element('password').value = element('passwordConfirm').value = 'fake password';
  element('hostname').value = 'my-box'; element('timezone').value = 'UTC'; element('keymap').value = 'us';
  context.flow.show(false); assert.equal(element('next').disabled, false);
  mode = fixedRadio; element('interface').value = 'eth0'; element('address').value = '192.168.1.22/24';
  element('gateway').value = '192.168.1.1'; element('dns').value = '192.168.1.1';
  await submit();
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.acceptedPrivacy, true); assert.equal(body.code, '012345'); assert.equal(body.username, 'owner');
  assert.equal(body.network.mode, 'fixed'); assert.equal(requests[0].options.headers['X-JenerOS'], '1');
  assert.equal(element('password').value, ''); assert.equal(element('passwordConfirm').value, '');
  assert.equal(element('actions').hidden, true); assert.equal(element('applying').hidden, false);
  assert.equal(element('newAddress').href, 'http://192.168.1.22/setup.html?code=012345');
  await context.flow.done();
  assert.equal(context.flow.step, 2); assert.equal(sections[2].hidden, false); assert.equal(element('applying').hidden, true);
  assert.equal(element('phoneCard').hidden, true); assert.equal(element('boxScreenLink').hidden, true);
  assert.equal(element('filesLink').href, 'http://192.168.1.22/login?next=%2F%23%2Ffiles');
  assert.equal(element('storeLink').href, 'http://192.168.1.22/login?next=%2F%23%2Fapps');
  assert.equal(element('dashboardLink').href, 'http://192.168.1.22/login');
  assert.equal(replaced[0][2], '/setup.html');
  console.log('Onboarding checks passed: consent gate, welcome/account/apply/introduction, CSRF, request shape, cleared passwords/code and fixed-address sign-in links.');
})().catch(err => { console.error(err); process.exitCode = 1; });
