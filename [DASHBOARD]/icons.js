// icons.svg mirrors the sprite in index.html. It is public, so signed-out pages
// (login, setup) can load it; index.html itself redirects to /login when signed out.
(() => {
  'use strict';
  window.JenerIconsReady = fetch('icons.svg', { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Icons unavailable');
      return response.text();
    })
    .then(source => {
      const sprite = new DOMParser().parseFromString(source, 'image/svg+xml').getElementById('jener-icons');
      if (sprite) document.body.append(document.importNode(sprite, true));
    }).catch(() => { /* Decorative only; every action has its own text label. */ });
})();
