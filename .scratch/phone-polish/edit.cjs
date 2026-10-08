const fs = require('fs');
const dir = '[DASHBOARD]/';
const read = f => fs.readFileSync(dir + f, 'utf8');
const write = (f, s) => fs.writeFileSync(dir + f, s);
const glyphs = {
  files: '<path d="M3 8V6a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8h18"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>',
  settings: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7 8h3m4 0h3M7 16h6m4 0h0"/><circle cx="12" cy="8" r="2"/><circle cx="15" cy="16" r="2"/>',
  photos: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="15.5" cy="8" r="1.5"/><path d="m3 16 5-5 6 7 3-3 4 4"/>',
  backup: '<path d="M4 9a8 8 0 1 1 0 7M3 4v5h5M12 7v5l3 2"/>',
  machines: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/>',
  tv: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8m-4-4v4m-2-13 5 3-5 3Z"/>',
  drive: '<path d="m4 6 2-3h12l2 3 1 8M3 14l1-8h16"/><rect x="3" y="12" width="18" height="9" rx="3"/><path d="M7 16.5h6m4 0h.01"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M9 21v-7h6v7"/>',
  relay: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z M8 12l3 3 5-6"/>',
  disk: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="10" r="4"/><path d="m12 10 4-4M8 17h5m3 0h.01"/>',
  net: '<rect x="8" y="3" width="8" height="6" rx="2"/><path d="M12 9v5M5 17v-3h14v3"/><rect x="2" y="17" width="6" height="4" rx="1.5"/><rect x="16" y="17" width="6" height="4" rx="1.5"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 6 0 0 1 16 0v2"/>',
  power: '<path d="M12 3v9M7 5a9 9 0 1 0 10 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18M9 5.5a11 11 0 0 1 3-.5c7 0 10 7 10 7a17 17 0 0 1-3 4M6 6.5A18 18 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5-1M10 10a3 3 0 0 0 4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  next: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
  chip: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4m5-4v4m5-4v4M6 18v3m12-3v3"/>',
  avatar: '<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 8v2m8-2v2m-9 4q5 6 10 0"/>',
  'store-compass': '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  'store-spark': '<path d="M12 3c1 5 4 8 9 9-5 1-8 4-9 9-1-5-4-8-9-9 5-1 8-4 9-9Z"/>',
  'store-code': '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-14-4 18"/>',
};
glyphs.system = glyphs.settings;
glyphs['store-grid'] = glyphs.apps;
glyphs['store-back'] = glyphs.left;
let index = read('index.html');
const start = index.indexOf('  <svg width="0" height="0" style="position:absolute"');
const end = index.indexOf('</svg>', start) + 6;
const mark = index.slice(start, end).match(/<symbol id="j-mark"[\s\S]*?<\/symbol>/)[0];
const sprite = '<svg id="jener-icons" width="0" height="0" class="svg-defs" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">\n    ' + mark + '\n' + Object.entries(glyphs).map(([id, body]) => `    <symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`).join('\n') + '\n  </svg>';
index = index.slice(0, start) + sprite + index.slice(end);
const svg = id => `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${id}"/></svg>`;
index = index.replace(/viewBox="0 0 (?:28 28|64 64)"/g, 'viewBox="0 0 24 24"');
index = index.replace(/(<button[^>]+aria-label="[^"]+"[^>]*>)([×+‹›])(<\/button>)/g, (_, a, c, b) => a + svg({'×':'close','+':'plus','‹':'left','›':'right'}[c]) + b);
index = index.replace(/<span aria-hidden="true">›<\/span>/g, svg('right'));
index = index.replace(/<svg(?![^>]*aria-hidden)([^>]*><use href="#(?:i-|j-)[^>]+\/><\/svg>)/g, '<svg aria-hidden="true"$1');
write('index.html', index);
for (const f of ['index.html', 'setup.html', 'login.html']) {
  let s = read(f).replace('width=device-width, initial-scale=1', 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content');
  s = s.replace('<script src="ui-compat.js" defer></script>', '<script src="ui-compat.js" defer></script>\n  <script src="phone-layout.js" defer></script>' + (f !== 'index.html' ? '\n  <script src="icons.js" defer></script>' : ''));
  write(f, s);
}
let login = read('login.html');
login = login.replace(/(<input id="loginPassword"[^>]+>)/, '<div class="password-field">$1<button id="showPassword" class="password-toggle" type="button" aria-label="Show password" aria-pressed="false">' + svg('eye') + svg('eye-off') + '</button></div>');
login = login.replace(/\s*<button id="showPassword" class="pill"[^>]*>Show password<\/button>/, '');
login = login.replace('<span aria-hidden="true">→</span>', svg('next'));
write('login.html', login);
write('login.js', read('login.js').replace("$('showPassword').textContent = show ? 'Hide password' : 'Show password';", "$('showPassword').setAttribute('aria-label', show ? 'Hide password' : 'Show password');"));
let setup = read('setup.html');
setup = setup.replace(/<svg class="setup-logo"[\s\S]*?<\/svg>/, '<img class="setup-logo" src="logo.svg" alt="" width="88" height="88">');
setup = setup.replace(/  <svg width="0" height="0" aria-hidden="true" class="svg-defs">[\s\S]*?<\/svg>\n/, '');
let n = 0;
setup = setup.replace(/(<article class="feature-tile">)<svg[\s\S]*?<\/svg>/g, (_, a) => a + svg(['disk','files','relay','apps'][n++]));
setup = setup.replace('<svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>', svg('check'));
setup = setup.replace(/<span aria-hidden="true">&#8964;<\/span>/g, svg('down'));
setup = setup.replace('<span aria-hidden="true">→</span></button></div>', '<span class="continue-label">Continue</span>' + svg('next') + '</button></div>');
write('setup.html', setup);
write('app.js', read('app.js').replace(/viewBox="0 0 28 28"/g, 'viewBox="0 0 24 24"').replace("name: 'Files', icon: 'drive'", "name: 'Files', icon: 'files'"));
write('store.js', read('store.js').replace(/<svg width="0" height="0" style="position:absolute" aria-hidden="true">[\s\S]*?<\/svg>\n/, '').replace(/viewBox="0 0 28 28"/g, 'viewBox="0 0 24 24"').replace(/>×<\/button>/g, ">${use('i-close')}</button>"));
