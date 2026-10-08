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
