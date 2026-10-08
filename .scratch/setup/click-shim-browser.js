window.addEventListener('load', async () => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 20));
  try {
    await new Promise(resolve => setTimeout(resolve, 400));
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--paper);padding:20px;overflow:auto';
    host.innerHTML = `<button id="shimButton"><span>A</span><span>B</span></button>
      <label id="shimLabel"><input id="shimCheck" type="checkbox"><span>Consent</span></label>
      <input id="shimRadio" type="radio"><input id="shimText" type="text">
      <label id="shimTextLabel" for="shimText">Username</label>
      <button id="shimDisabled" disabled>Disabled</button><button id="shimOther">Other</button>
      <div id="shimOption" role="option" tabindex="0">Choice</div>
      <div id="shimCombo" role="combobox" tabindex="0">Choices</div>
      <details><summary id="shimSummary">Details</summary>Content</details>
      <a id="shimLink" href="#shim-destination">Link</a>
      <label id="shimExternal" for="shimCheck">External label</label>
      <div contenteditable="true"><span id="shimEdit">Edit me</span></div>`;
    document.body.appendChild(host);
    const $ = id => document.getElementById('shim' + id);
    const calls = new Map();
    host.querySelectorAll('*').forEach(el => {
      const native = el.click;
      el.click = function() { calls.set(el, (calls.get(el) || 0) + 1); return native.call(el); };
    });
    let clicks = 0, changes = 0;
    $('Button').addEventListener('click', () => clicks++);
    $('Check').addEventListener('change', () => changes++);
    const point = el => { const r = el.getBoundingClientRect(); return { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; };
    const event = (el, type, props = {}) => {
      const init = { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, ...point(el), ...props };
      const e = type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init);
      el.dispatchEvent(e); return e;
    };
    async function gesture(el, { native = false, down = el, up = el, props = {}, between, after } = {}) {
      event(down, 'pointerdown', props); event(down, 'mousedown', props);
      if (between) between();
      event(up, 'pointerup', props); event(up, 'mouseup', props);
      if (native) event(up, 'click', { detail:1, ...props });
      if (after) after();
      await wait();
    }
    await gesture($('Button'));
    assert(clicks === 1 && calls.get($('Button')) === 1, 'Missing click repaired once');
    await gesture($('Button'), { native:true });
    assert(clicks === 2 && calls.get($('Button')) === 1, 'Native click leaves shim silent');
    await gesture($('Button'), { native:true, props:{ pointerType:'touch' } });
    assert(clicks === 3 && calls.get($('Button')) === 1, 'Native touch click leaves shim silent');
    const children = $('Button').children;
    // Two nearby descendants, sharing the same interactive ancestor.
    const p = point(children[0]);
    await gesture($('Button'), { down:children[0], up:children[1], props:p });
    assert(clicks === 4, 'Descendants share their button');
    for (const el of [$('Check'), $('Label').lastElementChild, $('External')]) {
      const before = $('Check').checked, changeCount = changes;
      await gesture(el);
      assert($('Check').checked !== before && changes === changeCount + 1, 'Input/label forwards one toggle and change');
      const count = calls.get(el) || 0, controlCount = calls.get($('Label')) || 0;
      await gesture(el, { native:true });
      assert($('Check').checked === before && changes === changeCount + 2, 'Native label/input toggles once');
      assert((calls.get(el) || 0) === count && (calls.get($('Label')) || 0) === controlCount, 'Native input/label never repaired');
    }
    await gesture($('Radio')); assert($('Radio').checked, 'Radio default activation');
    await gesture($('Summary')); assert($('Summary').parentElement.open, 'Summary default activation');
    await gesture($('Link')); assert(location.hash === '#shim-destination', 'Link default navigation');
    for (const id of ['Option', 'Combo']) {
      await gesture($(id)); assert(calls.get($(id)) === 1, id + ' activation');
    }
    const before = clicks;
    for (const props of [{button:1}, {button:2}, {isPrimary:false}, {ctrlKey:true}, {metaKey:true}]) await gesture($('Button'), { props });
    await gesture($('Button'), { up:$('Other'), props:point($('Button')) }); // Capture retargeting alone stays on original hit.
    assert(clicks === before + 1, 'Release hit-test handles pointer capture');
    const settled = clicks;
    await gesture($('Button'), { up:$('Other') });
    await gesture($('Button'), { between:() => event($('Button'), 'pointermove', {clientX:point($('Button')).clientX + 20}) });
    await gesture($('Button'), { between:() => event($('Button'), 'pointercancel') });
    await gesture($('Button'), { between:() => event($('Button'), 'dragstart') });
    await gesture($('Button'), { between:() => document.dispatchEvent(new Event('scroll')) });
    await gesture($('Button'), { between:() => event($('Other'), 'pointerdown', {pointerId:2, isPrimary:false}) });
    $('Button').addEventListener('pointerup', e => e.preventDefault(), {once:true});
    await gesture($('Button'));
    $('Button').addEventListener('pointerdown', e => e.preventDefault(), {once:true});
    await gesture($('Button'));
    assert(clicks === settled, 'Drags, other targets, cancellations, modifiers and second pointers ignored');
    for (const id of ['Text', 'TextLabel', 'Disabled', 'Edit']) {
      await gesture($(id)); assert(!calls.has($(id)), id + ' ignored');
    }
    event($('Button'), 'pointerdown');
    await new Promise(resolve => setTimeout(resolve, 620));
    event($('Button'), 'pointerup'); await wait();
    assert(clicks === settled, 'Long press ignored');
    await gesture($('Button'), { after:() => { $('Button').disabled = true; } });
    assert(clicks === settled, 'Disabled before fallback ignored');
    $('Button').disabled = false;
    const removed = $('Other');
    await gesture(removed, { after:() => removed.remove() });
    assert(!calls.has(removed), 'Detached target ignored');
    // Keyboard/script click has no pointer gesture and must never be swallowed.
    $('Button').click(); await wait(); assert(clicks === settled + 1, 'Standalone activation unchanged');
    host.remove();
    // Reproduce Claude's exact failing controls with the real setup handlers.
    const consent = document.getElementById('acceptedPrivacy');
    consent.scrollIntoView({block:'center'}); await wait();
    const wasChecked = consent.checked;
    await gesture(consent); assert(consent.checked !== wasChecked, 'Real setup consent repaired');
    const phone = document.getElementById('phoneCard');
    phone.scrollIntoView({block:'center'}); await wait();
    await gesture(phone); assert(document.getElementById('phoneSheet').open, 'Real phone sheet opens without native click');
    await gesture(document.getElementById('phoneClose'));
    assert(!document.getElementById('phoneSheet').open, 'Real phone sheet closes without native click');
    parent.postMessage({ok:true}, '*');
  } catch (error) { parent.postMessage({error:error.stack}, '*'); }
});
