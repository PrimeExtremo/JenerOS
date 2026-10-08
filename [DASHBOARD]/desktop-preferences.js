// Paint saved appearance before styles load. Blocked browser storage is fine.
window.DesktopPreferences = (() => {
  const defaults = { theme: 'dark', wallpaper: 'ribbon', timezone: 'local', timeFormat: '24', avatar: 'orange', widgets: { clock: true, system: true, storage: true, network: true } };
  let saved;
  try { saved = JSON.parse(localStorage.getItem('jeneros.desktop')); } catch { /* Use defaults. */ }
  const value = { ...defaults, widgets: { ...defaults.widgets } };
  for (const [key, allowed] of Object.entries({ theme: ['dark', 'light'], wallpaper: ['ribbon', 'dune', 'plain'], timeFormat: ['24', '12'], avatar: ['orange', 'sage', 'clay'] })) {
    if (allowed.includes(saved?.[key])) value[key] = saved[key];
  }
  if (typeof saved?.timezone === 'string') {
    try { if (saved.timezone !== 'local') new Intl.DateTimeFormat('en', { timeZone: saved.timezone }); value.timezone = saved.timezone; } catch { /* Use browser timezone. */ }
  }
  for (const key of Object.keys(value.widgets)) if (typeof saved?.widgets?.[key] === 'boolean') value.widgets[key] = saved.widgets[key];
  function paint() {
    document.documentElement.dataset.theme = value.theme;
    document.documentElement.dataset.wallpaper = value.wallpaper;
    document.documentElement.dataset.avatar = value.avatar;
  }
  paint();
  return { value, save() { paint(); try { localStorage.setItem('jeneros.desktop', JSON.stringify(value)); return true; } catch { return false; } } };
})();
