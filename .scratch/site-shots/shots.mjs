// Captures website screenshots of the JenerOS Glass dashboard through headless Chrome.
// Needs the dashboard served at http://127.0.0.1:8099. Writes 2x PNGs to ./out.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out'); mkdirSync(out, { recursive: true });
const port = 9334;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars',
  `--user-data-dir=${join(out, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true });
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name + '.png'), Buffer.from(s.result.data, 'base64')); console.log(name); };

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8099/' });
await sleep(800);
await js(`sessionStorage.setItem('jeneros.splash','1'); location.reload()`);
await sleep(2500);
const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
const clickText = (scope, text) => js(`[...document.querySelectorAll(${JSON.stringify(scope)})].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);

for (const theme of ['dark', 'light']) {
  const sfx = theme === 'light' ? '-light' : '';
  if (theme === 'light') {
    await click('[aria-label="Settings"]'); await sleep(1200);
    await js(`[...document.querySelectorAll('[data-dc="Settings"] nav button')].find(b => b.textContent.includes('Appearance')).click()`); await sleep(500);
    await clickText('[data-dc="Settings"] button', 'Light'); await sleep(1800);
    await click('[aria-label="Close settings"]'); await sleep(1400);
  }
  await js(`document.documentElement.style.setProperty('--cx','0deg'); document.documentElement.style.setProperty('--cy','0deg')`);
  await shot('glass-home' + sfx);
  await click('[aria-label="Settings"]'); await sleep(1400); await shot('glass-settings' + sfx);
  await js(`[...document.querySelectorAll('[data-dc="Settings"] nav button')].find(b => b.textContent.includes('Apps')).click()`); await sleep(400);
  await click('[aria-label="Manage Immich"]'); await sleep(1000); await shot('glass-apps' + sfx);
  await click('[aria-label="Close settings"]'); await sleep(1300);
  await click('[aria-label="App Store"]'); await sleep(1600); await shot('glass-store' + sfx);
  await click('[aria-label="Close App Store"]'); await sleep(1300);
}
ws.close(); proc.kill();
