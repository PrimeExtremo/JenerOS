// JenerOS Glass home: greeting, meters, status pill, search, widget editing,
// theme paint and the boot splash. app.js still owns every API call.
(() => {
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const J = 'M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z';
  const DOT = 'M144 208H176V240H144Z';
  let layout = { order: [], wide: [] };
  try { layout = { ...layout, ...JSON.parse(localStorage.getItem('jeneros.glass')) }; } catch { /* Defaults. */ }
  if (!Array.isArray(layout.order)) layout.order = [];
  if (!Array.isArray(layout.wide)) layout.wide = [];
  const saveLayout = () => { try { localStorage.setItem('jeneros.glass', JSON.stringify(layout)); } catch { /* Kept for this visit. */ } };

  // Refraction lens: Chromium supports SVG filters in backdrop-filter.
  if (/Chrome\//.test(navigator.userAgent)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="n"/><feGaussianBlur in="n" stdDeviation="3" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.append(svg);
    document.documentElement.classList.add('lg-lens');
  }

  // Boot splash once per browser session.
  let seen = false;
  try { seen = sessionStorage.getItem('jeneros.splash') === '1'; sessionStorage.setItem('jeneros.splash', '1'); } catch { /* Show it. */ }
  if (!seen && !reduce) {
    const s = document.createElement('div');
    s.className = 'lg-splash'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<div><div class="lg-tile"><svg viewBox="0 0 512 512"><path class="lg-draw" pathLength="1" d="${J}"/><path class="lg-draw" pathLength="1" d="${DOT}"/><path class="lg-fill" d="${J}"/><path class="lg-fill" d="${DOT}"/></svg></div><span class="lg-word">JenerOS</span><span class="lg-bar"><i></i></span></div>`;
    s.addEventListener('click', () => s.remove());
    s.addEventListener('animationend', e => { if (e.target === s) s.remove(); });
    document.body.append(s);
  }

  // Theme paint: brush strokes in the new color cover the screen, then the theme switches.
  const prefs = window.DesktopPreferences;
  if (prefs) {
    const save = prefs.save.bind(prefs);
    let busy = false;
    prefs.save = () => {
      const next = prefs.value.theme;
      if (reduce || busy || next === document.documentElement.dataset.theme) return save();
      busy = true;
      const ink = next === 'light' ? ['#f6f1e7', '#efe6d6'] : ['#1f1913', '#2a211a'];
      const p = document.createElement('div');
      p.className = 'lg-paint'; p.setAttribute('aria-hidden', 'true');
      for (let n = 0; n < 6; n++) {
        const i = document.createElement('i');
        i.style.top = (-8 + n * 19) + '%'; i.style.animationDelay = (n * 0.07) + 's';
        i.style.background = `linear-gradient(180deg, ${ink[1]}, ${ink[0]} 40%, ${ink[0]} 70%, ${ink[1]})`;
        p.append(i);
      }
      [12, 31, 48, 67, 84].forEach((x, n) => {
        const b = document.createElement('b');
        b.style.cssText = `left:${x}%;top:${88 - (n % 2) * 6}%;height:${40 + (n * 23) % 70}px;background:${ink[0]}`;
        p.append(b);
      });
      document.body.append(p);
      let ok = true;
      setTimeout(() => { ok = save(); }, 720);
      setTimeout(() => { p.remove(); busy = false; }, 1500);
      return ok;
    };
  }

  // Greeting, meter bars and the status pill follow what app.js writes.
  const put = (id, text) => { if ($(id).textContent !== text) $(id).textContent = text; };
  const num = id => { const m = /(\d+)%/.exec($(id)?.textContent || ''); return m ? Number(m[1]) : null; };
  function refresh() {
    const now = new Date(), h = now.getHours();
    const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const owner = $('ownerName')?.textContent.trim();
    put('homeGreeting', owner && owner !== 'Owner' ? `${part}, ${owner}` : part);
    put('homeDate', $('clockDate').textContent.replace(/, \d{4}$/, ''));
    document.querySelectorAll('[data-bar-from]').forEach(bar => { bar.style.width = (num(bar.dataset.barFrom) ?? 0) + '%'; });
    const disk = $('diskMeter').getAttribute('aria-valuenow');
    put('statusDisk', disk === null ? 'Storage —' : `Storage ${disk}% used`);
    const cpu = num('statCpu');
    put('statusCpu', cpu === null ? 'CPU —' : `CPU ${cpu}%`);
    const update = $('barUpdate');
    const text = $('updateText').textContent.trim();
    put('statusUpdate', !update.hidden ? update.textContent : /up to date/i.test(text) ? 'Up to date' : text.split('.')[0] || 'Checking for updates');
  }
  new MutationObserver(refresh).observe($('main'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-valuenow', 'hidden'] });
  ['ownerName', 'updateText', 'barUpdate'].forEach(id => new MutationObserver(refresh).observe($(id), { subtree: true, childList: true, characterData: true, attributes: true }));
  setInterval(refresh, 30000);
  refresh();

  // Search opens from the magnifier or the / key.
  const form = $('searchForm'), toggle = $('searchToggle');
  const showSearch = open => {
    form.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    if (open) $('appSearch').focus();
    else if ($('appSearch').value) { $('appSearch').value = ''; $('appSearch').dispatchEvent(new Event('input')); }
  };
  toggle.addEventListener('click', () => showSearch(form.hidden));
  document.addEventListener('keydown', e => {
    if (e.key === '/' && form.hidden && !document.activeElement?.matches('input, textarea, select') && !document.querySelector('dialog[open]')) showSearch(true);
    if (e.key === 'Escape' && !form.hidden && document.activeElement === $('appSearch') && !$('appSearch').value) { showSearch(false); toggle.focus(); }
  }, true);

  // Widget editing: wiggle, remove, move, resize, with FLIP animations.
  const grid = document.querySelector('.widgets');
  const addTile = $('widgetSettings');
  const widgets = () => [...grid.querySelectorAll(':scope > [data-widget]')];
  const shown = () => widgets().filter(w => !w.hidden);
  const snap = () => new Map(shown().map(w => [w, w.getBoundingClientRect()]));
  const flip = (before, added) => {
    if (reduce) return;
    for (const w of shown()) {
      const a = before.get(w), b = w.getBoundingClientRect();
      if (!a || w === added) {
        w.animate([{ transform: 'translateY(40px) scale(.6)', opacity: 0, filter: 'blur(8px)' }, { transform: 'scale(1.04)', opacity: 1, filter: 'blur(0)', offset: .6 }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.9,.3,1)' });
        continue;
      }
      const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) continue;
      w.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3,1.25,.5,1)' });
    }
  };
  const persist = () => {
    layout.order = widgets().map(w => w.dataset.widget);
    layout.wide = widgets().filter(w => w.classList.contains('lg-wide')).map(w => w.dataset.widget);
    saveLayout();
  };
  const byKey = new Map(widgets().map(w => [w.dataset.widget, w]));
  layout.order.filter(k => byKey.has(k)).forEach(k => grid.insertBefore(byKey.get(k), addTile));
  widgets().forEach(w => w.classList.toggle('lg-wide', layout.wide.includes(w.dataset.widget)));

  const name = w => w.querySelector('h2')?.textContent || w.getAttribute('aria-label') || w.dataset.widget;
  widgets().forEach(w => {
    const n = name(w);
    const c = document.createElement('div');
    c.className = 'lg-controls';
    c.innerHTML = `<button class="lg-remove lg-press" type="button" aria-label="Remove ${n}">−</button><span><button class="lg-press" type="button" data-move="-1" aria-label="Move ${n} earlier">‹</button><button class="lg-press" type="button" data-size aria-label="Change the size of ${n}">▭</button><button class="lg-press" type="button" data-move="1" aria-label="Move ${n} later">›</button></span>`;
    w.append(c);
    c.querySelector('.lg-remove').addEventListener('click', () => {
      const input = document.querySelector(`[data-widget-toggle="${w.dataset.widget}"]`);
      const hide = () => { const before = snap(); input.checked = false; input.dispatchEvent(new Event('change', { bubbles: true })); flip(before); };
      if (reduce || !w.animate) return hide();
      w.style.pointerEvents = 'none';
      w.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.05)', offset: .25 }, { transform: 'scale(.35) rotate(-5deg)', opacity: 0, filter: 'blur(10px)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' })
        .onfinish = e => { w.style.pointerEvents = ''; hide(); e.target.cancel(); };
    });
    c.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => {
      const list = shown(), i = list.indexOf(w), j = i + Number(btn.dataset.move);
      if (j < 0 || j >= list.length) return;
      const before = snap();
      if (j < i) grid.insertBefore(w, list[j]); else grid.insertBefore(list[j], w);
      persist(); flip(before); btn.focus();
    }));
    c.querySelector('[data-size]').addEventListener('click', e => {
      const before = snap();
      w.classList.toggle('lg-wide');
      persist(); flip(before); e.currentTarget.focus();
    });
  });
  document.querySelectorAll('[data-widget-toggle]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    const w = byKey.get(input.dataset.widgetToggle);
    if (w) requestAnimationFrame(() => flip(new Map(), w));
  }));

  const edit = $('editHome');
  const setEditing = on => {
    document.body.classList.toggle('lg-editing', on);
    edit.textContent = on ? 'Done' : 'Edit'; edit.setAttribute('aria-pressed', String(on));
  };
  edit.addEventListener('click', () => setEditing(!document.body.classList.contains('lg-editing')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('lg-editing') && !document.querySelector('dialog[open]')) setEditing(false);
  });
})();
