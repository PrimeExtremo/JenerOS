// icons.svg must mirror index.html's sprite: login and setup load it while
// signed out, when index.html redirects to /login.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const dash = path.join(__dirname, '..', '..', '[DASHBOARD]');
const sprite = s => s.match(/<svg[^>]*id="jener-icons".*?<\/svg>/s)[0]
  .replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
const index = fs.readFileSync(path.join(dash, 'index.html'), 'utf8');
const pub = fs.readFileSync(path.join(dash, 'icons.svg'), 'utf8');
const icons = fs.readFileSync(path.join(dash, 'icons.js'), 'utf8');

assert.strictEqual(sprite(pub), sprite(index), 'icons.svg is out of date: copy the jener-icons sprite from index.html');
assert.ok(/fetch\('icons\.svg'/.test(icons), 'icons.js must load the public icons.svg, not index.html');
for (const id of ['i-eye', 'i-eye-off']) assert.ok(pub.includes(`id="${id}"`), `${id} missing from icons.svg`);
console.log('Public icon sprite matches index.html.');
