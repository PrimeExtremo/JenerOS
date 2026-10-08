// Security-relevant browser behavior using fake HTTP and no real credentials.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync('[DASHBOARD]/login.js', 'utf8');
function fixture(legacy = false) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', type: id === 'loginPassword' ? 'password' : 'text', hidden: true, attributes: {}, handlers: {},
      addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute(name, value) { this.attributes[name] = value; }, focus() { this.focused = true; } });
    return elements.get(id);
  }
  let requests = [], destination, now = 1000, response = { status: 401, ok: false, json: async () => ({ error: 'Check your username and password, then try again.' }) };
  const location = { search: '', pathname: '/login', hash: '', replace(url) { destination = url; } };
  const context = vm.createContext({ window: {}, document: { getElementById: element }, location, URLSearchParams,
    AbortSignal: legacy ? undefined : AbortSignal, Date: { now: () => now }, setTimeout() {}, fetch: async (url, options) => {
      if (url === '/api/auth/session') return { ok: false, status: 401 };
      requests.push({ url, options }); return response;
    } });
  vm.runInContext(fs.readFileSync('[DASHBOARD]/session.js', 'utf8'), context);
  context.JenerSession = context.window.JenerSession;
  vm.runInContext(source, context);
  return { context, element, requests, location, get destination() { return destination; }, set response(r) { response = r; }, set now(n) { now = n; },
    submit: () => element('loginForm').handlers.submit({ preventDefault() {} }) };
}
(async () => {
  const f = fixture();
  await f.submit(); assert.equal(f.requests.length, 0); assert.equal(f.element('loginError').hidden, false);
  f.element('loginUsername').value = 'owner'; f.element('loginPassword').value = 'fake password';
  await f.submit();
  assert.equal(f.requests[0].options.headers['X-JenerOS'], '1');
  assert.equal(f.element('loginPassword').value, ''); assert.equal(f.destination, undefined);
  assert.equal(f.element('loginPassword').attributes['aria-invalid'], 'true');
  f.element('loginForm').handlers.input(); assert.equal(f.element('loginError').hidden, true);
  f.response = { status: 429, ok: false, headers: { get: () => '60' }, json: async () => ({ error: 'Wait a minute.' }) };
  f.element('loginPassword').value = 'fake password'; await f.submit();
  const tries = f.requests.length; await f.submit(); assert.equal(f.requests.length, tries); assert.equal(f.element('signIn').disabled, true);
  f.now = 62000; f.response = { status: 200, ok: true };
  f.location.search = '?next=' + encodeURIComponent('/#/files');
  f.element('loginPassword').value = 'fake password'; await f.submit(); assert.equal(f.destination, '/#/files');
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/api/update', '/?next=https://evil.example']) {
    f.location.search = '?next=' + encodeURIComponent(path); assert.equal(f.context.JenerSession.destination(), '/');
  }
  f.location.search = '?next=' + encodeURIComponent('/#/apps'); assert.equal(f.context.JenerSession.destination(), '/#/apps');
  f.location.pathname = '/screen.html'; f.response = { status: 401, ok: false };
  await assert.rejects(f.context.JenerSession.fetch('/api/update'), /Sign in/);
  assert.equal(f.destination, '/login?next=%2Fscreen.html');
  const html = fs.readFileSync('[DASHBOARD]/setup.html', 'utf8');
  assert.deepEqual([...html.matchAll(/data-step="(\d)"/g)].map(m => m[1]), ['0', '1', '2']);
  assert.equal((html.match(/class="feature-tile"/g) || []).length, 4);
  assert.match(html, /href="privacy.pdf" download hidden/);
  assert.match(html, /id="privacyLink" href="#privacySheet"/);
  assert.doesNotMatch(html, /<select|Read the policy as a webpage/);
  assert.match(html, /id="filesLink"[^>]+next=%2F%23%2Ffiles/);
  assert.match(html, /id="storeLink"[^>]+next=%2F%23%2Fapps/);
  const legacy = fixture(true);
  legacy.element('loginUsername').value = 'owner'; legacy.element('loginPassword').value = 'fake password';
  await legacy.submit();
  assert.equal(legacy.requests.length, 1, 'Login still sends the request without AbortSignal.timeout/matchMedia');
  assert.equal(legacy.requests[0].options.signal, undefined);
  console.log('Login checks passed: inline failure, cleared passwords, CSRF, rate-limit retry, safe destinations, expired-session redirect and three setup cards.');
})().catch(err => { console.error(err); process.exitCode = 1; });
