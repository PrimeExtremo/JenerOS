window.addEventListener('load', async () => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const $ = id => document.getElementById(id);
  const visible = el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0
      && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    for (let i = 0; i < 100 && $('phoneCard').hidden; i++) await delay(10);
    await delay(400); // Let the Welcome entrance animation settle.
    const sheet = $('phoneSheet');
    assert(!visible(sheet), 'Closed sheet is hidden');
    sheet.hidden = true; // A leftover hidden state must not defeat opening.
    for (const close of ['button', 'Escape']) {
      $('phoneCard').focus(); $('phoneCard').click();
      assert(visible(sheet), 'Phone sheet must have visible computed display/visibility and onscreen bounds');
      assert(document.activeElement === $('phoneClose'), 'Focus moves into the phone sheet');
      const button = $('phoneClose'), r = button.getBoundingClientRect();
      assert(button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), 'Sheet must paint above the card and backdrop');
      assert(new URL($('phoneAddress').textContent).hostname === '192.168.1.20' && $('codeLabel').textContent.includes('012345'), 'Addresses/code stay usable');
      if (mode !== 'qr-failure') assert($('setupQR').querySelector('svg'), 'Real encoder renders the QR');
      if (close === 'button') button.click();
      else if (sheet.classList.contains('modal-fallback')) document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
      else sheet.dispatchEvent(new Event('cancel', { cancelable:true })); // Native Esc emits cancel.
      assert(!visible(sheet), 'Close/Esc hides the sheet');
      assert(document.activeElement === $('phoneCard'), 'Close/Esc returns focus to the trigger');
    }
    const input = $('acceptedPrivacy'), box = document.querySelector('.privacy-check-box');
    const rect = input.getBoundingClientRect(), paint = box.getBoundingClientRect();
    assert(rect.width >= 44 && rect.height >= 44, 'Consent native hit area must be at least 44x44');
    assert(document.elementFromPoint(paint.x + paint.width / 2, paint.y + paint.height / 2) === input, 'Painted checkbox must hit the real input');
    assert(getComputedStyle(box).pointerEvents === 'none' && getComputedStyle(box.querySelector('svg')).pointerEvents === 'none', 'Check decorations cannot intercept clicks');
    input.click(); assert(input.checked, 'Box activation toggles consent');
    document.querySelector('.privacy-choice > span:last-child').click(); assert(!input.checked, 'Text activation toggles the same input');
    input.focus(); assert(document.activeElement === input, 'Native checkbox remains keyboard focusable');
    parent.postMessage({ok:true}, '*');
  } catch (error) { parent.postMessage({error:error.message}, '*'); }
});
