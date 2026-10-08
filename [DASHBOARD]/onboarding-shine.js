// Small, optional lighting accents. The wallpaper and card stay stationary.
// Sample paused Web Animations at <=30fps, including on software-rendered WPE.
(() => {
  const wallpaper = document.querySelector('.onboarding-page .desktop-wallpaper');
  const card = document.querySelector('#wizard, #loginForm');
  if (!wallpaper || !card || typeof card.animate !== 'function' || typeof matchMedia !== 'function') return;
  const preferences = ['prefers-reduced-motion', 'prefers-reduced-transparency'].map(name => matchMedia(`(${name}: reduce)`));
  preferences.push(matchMedia('(prefers-contrast: more)'), matchMedia('(forced-colors: active)'));
  const layers = [], animations = [];
  let timer = null, elapsed = 0, last = 0;
  function layer(parent, className) {
    const clip = document.createElement('span'), light = document.createElement('span');
    clip.className = className; clip.setAttribute('aria-hidden', 'true');
    clip.appendChild(light); parent.appendChild(clip); layers.push(clip);
    return light;
  }
  const sweep = layer(wallpaper, 'wallpaper-shine');
  const edge = layer(card, 'card-shine');
  function stop() {
    clearTimeout(timer); timer = null;
  }
  function tick() {
    const now = performance.now();
    elapsed += now - last; last = now;
    for (const animation of animations) animation.currentTime = elapsed;
    timer = setTimeout(tick, 34);
  }
  function sync() {
    stop();
    const off = preferences.some(query => query.matches);
    for (const clip of layers) clip.hidden = off;
    if (off) {
      animations.splice(0).forEach(animation => animation.cancel()); elapsed = 0;
      return;
    }
    if (!animations.length) {
      const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim();
      const animate = (el, frames, duration) => {
        const animation = el.animate(frames, { duration, iterations: Infinity, easing });
        animation.pause(); animation.currentTime = elapsed; animations.push(animation);
      };
      try {
        animate(sweep, [
          { transform: 'translate(-120px, 80px)', opacity: 0 },
          { transform: 'translate(0, 0)', opacity: .12, offset: .45 },
          { transform: 'translate(120px, -80px)', opacity: 0 }
        ], 16000);
        animate(edge, [
          { transform: 'translateX(-128px)', opacity: 0 },
          { transform: `translateX(${card.clientWidth * .4}px)`, opacity: .2, offset: .5 },
          { transform: `translateX(${card.clientWidth}px)`, opacity: 0 }
        ], 18000);
      } catch {
        // Partial/older animation implementations get the original static art.
        stop(); animations.splice(0).forEach(animation => animation.cancel());
        layers.forEach(clip => { clip.hidden = true; }); return;
      }
    }
    if (!document.hidden) { last = performance.now(); timer = setTimeout(tick, 34); }
  }
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', () => {
    animations.splice(0).forEach(animation => animation.cancel()); sync();
  });
  preferences.forEach(query => {
    if (query.addEventListener) query.addEventListener('change', sync);
    else if (query.addListener) query.addListener(sync);
  });
  sync();
})();
