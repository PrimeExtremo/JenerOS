// Small, optional lighting accents. The wallpaper and card stay stationary.
// Remote browsers sample paused Web Animations at <=30fps. Local WPE gets
// only a finite border sweep: no wallpaper layer and no recurring JS clock.
(() => {
  // Setup/login know their kiosk state (BoxUI); the dashboard falls back to the address.
  const local = window.BoxUI ? !!window.BoxUI.local
    : typeof location !== 'undefined' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (local) document.documentElement.classList.add('box-local');
  const wallpaper = document.querySelector('.desktop-wallpaper');
  // The dashboard has no single card: it gets only the wallpaper light.
  const card = document.querySelector('#wizard, #loginForm');
  if (!wallpaper || typeof (card || wallpaper).animate !== 'function' || typeof matchMedia !== 'function') return;
  if (local && !card) return;
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
  const sweep = local ? null : layer(wallpaper, 'wallpaper-shine');
  const edge = card ? layer(card, 'card-shine') : null;
  if (local) {
    let active = null;
    const stopSweep = () => {
      if (active) { active.onfinish = null; active.cancel(); active = null; }
    };
    const playSweep = () => {
      stopSweep();
      if (document.hidden || preferences.some(query => query.matches)) return;
      try {
        active = edge.animate([
          { transform: 'translateX(-128px)', opacity: 0 },
          { transform: `translateX(${card.clientWidth * .4}px)`, opacity: .2, offset: .5 },
          { transform: `translateX(${card.clientWidth}px)`, opacity: 0 }
        ], { duration: 1800, iterations: 1, easing: 'ease-in-out' });
        active.onfinish = stopSweep;
      } catch { stopSweep(); }
    };
    // Returning to the page, resizing or changing preferences never starts a loop.
    document.addEventListener('visibilitychange', stopSweep);
    window.addEventListener('pagehide', stopSweep);
    preferences.forEach(query => {
      if (query.addEventListener) query.addEventListener('change', stopSweep);
      else if (query.addListener) query.addListener(stopSweep);
    });
    window.OnboardingShine = { stepChanged: playSweep };
    playSweep();
    return;
  }
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
        if (edge) animate(edge, [
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
