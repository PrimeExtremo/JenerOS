// Renders preview-916.html frame by frame through headless Chrome (CDP), then
// encodes an H.264 MP4 with ffmpeg. Usage: node render.mjs [fps] [seconds]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fps = Number(process.argv[2] || 60), seconds = Number(process.argv[3] || 10);
const frames = join(here, 'out', 'frames');
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9335;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1080,1920', '--allow-file-access-from-files', `--user-data-dir=${join(here, 'out', 'profile')}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
await send('Page.enable');
await send('Page.navigate', { url: pathToFileURL(join(here, 'preview-916.html')).href });
await sleep(2500);
const total = Math.round(fps * seconds);
for (let f = 0; f < total; f++) {
  const t = (f / fps) * 1000;
  await send('Runtime.evaluate', { expression: `seek(${t})`, awaitPromise: true });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(frames, String(f).padStart(5, '0') + '.png'), Buffer.from(shot.result.data, 'base64'));
  if (f % 60 === 0) console.log(`frame ${f}/${total}`);
}
ws.close(); proc.kill();
const out = join(here, 'out', 'jeneros-preview-glass-9x16.mp4');
const ff = spawn('ffmpeg', ['-y', '-framerate', String(fps), '-i', join(frames, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out], { stdio: 'inherit' });
ff.on('exit', (code) => { console.log(code === 0 ? 'wrote ' + out : 'ffmpeg failed ' + code); });
