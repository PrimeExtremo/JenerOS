const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { dataset: {}, value: '', checked: false, hidden: false,
    attributes: {}, addEventListener() {}, setAttribute(name, value) { this.attributes[name] = value; } });
  return elements.get(id);
}
const reservedBlock = fs.readFileSync('[CORE]/internal/setup/setup.go', 'utf8').match(/var ReservedUsernames = \[\]string\{([\s\S]*?)\n\}/)[1];
const reservedUsernames = [...reservedBlock.matchAll(/"([^"]+)"/g)].map(m => m[1]);
const source = fs.readFileSync('[DASHBOARD]/setup.js', 'utf8').replace('show(false); refreshNetwork(); load().then(() => { if (!finished) poll(); });',
  'globalThis.test = { init(i) { info = i; }, step(s) { step = s; }, errors: ownerErrors, validate: validateFields, request, touch(id) { touched.add(id); } };');
const context = vm.createContext({ document: { getElementById: element, querySelectorAll() { return []; }, querySelector() { return { value: 'automatic' }; } },
  location: { search: '?code=012345' }, URLSearchParams, TextEncoder });
vm.runInContext(source, context);
const test = context.test;
test.init({ reservedUsernames });
test.validate(); assert.equal(element('next').attributes['aria-disabled'], 'true');
element('acceptedPrivacy').checked = true; test.validate(); assert.equal(element('next').attributes['aria-disabled'], 'false');
element('language').value = 'en';
assert.equal(test.request().acceptedPrivacy, true); assert.equal(test.request().language, 'en');
test.step(1); test.validate(); assert.equal(element('next').attributes['aria-disabled'], 'true');
element('password').value = element('passwordConfirm').value = '12345678';
for (const value of ['a', 'jener_2', 'home-owner', 'a'.repeat(32)]) {
  element('username').value = value; test.validate(); assert.equal(element('next').attributes['aria-disabled'], 'false', value);
}
for (const value of ['', '_owner', '2owner', 'Owner', 'a.b', 'a b', 'a'.repeat(33), ...reservedUsernames]) {
  element('username').value = value; test.touch('username'); test.validate();
  assert.equal(element('next').attributes['aria-disabled'], 'true', value); assert.equal(element('usernameError').hidden, false, value);
}
element('username').value = 'jener';
for (const value of ['12345678', 'é'.repeat(8), 'a'.repeat(256), '??'.repeat(8)]) {
  element('password').value = element('passwordConfirm').value = value; test.validate(); assert.equal(element('next').attributes['aria-disabled'], 'false');
}
for (const value of ['', '1234567', 'é'.repeat(4), 'a'.repeat(257), 'password\n', 'password\0', 'password\uD800', 'password\uDC00', 'password\uD800x']) {
  element('password').value = element('passwordConfirm').value = value; test.touch('password'); test.validate();
  assert.equal(element('next').attributes['aria-disabled'], 'true'); assert.equal(element('passwordError').hidden, false);
}
element('password').value = '12345678'; element('passwordConfirm').value = 'different'; test.touch('passwordConfirm'); test.validate();
assert.equal(element('passwordConfirmError').hidden, false); assert.equal(element('next').attributes['aria-disabled'], 'true');
element('passwordConfirm').value = '12345678'; test.validate();
assert.equal(element('passwordConfirmError').hidden, true); assert.equal(element('next').attributes['aria-disabled'], 'false');
console.log('Wizard checks passed: consent, reserved names, live field errors, password limits, Unicode and confirmation.');
