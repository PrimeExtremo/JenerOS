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
    if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') {
      try { dialog.showModal(); return; } catch { /* Use the page modal below. */ }
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
