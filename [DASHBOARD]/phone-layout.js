// dvh handles browser chrome. VisualViewport also handles keyboards that shrink
// only the visual viewport (Safari), without disabling browser zoom or scrolling.
(() => {
  'use strict';
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  function update() {
    // Pinch zoom remains the browser's responsibility.
    if (viewport.scale > 1.05) return;
    root.style.setProperty('--visible-height', viewport.height + 'px');
    const editing = document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea');
    const keyboard = !!editing && window.innerHeight - viewport.height > 100;
    root.classList.toggle('keyboard-open', keyboard);
    if (keyboard) document.activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  viewport.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => root.classList.remove('keyboard-open'));
  update();
})();

// Phone sheets: drag the grabber down to close, like a native bottom sheet.
// Closing goes through the sheet's own close button so motion and focus stay right.
(() => {
  'use strict';
  const phone = matchMedia('(max-width: 680px), (max-height: 500px) and (max-width: 960px)');
  for (const sheet of document.querySelectorAll('.desktop .settings-window, .desktop .desktop-dialog')) {
    const grabber = document.createElement('div');
    grabber.className = 'sheet-grabber';
    grabber.setAttribute('aria-hidden', 'true');
    sheet.prepend(grabber);
    let start = null, dy = 0;
    grabber.addEventListener('pointerdown', e => {
      if (!phone.matches || !sheet.open) return;
      start = e.clientY; dy = 0;
      grabber.setPointerCapture(e.pointerId);
      sheet.style.transition = 'none';
    });
    grabber.addEventListener('pointermove', e => {
      if (start === null) return;
      dy = Math.max(0, e.clientY - start);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (start === null) return;
      start = null;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 80) (sheet.querySelector('#closeSettings, .window-header .icon-button') || { click: () => sheet.close() }).click();
    };
    grabber.addEventListener('pointerup', end);
    grabber.addEventListener('pointercancel', end);
  }
})();
