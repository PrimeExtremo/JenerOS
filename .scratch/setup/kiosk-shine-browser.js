window.addEventListener('load', async () => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pref = (name, value) => {
    const entries = window.fixturePreferences[`(prefers-${name}: reduce)`] || [];
    entries.forEach(query => query.set(value));
  };
  const noLoops = () => {
    // Check every element and its pseudo-elements, not just today's wallpaper.
    for (const el of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const css = getComputedStyle(el, pseudo);
        assert(!css.animationIterationCount.split(',').some(n => n.trim() === 'infinite') || css.animationName === 'none',
          'No infinite CSS animation: ' + el.tagName + '.' + el.className + (pseudo || ''));
      }
    }
    for (const a of document.getAnimations()) {
      assert(a.effect.getTiming().iterations !== Infinity, 'No infinite Web Animation, including full-screen elements');
    }
  };
  const still = async () => {
    await delay(60); // Allow native finish/cancel callbacks to release effects.
    noLoops();
    assert(document.getAnimations().length === 0, 'Idle kiosk has no animation effects left: ' + document.getAnimations().map(a => a.constructor.name + '/' + a.effect.target?.id + '/' + a.transitionProperty).join(', '));
  };
  try {
    assert(BoxUI.local, 'Actual loopback URL selects kiosk path');
    const screen = document.body.classList.contains('screen-page');
    const card = document.querySelector('#wizard, #loginForm, .screen-info');
    const css = getComputedStyle(card);
    assert(css.backdropFilter === 'none' && (!css.webkitBackdropFilter || css.webkitBackdropFilter === 'none'), 'Card has no backdrop blur');
    assert(css.backgroundColor.startsWith('rgb('), 'Card tint is opaque');
    assert(!document.querySelector('.wallpaper-shine'), 'Kiosk never creates full-screen masked light');
    noLoops();
    if (screen) {
      assert(!document.querySelector('.card-shine') && !window.OnboardingShine, 'Permanent screen has no shine controller');
      await delay(400); // Let initial API-driven button state transitions settle.
      await still();
    } else {
      const wallpaper = document.querySelector('.desktop-wallpaper');
      assert(getComputedStyle(wallpaper, '::after').animationName === 'none', 'Full-screen wallpaper has no animation');
      const clip = document.querySelector('.card-shine'), light = clip.firstElementChild;
      assert(light.offsetWidth <= 128 && light.offsetHeight === 2, 'Only a tiny border light moves');
      assert(getComputedStyle(clip).pointerEvents === 'none' && clip.getAttribute('aria-hidden') === 'true', 'Sweep ignores input/accessibility');
      for (const el of [clip, light]) {
        const style = getComputedStyle(el);
        assert(style.filter === 'none' && style.backdropFilter === 'none' && style.maskImage === 'none', 'Border light has no filter, blur or mask');
      }
      const checkSweep = () => {
        const a = light.getAnimations()[0];
        assert(a && a.effect.getTiming().iterations === 1 && a.effect.getTiming().duration <= 2000, 'One gentle sweep, at most two seconds');
        for (const frame of a.effect.getKeyframes()) assert(Object.keys(frame).every(key => ['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity'].includes(key)), 'Only transform/opacity change');
        return a;
      };
      if (mode === 'native') checkSweep();
      else assert(!light.getAnimations().length, 'Reduced preference suppresses initial sweep');
      await delay(2000);
      await still();
      pref('reduced-motion', false); pref('reduced-transparency', false);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('pageshow'));
      document.dispatchEvent(new Event('visibilitychange'));
      await still(); // None of these may restart lighting on an idle kiosk.
      if (card.id === 'wizard') {
        document.getElementById('acceptedPrivacy').click();
        document.getElementById('next').click();
        await delay(350);
        assert(!document.querySelector('[data-step="1"]').hidden, 'Real Continue changes step');
        checkSweep();
        await delay(2000);
        await still();
        // Input changes on the same step must not restart a sweep.
        document.getElementById('username').dispatchEvent(new Event('input', { bubbles: true }));
        await still();
      }
      for (const name of ['reduced-motion', 'reduced-transparency']) {
        window.OnboardingShine.stepChanged(); checkSweep();
        pref(name, true); await still();
        window.OnboardingShine.stepChanged(); await still();
        pref(name, false); await still();
      }
      window.OnboardingShine.stepChanged(); checkSweep();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange')); await still();
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange')); await still();
      window.OnboardingShine.stepChanged(); checkSweep();
      window.dispatchEvent(new Event('pagehide')); await still();
    }
    parent.postMessage({ ok: true }, '*');
  } catch (error) { parent.postMessage({ error: error.stack }, '*'); }
});
