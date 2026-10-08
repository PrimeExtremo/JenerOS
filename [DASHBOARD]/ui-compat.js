// Cog/WPE on the kiosk can deliver a complete pointer gesture but omit click.
// Wait a task (not a microtask: that can run before the native click). Leave
// ordinary clicks, keyboard activation and native checkbox/label defaults alone.
(() => {
  const interactive = 'button, a[href], input, label, summary, select, [role="button"], [role="option"], [role="combobox"], [role="checkbox"], [role="radio"]';
  let down = null, pending = null, repaired = null;
  function control(node) {
    if (!node || typeof node.closest !== 'function') return null;
    if (node.closest('textarea, [contenteditable]:not([contenteditable="false"])')) return null;
    const el = node.closest(interactive);
    if (!el || typeof el.click !== 'function' || el.closest(':disabled, [inert], [aria-disabled="true"]')) return null;
    const input = el.tagName === 'LABEL' ? el.control : el;
    if (input && (input.matches('textarea, :disabled') ||
      (input.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|image)$/i.test(input.type)))) return null;
    return el;
  }
  const same = (a, b) => a === b || (a && b &&
    ((a.tagName === 'LABEL' && a.control === b) || (b.tagName === 'LABEL' && b.control === a)));
  const moved = (e, start) => Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 10;
  function cancel() { down = null; pending = null; repaired = null; }
  document.addEventListener('pointerdown', e => {
    // A second finger, modifier gesture or another press invalidates old work.
    cancel();
    if (e.button !== 0 || e.isPrimary === false || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const el = control(e.target);
    if (el) down = { el, event: e, id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
  }, true);
  document.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id && moved(e, down)) down = null;
  }, true);
  document.addEventListener('pointerup', e => {
    const start = down;
    if (!start || e.pointerId !== start.id) return;
    down = null;
    // Hit-test the release as touch/pointer capture may retarget e.target.
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (e.button !== 0 || e.isPrimary === false || moved(e, start) ||
      e.timeStamp - start.time > 600 || !same(start.el, control(hit))) return;
    pending = start;
    setTimeout(() => {
      if (pending !== start) return;
      pending = null;
      if (document.hidden || start.event.defaultPrevented || e.defaultPrevented ||
        !start.el.isConnected || !control(start.el)) return;
      // Preserve the label's native forwarding and input/change default actions.
      repaired = { el: start.el, id: start.id, x: e.clientX, y: e.clientY, time: e.timeStamp };
      start.el.click();
    }, 0);
  }, true);
  document.addEventListener('click', e => {
    const el = control(e.target);
    if (pending && same(pending.el, el)) pending = null;
    // Some touch engines deliver a delayed native click in a later task. Only
    // swallow that physical duplicate, never a keyboard or script activation.
    if (repaired && e.isTrusted && e.detail > 0 && same(repaired.el, el) &&
      e.timeStamp - repaired.time < 700 && !moved(e, repaired) &&
      (e.pointerId === undefined || e.pointerId === repaired.id)) {
      repaired = null;
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('dragstart', cancel, true);
  document.addEventListener('scroll', cancel, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  // Initialize the shared CSS visibility flag, including initially hidden tabs.
  const visibility = () => document.documentElement.classList.toggle('page-hidden', document.hidden);
  document.addEventListener('visibilitychange', visibility);
  visibility();
})();

// Native dialogs when available; an in-page modal for older kiosk WebKit.
if (typeof Element !== 'undefined' && typeof Element.prototype.replaceChildren !== 'function') {
  Element.prototype.replaceChildren = function(...children) {
    while (this.firstChild) this.removeChild(this.firstChild);
    for (const child of children) this.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  };
}
window.JenerUI = (() => {
  const fallback = [];
  const focusable = dialog => [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter(el => !el.disabled && el.getClientRects().length && el.tabIndex >= 0);
  function open(dialog) {
    if (dialog.open) return;
    dialog.returnFocus = document.activeElement;
    // Fallback positioning must not inherit a card's transform/blur context.
    if (dialog.parentElement !== document.body) document.body.append(dialog);
    dialog.hidden = false;
    if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') {
      try {
        dialog.showModal();
        const style = getComputedStyle(dialog);
        if (dialog.open && style.display !== 'none' && style.visibility !== 'hidden' && dialog.getClientRects().length) return;
        if (dialog.open) dialog.close();
      } catch { /* Use the page modal below. */ }
    }
    const shade = document.createElement('div');
    shade.className = 'modal-shade';
    shade.setAttribute('aria-hidden', 'true');
    document.body.append(shade);
    dialog.modalShade = shade;
    dialog.classList.add('modal-fallback');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('open', '');
    dialog.open = true;
    dialog.setAttribute('tabindex', '-1');
    fallback.push(dialog);
    (focusable(dialog)[0] || dialog).focus();
  }
  function close(dialog, value = '') {
    if (!dialog.open) return;
    if (!dialog.modalShade) { dialog.close(value); return; }
    dialog.returnValue = value;
    dialog.removeAttribute('open');
    dialog.open = false;
    dialog.classList.remove('modal-fallback');
    dialog.modalShade.remove();
    delete dialog.modalShade;
    fallback.splice(fallback.indexOf(dialog), 1);
    dialog.returnFocus?.focus();
    dialog.dispatchEvent(new Event('close'));
  }
  document.addEventListener('keydown', e => {
    const dialog = fallback[fallback.length - 1];
    if (!dialog) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) close(dialog);
    } else if (e.key === 'Tab') {
      const items = focusable(dialog), index = items.indexOf(document.activeElement);
      e.preventDefault(); e.stopImmediatePropagation();
      (items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length] || dialog).focus();
    }
  }, true);
  document.addEventListener('focusin', e => {
    const dialog = fallback[fallback.length - 1];
    if (dialog && !dialog.contains(e.target)) (focusable(dialog)[0] || dialog).focus();
  });
  document.addEventListener('submit', e => {
    const dialog = fallback[fallback.length - 1];
    if (dialog && dialog.contains(e.target) && e.target.getAttribute('method') === 'dialog') {
      e.preventDefault(); close(dialog, e.submitter?.value || document.activeElement?.value || '');
    }
  });
  return { open, close };
})();
