// Shared by the local screen and first-boot wizard. All assets stay on the box.
window.BoxUI = {
  local: ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname),
  address(ip) {
    const host = ip.includes(':') ? `[${ip}]` : ip;
    return `http://${host}${location.port && location.port !== '80' ? ':' + location.port : ''}`;
  },
  localAddress(hostname) {
    const host = (hostname || 'jeneros').toLowerCase().replace(/\.local\.?$/, '').split('.')[0];
    return this.address(host + '.local');
  },
  qr(element, text) {
    if (element.dataset.text === text) return;
    element.replaceChildren();
    new QRCode(element, { text, width: 196, height: 196, correctLevel: QRCode.CorrectLevel.L });
    element.dataset.text = text;
  },
};

// Leave native text editing, radios and select menus alone. Elsewhere the
// arrow keys move to the nearest control, as they do on the main dashboard.
document.addEventListener('keydown', (e) => {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  const here = document.activeElement;
  if (here?.matches('input, textarea, select')) return;
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  const scope = dialogs[dialogs.length - 1] || document;
  const items = [...scope.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(el => el !== here && el.getClientRects().length);
  if (!items.length) return;
  if (!here || here === document.body || here.matches('h1')) { e.preventDefault(); items[0].focus(); return; }
  const from = here.getBoundingClientRect();
  let best, score = Infinity;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - from.left - from.width / 2;
    const dy = r.top + r.height / 2 - from.top - from.height / 2;
    const along = dx * dir[0] + dy * dir[1];
    const candidate = along + Math.abs(dx * dir[1] + dy * dir[0]) * 2;
    if (along > 4 && candidate < score) { score = candidate; best = el; }
  }
  if (best) { e.preventDefault(); best.focus(); best.scrollIntoView({ block: 'nearest' }); }
});
