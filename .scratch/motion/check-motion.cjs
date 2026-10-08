// Motion browser checks (Playwright + Chromium). Serves [DASHBOARD] statically
// and fakes the API, so no jenerd or account is needed:
//   PLAYWRIGHT=/path/to/playwright node .scratch/motion/check-motion.cjs [screenshot-folder]
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const root = path.join(__dirname, '..', '..', '[DASHBOARD]');
const out = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'jeneros-motion-'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const wait = ms => new Promise(done => setTimeout(done, ms));
const anims = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].flatMap(el => el.getAnimations()).map(a => ({ name: a.animationName || 'js', duration: a.effect.getTiming().duration, state: a.playState })), sel);

(async () => {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const reduced of [false, true]) for (const theme of ['dark', 'light']) for (const [w, h] of [[1280, 800], [390, 844]]) {
    const tag = `${reduced ? 'reduced' : 'motion'}-${theme}-${w}`;
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(t => localStorage.setItem('jeneros.desktop', JSON.stringify({ theme: t })), theme);
    await page.route('**/api/**', r => r.fulfill({ status: 404, body: '{}' }));

    // Dashboard: load cascade, tokens, hover, rings, wallpaper.
    await page.goto(base + 'index.html');
    assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ease').trim()) === 'cubic-bezier(0.2, 0, 0, 1)', 'tokens on :root');
    const cascade = await anims(page, '.widgets > *, .notice-card, .desktop-tile');
    assert(cascade.length && cascade.every(a => a.name === (reduced ? 'j-fade' : 'j-rise') && a.duration === (reduced ? 120 : 240)), `${tag} cascade ${JSON.stringify(cascade.slice(0, 2))}`);
    const lastStart = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.widgets > *, .notice-card, .desktop-tile')].flatMap(el => el.getAnimations()).map(a => a.effect.getComputedTiming().endTime)));
    assert(lastStart <= 400, `${tag} cascade ends by 400ms (${lastStart})`);
    const drift = await page.evaluate(() => getComputedStyle(document.querySelector('.desktop-wallpaper'), '::after').animationName);
    assert(drift === (reduced ? 'none' : 'j-drift'), `${tag} wallpaper drift ${drift}`);
    await wait(900);
    assert(!(await page.evaluate(() => document.body.classList.contains('is-arriving'))), 'cascade plays once');
    assert(/^\d+%$|^—$/.test(await page.textContent('#statMem')), 'ring number settles');
    if (w > 600) {
      await page.hover('.desktop-tile');
      await wait(250);
      const lift = await page.evaluate(() => getComputedStyle(document.querySelector('.desktop-tile')).translate);
      assert(lift === (reduced ? 'none' : '0px -2px'), `${tag} tile lift ${lift}`);
      await page.mouse.move(0, 0);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} no sideways scroll`);
    await page.screenshot({ path: `${out}/${tag}-dashboard.png` });

    // Notices slide by tween (instant under reduced motion).
    if (await page.isEnabled('#noticeNext')) {
      await page.click('#noticeNext');
      await wait(60);
      const mid = await page.evaluate(() => document.getElementById('noticeTrack').scrollLeft);
      await wait(400);
      const end = await page.evaluate(() => document.getElementById('noticeTrack').scrollLeft);
      assert(end > 0 && (reduced ? mid === end : mid < end), `${tag} notice slide ${mid} → ${end}`);
    }

    // Settings window: open, settle focus, switch pages, Escape close.
    await page.click('.desktop-bar [data-settings="general"]');
    const open = await anims(page, '#settingsWindow');
    assert(open.some(a => a.name === (reduced ? 'j-fade' : 'j-window-in')), `${tag} settings opens ${JSON.stringify(open)}`);
    assert(await page.evaluate(() => document.activeElement.id) !== 'settingsPageTitle' || reduced, `${tag} focus waits for the window to settle`);
    await page.waitForFunction(() => document.activeElement.id === 'settingsPageTitle', null, { timeout: 2000 });
    if (w > 600) {
      const before = await page.evaluate(() => document.querySelector('#settingsWindow .nav-pill').style.transform);
      await page.click('#settingsWindow nav [data-settings="network"]');
      const after = await page.evaluate(() => document.querySelector('#settingsWindow .nav-pill').style.transform);
      assert(before !== after, `${tag} pill moves`);
      const panel = await anims(page, '[data-settings-panel="network"]');
      assert(panel.length === 1 && panel[0].duration === (reduced ? 120 : 240), `${tag} panel crossfade ${JSON.stringify(panel)}`);
      await wait(300);
    }
    await page.screenshot({ path: `${out}/${tag}-settings.png` });
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => document.querySelector('#settingsWindow').open && document.querySelector('#settingsWindow').classList.contains('is-closing')), `${tag} Escape animates close`);
    await page.waitForFunction(() => !document.querySelector('#settingsWindow').open, null, { timeout: 2000 });

    // App Store: open, navigate, reopen during close, close button.
    await page.click('.desktop-tile[data-app="catalog"]');
    await page.waitForSelector('.store-card');
    await page.waitForFunction(() => document.activeElement.id === 'storePageTitle', null, { timeout: 2000 });
    await page.click('.store-card');
    assert(await page.evaluate(() => document.activeElement.id) === 'storePageTitle', `${tag} store page focus`);
    await page.screenshot({ path: `${out}/${tag}-store.png` });
    await page.click('[data-store-close]');
    await page.evaluate(() => JenerStore.open());
    await wait(400);
    assert(await page.evaluate(() => document.querySelector('#storeWindow').open && !document.querySelector('#storeWindow').classList.contains('is-closing')), `${tag} reopening cancels close`);
    await page.click('[data-store-close]');
    await page.waitForFunction(() => !document.querySelector('#storeWindow').open, null, { timeout: 2000 });
    // Arrow keys move focus instantly (no animated focus).
    await page.focus('.desktop-tile');
    await page.keyboard.press('ArrowRight');
    const focusAnims = await page.evaluate(() => document.activeElement.getAnimations().filter(a => a.playState === 'running').length);
    assert(focusAnims === 0, `${tag} focus moves instantly`);

    // Login: card enters; wrong password shakes (not under reduced motion).
    await page.route('**/api/auth/login', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Check your username and password, then try again."}' }));
    await page.goto(base + 'login.html');
    const card = await anims(page, '.onboarding-card');
    assert(card.some(a => a.name === (reduced ? 'j-fade' : 'j-rise')), `${tag} login card enters`);
    await page.fill('#loginUsername', 'owner'); await page.fill('#loginPassword', 'wrong');
    await page.click('#signIn');
    await page.waitForSelector('#loginError:not([hidden])');
    const shake = await anims(page, '.account-fields');
    assert(reduced ? shake.length === 0 : shake.some(a => a.duration === 320), `${tag} shake ${JSON.stringify(shake)}`);
    await wait(400);
    await page.screenshot({ path: `${out}/${tag}-login.png` });

    // Setup: slide between steps, celebrate when finished.
    let state = 'idle';
    await page.route('**/api/setup', r => r.request().method() === 'POST'
      ? (state = 'done', r.fulfill({ status: 202, body: '{}' }))
      : r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reservedUsernames: [], timezones: ['UTC'], keymaps: [{ id: 'us', name: 'English (US)' }], interfaces: ['eth0'], hostname: 'jeneros' }) }));
    await page.route('**/api/setup/status', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ state }) }));
    await page.goto(base + 'setup.html?code=123456');
    await page.waitForSelector('#next:not([disabled]), #acceptedPrivacy');
    await page.check('#acceptedPrivacy');
    await page.click('#next');
    const slideOut = await anims(page, '#wizard');
    assert(slideOut.some(a => a.duration === (reduced ? 120 : 200)), `${tag} step slide ${JSON.stringify(slideOut)}`);
    await wait(600);
    assert(await page.evaluate(() => document.activeElement.id) === 'ownerTitle', `${tag} step 2 focused`);
    await page.fill('#username', 'owner'); await page.fill('#password', 'a good password'); await page.fill('#passwordConfirm', 'a good password');
    await page.click('#next');
    await page.waitForSelector('[data-step="2"]:not([hidden])', { timeout: 6000 });
    const confetti = await page.locator('.confetti').count();
    assert(await page.locator('.success-check.pop').count() === 1 && (reduced ? confetti === 0 : confetti === 6), `${tag} celebrate (confetti ${confetti})`);
    await wait(800);
    assert(await page.locator('.confetti').count() === 0, 'confetti cleans up');
    await page.screenshot({ path: `${out}/${tag}-setup-done.png` });
    assert(!errors.length, `${tag} page errors: ${errors}`);
    await context.close();
  }
  await browser.close(); server.close();
  console.log('Motion browser checks passed (dashboard, Settings, App Store, login, setup; motion and reduced; dark and light; 1280 and 390). Screenshots:', out);
})().catch(e => { console.error(e); process.exit(1); });
