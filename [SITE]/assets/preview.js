// jener.dev/preview: the scroll-driven 3D story.
// Loaded in <head> so the page picks the story or the still grid before it paints.
// Everything you see is a function of the scroll position (plus a gentle pointer
// tilt), so the page can be scrubbed, and only transform and opacity change.
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clearGlass = matchMedia('(prefers-reduced-transparency: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const chromium = !!navigator.userAgentData?.brands?.some(b => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  if (!('requestAnimationFrame' in window) || !window.CSS?.supports?.('transform-style', 'preserve-3d')) return;

  // --ease from the motion brief: cubic-bezier(0.2, 0, 0, 1).
  function bezier(x1, y1, x2, y2) {
    const a = (p1, p2) => 1 - 3 * p2 + 3 * p1, b = (p1, p2) => 3 * p2 - 6 * p1, c = p1 => 3 * p1;
    const at = (t, p1, p2) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
    const slope = (t, p1, p2) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= (at(t, x1, x2) - x) / s;
      }
      return at(Math.min(1, Math.max(0, t)), y1, y2);
    };
  }
  const ease = bezier(0.2, 0, 0, 1);
  const clamp = v => Math.min(1, Math.max(0, v));
  const span = (t, from, to) => clamp((t - from) / (to - from));

  let chapters = [], frame = 0, on = false;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

  function enable() {
    if (reduce.matches) return;
    root.classList.add('motion');
    root.classList.toggle('refract', chromium && !clearGlass.matches);
    on = true;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
  function disable() {
    on = false;
    cancelAnimationFrame(frame);
    root.classList.remove('motion', 'refract');
    for (const el of document.querySelectorAll('.preview-page [style]')) el.removeAttribute('style');
  }

  function start() {
    if (!on) return;
    chapters = [...document.querySelectorAll('.chapter')].map((el, i) => ({
      el,
      side: el.dataset.side === 'left' ? -1 : 1,
      first: i === 0,
      rig: el.querySelector('.rig'),
      main: el.querySelector('.plane.main'),
      back: el.querySelector('.plane.back'),
      phone: el.querySelector('.plane.phone'),
      caption: el.querySelector('.caption'),
      sheens: [...el.querySelectorAll('.sheen')],
    }));
    render();
  }

  function render() {
    frame = 0;
    if (!on) return;
    const vh = innerHeight;
    // Read every position first, then write, so the browser lays out once.
    const rects = chapters.map(c => c.el.getBoundingClientRect());
    tilt.x += (tilt.tx - tilt.x) * .08;
    tilt.y += (tilt.ty - tilt.y) * .08;
    chapters.forEach((c, i) => {
      const r = rects[i];
      if (r.bottom < -vh * .2 || r.top > vh * 1.2) return;
      // t runs 0 to 1 from "chapter top enters the bottom of the screen" to "stage lets go".
      const t = clamp((vh - r.top) / r.height);
      // The first chapter is already on screen at the top of the page, so it starts later on.
      const settle = ease(c.first ? span(t, .12, .48) : span(t, .04, .54));
      const away = ease(span(t, .88, 1));
      const rest = 1 - settle;

      c.main.style.transform =
        `translate3d(0, ${(rest * 16 - away * 4) * vh / 100}px, ${rest * -340 - away * 240}px) ` +
        `rotateX(${rest * 36 - away * 8}deg) rotateY(${c.side * (rest * -26 + away * 7)}deg) rotateZ(${c.side * rest * 2}deg)`;
      c.main.style.opacity = (0.3 + 0.7 * settle) * (1 - away * .9);

      if (c.back) {
        const b = ease(span(t, 0, .46));
        c.back.style.transform =
          `translate3d(${c.side * (-11 - (1 - b) * 10)}%, ${-13 - (1 - b) * 8}%, ${-260 - (1 - b) * 260}px) ` +
          `rotateX(${(1 - b) * 30}deg) rotateY(${c.side * (1 - b) * -20}deg) scale(.88)`;
        c.back.style.opacity = (0.55 * b) * (1 - away);
      }
      if (c.phone) {
        const p = ease(span(t, .22, .62));
        c.phone.style.transform =
          `translate3d(${c.side * (1 - p) * 60}%, ${(1 - p) * 40 - away * 10}%, ${120 + (1 - p) * 160}px) ` +
          `rotateY(${c.side * (1 - p) * -34}deg) rotateX(${(1 - p) * 12}deg) rotateZ(${c.side * (1 - p) * 9}deg)`;
        c.phone.style.opacity = p * (1 - away * .7);
      }

      const show = ease(span(t, .5, .62)) * (1 - ease(span(t, .86, .94)));
      c.caption.style.opacity = show;
      // A hidden caption skips its glass blur entirely.
      c.caption.style.visibility = show > 0.001 ? 'visible' : 'hidden';
      c.caption.style.transform = `translate3d(0, ${(1 - show) * 28}px, 0)`;

      // Signature moment: one soft light sweep across the glass as the section lands.
      const sweep = span(t, .53, .74);
      const glow = Math.sin(Math.PI * sweep);
      for (const s of c.sheens) {
        s.style.transform = `translateX(${-130 + sweep * 400}%) skewX(-14deg)`;
        s.style.opacity = glow;
      }

      c.rig.style.transform = `rotateX(${tilt.y * -3}deg) rotateY(${tilt.x * 4}deg)`;
    });
    // Keep easing the pointer tilt until it settles.
    if (Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > .002) schedule();
  }
  function schedule() { if (!frame && on) frame = requestAnimationFrame(render); }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pointermove', e => {
    if (!finePointer.matches) return;
    tilt.tx = e.clientX / innerWidth * 2 - 1;
    tilt.ty = e.clientY / innerHeight * 2 - 1;
    schedule();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tilt.tx = tilt.ty = 0; schedule(); });
  reduce.addEventListener?.('change', () => (reduce.matches ? disable() : enable()));
  clearGlass.addEventListener?.('change', () => on && root.classList.toggle('refract', chromium && !clearGlass.matches));

  enable();
})();
