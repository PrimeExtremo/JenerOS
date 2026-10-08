// Setup choices use page-owned lists so Cog never opens a native select popup.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pickers = new Map();
  let opened;
  for (const id of ['keymap', 'interface', 'timezone']) {
    const field = $(id), list = $(id + 'List'), button = $(id + 'Button');
    const control = button || list;
    const picker = { field, list, button, items: [], active: -1, prefix: '', typedAt: 0 };
    pickers.set(id, picker);
    function activate(index) {
      picker.active = index;
      picker.items.forEach((item, i) => {
        item.node.classList.toggle('is-active', i === index);
        item.node.setAttribute('aria-selected', String(item.value === field.value));
      });
      const item = picker.items[index];
      if (item && (!button || !list.hidden)) {
        control.setAttribute('aria-activedescendant', item.node.id);
        item.node.scrollIntoView({ block: 'nearest' });
      } else control.removeAttribute('aria-activedescendant');
    }
    function commit() {
      const item = picker.items[picker.active];
      if (!item) return;
      field.value = item.value;
      if (button) $(id + 'Text').textContent = item.name;
      activate(picker.active);
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function close() {
      if (!button) return;
      list.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.removeAttribute('aria-activedescendant');
      if (opened === picker) opened = null;
    }
    function open() {
      if (!button || !picker.items.length) return;
      if (opened && opened !== picker) opened.close();
      opened = picker;
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      const selected = picker.items.findIndex(item => item.value === field.value);
      activate(selected < 0 ? 0 : selected);
    }
    Object.assign(picker, { activate, commit, close, open });
    button?.addEventListener('click', () => list.hidden ? open() : close());
    control.addEventListener('keydown', e => {
      // Stop box-ui.js's directional navigation from stealing list keys.
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const navigation = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (e.key === 'Escape') {
        if (!button) { e.preventDefault(); e.stopPropagation(); $('zoneSearch').focus(); return; }
        if (button && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
        return;
      }
      if (e.key === 'Tab') { if (button && !list.hidden) { commit(); close(); } return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        if (button && list.hidden) open(); else { commit(); close(); }
        return;
      }
      const printable = e.key.length === 1;
      if (!navigation.includes(e.key) && !printable) return;
      e.preventDefault(); e.stopPropagation();
      if (button && list.hidden) { open(); if (navigation.includes(e.key)) return; }
      if (!picker.items.length) return;
      let index = picker.active;
      if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = picker.items.length - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') index = Math.min(index + 1, picker.items.length - 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') index = Math.max(index - 1, 0);
      else {
        const now = Date.now();
        picker.prefix = now - picker.typedAt > 700 ? e.key.toLowerCase() : picker.prefix + e.key.toLowerCase();
        picker.typedAt = now;
        const prefix = [...picker.prefix].every(c => c === picker.prefix[0]) ? picker.prefix[0] : picker.prefix;
        for (let offset = 1; offset <= picker.items.length; offset++) {
          const candidate = (index + offset) % picker.items.length;
          if (picker.items[candidate].name.toLowerCase().startsWith(prefix)) { index = candidate; break; }
        }
      }
      activate(index);
      if (!button) commit();
    });
    list.addEventListener('click', e => {
      const index = picker.items.findIndex(item => item.node === e.target.closest('[role="option"]'));
      if (index < 0) return;
      activate(index); commit(); close(); control.focus();
    });
    // Keep DOM focus on the combobox while choosing a pointer option.
    list.addEventListener('mousedown', e => e.preventDefault());
  }
  $('zoneSearch').addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault(); e.stopPropagation();
    const picker = pickers.get('timezone');
    picker.list.focus();
    if (picker.active < 0 && picker.items.length) picker.activate(0);
  });
  document.addEventListener('click', e => {
    if (opened && !opened.button.parentElement.contains(e.target)) opened.close();
  });
  document.addEventListener('focusin', e => {
    if (opened && !opened.button.parentElement.contains(e.target)) opened.close();
  });
  window.SetupChoices = {
    set(field, values, selected, preserve = false) {
      const picker = pickers.get(field.id);
      picker.close();
      picker.prefix = ''; picker.typedAt = 0;
      picker.items = values.map((value, i) => {
        const item = { value: value.id || value, name: value.name || value.replace(/_/g, ' ') };
        item.node = document.createElement('div');
        item.node.id = field.id + '-option-' + i;
        item.node.setAttribute('role', 'option');
        item.node.className = 'setup-list-option';
        item.node.textContent = item.name;
        return item;
      });
      field.value = preserve ? selected : picker.items.some(item => item.value === selected) ? selected : picker.items[0]?.value || '';
      picker.list.replaceChildren(...picker.items.map(item => item.node));
      if (!picker.items.length) {
        const empty = document.createElement('p');
        empty.className = 'note'; empty.textContent = 'No choices found.';
        picker.list.append(empty);
      }
      if (picker.button) {
        picker.button.setAttribute('aria-disabled', String(!picker.items.length));
        $(field.id + 'Text').textContent = picker.items.find(item => item.value === field.value)?.name || 'No connections available';
      }
      picker.activate(picker.items.findIndex(item => item.value === field.value));
    },
  };

  const sheet = $('privacySheet');
  let loaded = false, loading = false;
  $('privacyDownload').hidden = BoxUI.local;
  async function loadPolicy() {
    if (loaded || loading) return;
    loading = true;
    $('privacyRetry').hidden = true;
    $('privacyStatus').textContent = 'Loading the policy…';
    $('privacyContent').setAttribute('aria-busy', 'true');
    try {
      const res = await fetch('privacy.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Policy unavailable');
      const article = new DOMParser().parseFromString(await res.text(), 'text/html').querySelector('article');
      if (!article) throw new Error('Policy missing');
      article.className = 'privacy-policy';
      article.querySelector('h1')?.remove();
      // Contact remains readable on the kiosk, without launching another app.
      if (BoxUI.local) article.querySelectorAll('a').forEach(link => link.removeAttribute('href'));
      $('privacyContent').replaceChildren(document.importNode(article, true));
      loaded = true;
      if (sheet.open && document.activeElement === $('privacyRetry')) $('privacyClose').focus();
    } catch {
      $('privacyStatus').textContent = 'The policy could not load. Please try again.';
      $('privacyRetry').hidden = false;
    } finally {
      loading = false;
      $('privacyContent').setAttribute('aria-busy', 'false');
    }
  }
  $('privacyLink').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    JenerUI.open(sheet);
    $('privacyClose').focus();
    loadPolicy();
  });
  $('privacyClose').addEventListener('click', () => JenerUI.close(sheet));
  $('privacyRetry').addEventListener('click', loadPolicy);
  sheet.addEventListener('cancel', e => { e.preventDefault(); JenerUI.close(sheet); });
  sheet.addEventListener('close', () => $('acceptedPrivacy').focus());
  // The modal owns directional navigation; box-ui may only visit this sheet.
  sheet.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.stopPropagation();
    if (e.target === $('privacyContent')) return;
    const controls = [...sheet.querySelectorAll('a[href], button:not([hidden])')].filter(el => !el.hidden);
    const index = controls.indexOf(document.activeElement);
    if (index >= 0) {
      e.preventDefault();
      controls[(index + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) + controls.length) % controls.length].focus();
    }
  });
})();
