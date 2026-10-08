// Record jener.dev/preview as social videos, frame by frame.
// The page is a pure function of its scroll position, so every frame is exact:
// set the scroll, wait two animation frames, take a screenshot, pipe it to ffmpeg.
// Run from the repo root:  node .scratch/marketing/record-video.cjs [wide|tall|all]
// Needs Playwright (Chromium) and ffmpeg with libx264.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const root = path.resolve('[SITE]');
const outDir = path.join(root, 'assets/video');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon' };
const FPS = 30;

const cuts = {
  // 1920x1080 for YouTube, X, LinkedIn and the site.
  wide: { file: 'jeneros-preview.mp4', viewport: { width: 1920, height: 1080 }, scale: 1, poster: 'jeneros-preview-poster.jpg' },
  // 1080x1920 for Shorts, Reels and TikTok: the phone layout at 2x.
  tall: { file: 'jeneros-preview-vertical.mp4', viewport: { width: 540, height: 960 }, scale: 2, poster: 'jeneros-preview-vertical-poster.jpg' },
};

const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

async function record(name, cut, base, browser) {
  const ctx = await browser.newContext({ viewport: cut.viewport, deviceScaleFactor: cut.scale, colorScheme: 'dark', reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(base + '/preview.html');
  // A clean film: no site header or scrollbar, every image loaded up front.
  await page.addStyleTag({ content: '.site-header,.site-footer,.cta+.note{display:none} html{scrollbar-width:none} ::-webkit-scrollbar{display:none} .intro{padding-top:clamp(5rem,14vh,9rem)}' });
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; }));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));

  // Where each chapter has landed: t = .8 (screen flat, caption in, light sweep just done).
  const marks = await page.evaluate(() => {
    const vh = innerHeight;
    const stops = [...document.querySelectorAll('.chapter')].map(el => {
      const top = el.getBoundingClientRect().top + scrollY;
      return Math.round(top - vh + .8 * el.offsetHeight);
    });
    const cta = document.querySelector('#cta-title').closest('.section');
    stops.push(Math.round(cta.getBoundingClientRect().top + scrollY - (vh - cta.offsetHeight) / 2));
    return stops;
  });

  // Timeline: [scroll target, seconds to move there, seconds to hold].
  const plan = [[0, 0, 1.6], ...marks.map((y, i) => [y, i === 0 ? 2.6 : 3.1, i === marks.length - 1 ? 3 : 2.3])];
  const frames = [];
  let from = 0;
  for (const [to, move, hold] of plan) {
    const m = Math.round(move * FPS);
    for (let f = 1; f <= m; f++) frames.push(from + (to - from) * easeInOut(f / m));
    for (let f = 0; f < Math.round(hold * FPS); f++) frames.push(to);
    from = to;
  }
  console.log(`${name}: ${frames.length} frames, ${(frames.length / FPS).toFixed(1)} s`);

  const out = path.join(outDir, cut.file);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', code => (code ? reject(Error('ffmpeg ' + code)) : resolve())));
  const posterAt = Math.round(plan[0][2] * FPS + plan[1][1] * FPS + 10);
  for (let i = 0; i < frames.length; i++) {
    await page.evaluate(y => new Promise(r => { scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), frames[i]);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (i === posterAt) fs.writeFileSync(path.join(outDir, cut.poster), await page.screenshot({ type: 'jpeg', quality: 84 }));
    if (i % 150 === 0) console.log(`  ${name} ${i}/${frames.length}`);
  }
  ff.stdin.end();
  await done;
  console.log(`${name}: ${out} ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  await ctx.close();
}

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch();
  const which = process.argv[2] || 'all';
  for (const [name, cut] of Object.entries(cuts)) if (which === 'all' || which === name) await record(name, cut, base, browser);
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
