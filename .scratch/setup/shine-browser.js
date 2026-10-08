window.addEventListener('load', async () => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const setPreference = (name, value) => {
    const entries = window.fixturePreferences[`(${name}: reduce)`];
    assert(entries && entries.length, name + ' is observed');
    entries.forEach(query => query.set(value));
  };
  try {
    await delay(400);
    const wallpaper = document.querySelector('.desktop-wallpaper');
    const clips = [...document.querySelectorAll('.wallpaper-shine, .card-shine')];
    assert(clips.length === 2, 'Both small lights created');
    const lights = clips.map(clip => clip.firstElementChild);
    const animations = () => lights.map(el => el.getAnimations()[0]);
    if (mode !== 'native') {
      assert(clips.every(el => el.hidden) && lights.every(el => !el.getAnimations().length), 'Reduced preference disables lights from first load');
      setPreference('prefers-' + mode, false); await delay(60);
    }
    assert(getComputedStyle(wallpaper, '::after').animationName === 'none', 'Full wallpaper stays still');
    assert(getComputedStyle(wallpaper, '::after').transform === 'none', 'Wallpaper has no drift transform');
    assert(getComputedStyle(clips[0]).maskImage.includes('wallpaper-shine-mask.svg') ||
      getComputedStyle(clips[0]).webkitMaskImage.includes('wallpaper-shine-mask.svg'), 'Static ribbon mask loaded');
    assert(clips.every(el => getComputedStyle(el).pointerEvents === 'none' && el.getAttribute('aria-hidden') === 'true'), 'Lights cannot intercept input or accessibility');
    assert(lights[0].offsetWidth <= 200 && lights[0].offsetHeight <= 240 && lights[1].offsetWidth <= 128 && lights[1].offsetHeight === 2, 'Animated areas bounded');
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim();
    for (const a of animations()) {
      assert(a && a.playState === 'paused', 'Manual clock prevents full-rate CSS/WAAPI animation');
      const timing = a.effect.getTiming();
      assert(timing.duration >= 12000 && timing.duration <= 20000 && timing.iterations === Infinity && timing.easing.replaceAll(' ', '') === easing.replaceAll(' ', ''), 'Slow loop uses brand easing');
      for (const frame of a.effect.getKeyframes()) assert(Object.keys(frame).every(key => ['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity'].includes(key)), 'Only transform and opacity animate');
    }
    const a = animations()[0], start = a.currentTime, sampledAt = performance.now();
    let advances = 0, previous = start;
    for (let i = 0; i < 25; i++) {
      await delay(10);
      if (a.currentTime !== previous) advances++;
      previous = a.currentTime;
    }
    assert(a.currentTime > start && advances <= Math.ceil((performance.now() - sampledAt) / 34) + 1, 'Time advances at roughly 30fps or less');
    Object.defineProperty(document, 'hidden', { configurable:true, value:true });
    document.dispatchEvent(new Event('visibilitychange'));
    const frozen = a.currentTime;
    await delay(90);
    assert(a.currentTime === frozen && document.documentElement.classList.contains('page-hidden'), 'Hidden tab fully paused');
    Object.defineProperty(document, 'hidden', { configurable:true, value:false });
    const resumedAt = performance.now();
    document.dispatchEvent(new Event('visibilitychange')); await delay(80);
    assert(a.currentTime > frozen && a.currentTime - frozen <= performance.now() - resumedAt + 2, 'Visible tab resumes without hidden-time jump');
    for (const pref of ['prefers-reduced-motion', 'prefers-reduced-transparency']) {
      setPreference(pref, true); await delay(60);
      assert(clips.every(el => el.hidden) && lights.every(el => !el.getAnimations().length), pref + ' removes all lighting animation');
      setPreference(pref, false); await delay(60);
      assert(clips.every(el => !el.hidden) && animations().every(Boolean), pref + ' change restores optional light');
    }
    parent.postMessage({ok:true}, '*');
  } catch (error) { parent.postMessage({error:error.stack}, '*'); }
});
