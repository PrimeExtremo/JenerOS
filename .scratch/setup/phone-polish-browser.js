window.addEventListener('load', async () => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const $ = id => document.getElementById(id);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const rect = el => el.getBoundingClientRect();
  const compact = innerWidth <= 680 || (innerHeight <= 500 && innerWidth <= 960);
  const overflow = label => assert(document.documentElement.scrollWidth <= innerWidth + 1, label + ': page overflow ' + document.documentElement.scrollWidth + '/' + innerWidth);
  const sheet = el => {
    const r = rect(el);
    assert(r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, el.id + ': sheet fits screen ' + JSON.stringify(r));
    if (compact) {
      assert(r.height <= innerHeight * .85 + 1 && Math.abs(r.bottom - innerHeight) < 2, el.id + ': bottom aligned, at most 85dvh');
      // Setup sheets draw the grabber with ::before; dashboard sheets use a real, draggable .sheet-grabber.
      const grab = el.querySelector(':scope > .sheet-grabber');
      assert(getComputedStyle(el, '::before').content !== 'none' || (grab && grab.getClientRects().length), el.id + ': grabber');
    }
  };
  try {
    if (mode === 'large-text') document.documentElement.style.fontSize = '200%';
    await window.JenerIconsReady;
    await pause(750);
    overflow('Initial');
    for (const use of document.querySelectorAll('use[href^="#i-"]')) {
      const symbol = document.querySelector(use.getAttribute('href'));
      assert(symbol && symbol.getAttribute('viewBox') === '0 0 24 24', 'Shared symbol ' + use.getAttribute('href'));
      assert(symbol.getAttribute('stroke-width') === '1.75', 'Consistent weight');
      assert(use.closest('svg').getAttribute('aria-hidden') === 'true', 'Decorative SVG hidden');
      // Icons on hidden steps/sheets, or the deliberately hidden half of a toggle, don't paint.
      const svg = use.closest('svg');
      const shown = svg.getClientRects().length && getComputedStyle(svg).visibility !== 'hidden';
      if (shown) assert(use.getBBox().width > 0, 'Glyph paints: ' + use.getAttribute('href'));
    }
    if ($('loginForm')) {
      const fields = document.querySelector('.account-fields');
      assert(Math.abs(rect(fields).width - rect($('loginUsername')).width) < 1, 'Full width username');
      const form = $('loginForm'), style = getComputedStyle(form);
      assert(Math.abs(rect(fields).width - (form.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))) < 2, 'Full card width even on desktop');
      assert(rect($('loginPassword')).height >= 48 && parseFloat(getComputedStyle($('loginPassword')).fontSize) >= 16, 'No input zoom; 48px');
      $('showPassword').click();
      assert($('loginPassword').type === 'text' && $('showPassword').getAttribute('aria-pressed') === 'true' && $('showPassword').getAttribute('aria-label') === 'Hide password', 'Password eye exposes state');
      assert($('showPassword').querySelectorAll('svg').length === 2, 'Toggle preserves icon');
      $('showPassword').click(); assert($('loginPassword').type === 'password', 'Password hides again');
      if (compact && mode !== 'large-text') assert(rect($('signIn')).bottom <= innerHeight && rect($('signIn')).bottom > innerHeight - 100, 'Reachable primary action');
    } else if ($('wizard')) {
      $('privacyLink').click(); await pause(50); sheet($('privacySheet'));
      $('privacyClose').click(); await pause(20);
      $('phoneCard').click(); sheet($('phoneSheet')); $('phoneClose').click(); await pause(20);
      $('acceptedPrivacy').click(); $('next').click(); await pause(600);
      assert(!document.querySelector('[data-step="1"]').hidden, 'Account step');
      document.querySelector('.box-options').open = true;
      $('keymapButton').click(); await pause(20);
      if (compact) {
        sheet($('pickerSheet'));
        assert($('pickerSheet').contains(document.activeElement), 'Picker owns focus');
        $('keymapList').querySelector('[role="option"]').click(); await pause(20);
        assert(!$('pickerSheet').open && document.activeElement === $('keymapButton'), 'Pick closes and returns focus');
        $('timezoneSheetButton').click(); sheet($('pickerSheet'));
        assert(document.activeElement === $('zoneSearch'), 'Timezone search focus');
        $('pickerClose').click(); await pause(20);
        assert(document.activeElement === $('timezoneSheetButton'), 'Timezone focus return');
      } else $('keymapButton').click();
      overflow('Account with options');
      for (const el of document.querySelectorAll('.field input:not([type="hidden"])')) {
        if (!el.getClientRects().length) continue;
        assert(rect(el).height >= 48 && parseFloat(getComputedStyle(el).fontSize) >= 16, 'Field size ' + el.id);
      }
    } else {
      assert(document.querySelectorAll('.desktop-tile').length >= 6, 'Dashboard tiles');
      document.querySelector('[data-settings="general"]').click(); await pause(450); sheet($('settingsWindow'));
      assert($('settingsWindow').scrollWidth <= $('settingsWindow').clientWidth + 1, 'Settings no overflow');
      $('closeSettings').click(); await pause(300);
      $('addApp').click(); await pause(450); sheet($('storeWindow'));
      assert($('storeWindow').scrollWidth <= $('storeWindow').clientWidth + 1, 'Store no overflow');
      for (const use of $('storeWindow').querySelectorAll('use')) assert(document.querySelector(use.getAttribute('href')), 'Store symbol resolved');
    }
    overflow('Final');
    parent.postMessage({ok:true}, '*');
  } catch (error) { parent.postMessage({error:error.message}, '*'); }
});
