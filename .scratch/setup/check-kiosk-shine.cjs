// Real CSS/WAAPI checks, including pseudo-elements, on the loopback kiosk path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('[DASHBOARD]/box-ui.js', 'utf8');
for (const hostname of ['127.0.0.1', 'localhost', '[::1]', '192.168.1.20', 'jeneros.local']) {
  const context = { window: {}, location: { hostname }, document: { addEventListener() {} } };
  vm.runInNewContext(source, context);
  assert.equal(context.window.BoxUI.local, ['127.0.0.1', 'localhost', '[::1]'].includes(hostname), hostname);
}
// Isolate the lighting controller from setup's necessary status polling:
// even a dormant recurring timer would violate the kiosk's idle contract.
const shine = fs.readFileSync('[DASHBOARD]/onboarding-shine.js', 'utf8');
for (const reduced of [false, true]) {
  const classes = new Set(), calls = [], windowEvents = {}, documentEvents = {};
  const animate = (frames, timing) => {
    const effect = { frames, timing, cancel() { this.cancelled = true; } };
    calls.push(effect); return effect;
  };
  const card = { clientWidth: 720, animate, appendChild() {} };
  const wallpaper = { appendChild() { assert.fail('Kiosk must never add a wallpaper light'); } };
  const document = { hidden: false,
    documentElement: { classList: { add: name => classes.add(name) } },
    querySelector: selector => selector.includes('wallpaper') ? wallpaper : card,
    createElement: () => ({ animate, setAttribute() {}, appendChild() {} }),
    addEventListener: (name, fn) => { documentEvents[name] = fn; }
  };
  const context = { document, window: { BoxUI: { local: true }, addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    matchMedia: () => ({ matches: reduced, addEventListener() {} }),
    setTimeout() { assert.fail('No lighting timer on kiosk'); },
    setInterval() { assert.fail('No lighting interval on kiosk'); },
    requestAnimationFrame() { assert.fail('No JS animation clock on kiosk'); }
  };
  vm.runInNewContext(shine, context);
  assert(classes.has('box-local'));
  assert.equal(calls.length, reduced ? 0 : 1);
  context.window.OnboardingShine.stepChanged();
  if (!reduced) {
    assert(calls[0].cancelled, 'Replacing sweep releases previous effect');
    calls[1].onfinish();
    assert(calls[1].cancelled, 'Native finish releases effect');
    for (const call of calls) assert.equal(call.timing.iterations, 1);
  }
  documentEvents.visibilitychange();
  windowEvents.pagehide();
  assert.equal(windowEvents.resize, undefined, 'Resize has no kiosk clock');
  assert.equal(windowEvents.pageshow, undefined, 'Returning has no kiosk clock');
}
console.log('Kiosk controller checks passed: local addresses, no wallpaper layer/timers, finite effects and cleanup.');
process.env.JENER_UI_FIXTURE = 'kiosk-shine';
require('./check-welcome-browser.cjs');
