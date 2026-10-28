// Starts the JenerOS Glass board, scaled to fit the screen.
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const fit = (el, w, h) => { el.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / w, innerHeight / h)})`; };
  DC.mount('Main', stage);
  const resize = () => fit(stage, 1440, 900);
  addEventListener('resize', resize); resize();

  // Owner sign-in still applies: a 401 sends people to the login page.
  addEventListener('DOMContentLoaded', () => { window.JenerSession?.fetch('/api/auth/session').catch(() => {}); });

  // Boot splash once per browser session.
  let seen = false;
  try { seen = sessionStorage.getItem('jeneros.splash') === '1'; sessionStorage.setItem('jeneros.splash', '1'); } catch { /* Show it. */ }
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'dc-splash';
  const inner = document.createElement('div');
  inner.style.cssText = 'width:1440px;height:900px;flex:none';
  wrap.append(inner); document.body.append(wrap);
  const host = DC.mount('Splash', inner);
  const sresize = () => { inner.style.transform = `scale(${Math.max(innerWidth / 1440, innerHeight / 900)})`; };
  addEventListener('resize', sresize); sresize();
  const end = () => { wrap.classList.add('done'); setTimeout(() => { host.destroy(); wrap.remove(); }, 700); };
  wrap.addEventListener('click', end);
  setTimeout(end, 9600);
})();
