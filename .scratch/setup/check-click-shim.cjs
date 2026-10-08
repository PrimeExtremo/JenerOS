// Real DOM/default actions and synthetic pointer/mouse sequences; no packages.
// Also model trusted delayed events: browser JS cannot construct isTrusted=true.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const listeners = {}, timers = [];
let repairs = 0;
const button = {
  tagName:'BUTTON', isConnected:true,
  closest(selector) { return selector.startsWith('button,') ? this : null; },
  matches() { return false; },
  click() { repairs++; emit('click', {isTrusted:false, detail:0}); }
};
const document = { hidden:false, documentElement:{classList:{toggle(){}}},
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, elementFromPoint() { return button; } };
function emit(type, props = {}) {
  const e = {type, target:button, button:0, isPrimary:true, pointerId:1, clientX:20, clientY:20,
    timeStamp:100, isTrusted:true, detail:1, preventDefault(){this.defaultPrevented=true;}, stopImmediatePropagation(){this.stopped=true;}, ...props};
  for (const fn of listeners[type] || []) { fn(e); if (e.stopped) break; }
  return e;
}
vm.runInNewContext(fs.readFileSync('[DASHBOARD]/ui-compat.js', 'utf8'), {document, window:{}, setTimeout:fn => timers.push(fn)});
emit('pointerdown'); emit('pointerup', {timeStamp:120}); timers.splice(0).forEach(fn => fn());
assert.equal(repairs, 1);
const delayed = emit('click', {timeStamp:420});
assert.ok(delayed.defaultPrevented && delayed.stopped, 'Late physical duplicate suppressed after repair');
assert.ok(!emit('click', {timeStamp:421, detail:0}).stopped, 'Keyboard activation is preserved');
emit('pointerdown', {timeStamp:500}); emit('pointerup', {timeStamp:520});
assert.ok(!emit('click', {timeStamp:521}).stopped, 'Next real gesture remains native');
timers.splice(0).forEach(fn => fn()); assert.equal(repairs, 1, 'Native click prevents repair');
console.log('Delayed trusted click guard passed (modeled event trust).');
process.env.JENER_UI_FIXTURE = 'click-shim';
require('./check-welcome-browser.cjs');
