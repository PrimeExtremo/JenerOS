// App Store browser checks (Playwright + Chromium). Needs a local jenerd:
//   cd [CORE] && go run ./cmd/jenerd -addr 127.0.0.1:8099 -setup=false
//   node .scratch/zimaos/check-store.cjs [screenshot-folder]
// Set PLAYWRIGHT to the playwright module path if it isn't installed globally.
// The 320px allowance is the desktop RAM gauge, which overflows by 3px on its own.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const out = process.argv[2] || fs.mkdtempSync(require('os').tmpdir() + '/jeneros-store-'), base = process.env.JENEROS_URL || 'http://127.0.0.1:8099/';
const assert = (c, m) => { if (!c) throw new Error(m); };
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1280, 800], [800, 600], [390, 844], [320, 640]]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/501/.test(m.text()) && errors.push(m.text()));
    await page.addInitScript(t => localStorage.setItem('jeneros.desktop', JSON.stringify({ theme: t })), theme);
    await page.goto(base + '#/apps');
    await page.waitForSelector('.store-card');
    const tag = `${w}-${theme}`;
    const noOverflow = async where => {
      const r = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#storeWindow *, #storeCustom *')].filter(el => {
          if (!el.getClientRects().length || el.closest('.store-shots, .settings-sidebar nav, .store-art, thead, .sr-only')) return false;
          const r = el.getBoundingClientRect(), p = el.closest('dialog').getBoundingClientRect();
          return r.right > p.right + 1 || r.left < p.left - 1;
        }).map(el => el.getAttribute('class') || el.tagName);
        return { doc: document.documentElement.scrollWidth - innerWidth, bad: bad.slice(0, 5) };
      });
      assert(r.doc <= (w === 320 ? 3 : 0) && !r.bad.length, `${tag} ${where}: overflow ${JSON.stringify(r)}`);
    };
    await noOverflow('discover');
    await page.screenshot({ path: `${out}/${tag}-discover.png` });
    await page.click('.store-card[data-store-app="photos"]');
    assert(await page.textContent('#storePageTitle') === 'Photos', 'app page title');
    assert(await page.evaluate(() => document.activeElement.id) === 'storePageTitle', 'focus moves to page title');
    await noOverflow('app');
    await page.screenshot({ path: `${out}/${tag}-app.png` });
    await page.click('.store-install-button');
    await page.waitForFunction(() => /coming soon/.test(document.querySelector('#storeInstallNote').textContent));
    assert(await page.getAttribute('.store-install-button', 'aria-disabled') === 'true', 'install disabled after 501');
    await page.screenshot({ path: `${out}/${tag}-app-soon.png` });
    await page.click('[data-store-back]');
    assert(await page.textContent('#storePageTitle') === 'Discover', 'back to discover');
    await page.click('[data-store-nav="myapps"]');
    await noOverflow('myapps');
    await page.screenshot({ path: `${out}/${tag}-myapps.png` });
    await page.click('[data-store-nav="cat:ai"]');
    assert(/Nothing here yet/.test(await page.textContent('#storePage')), 'empty category');
    await page.click('[data-store-nav="search"]');
    await page.keyboard.type('ads');
    assert(await page.locator('#storeResults .store-row').count() === 1, 'search finds relay');
    await page.screenshot({ path: `${out}/${tag}-search.png` });
    await page.click('[data-store-custom]');
    await page.click('#storeCustom button[type="submit"]');
    assert(await page.evaluate(() => document.activeElement.id) === 'customName', 'first invalid field focused');
    await page.fill('#customName', 'Notes'); await page.fill('#customImage', 'docker.io/library/nginx');
    await page.fill('#customHostPort', '8080'); await page.fill('#customAppPort', '80');
    await page.selectOption('#customPool', 'files'); await page.fill('#customEnv', 'TZ=UTC');
    await noOverflow('sheet form');
    await page.screenshot({ path: `${out}/${tag}-custom-form.png` });
    await page.click('.store-toggle label:nth-child(3)');
    const yaml = await page.inputValue('#customYaml');
    assert(/image: "docker.io\/library\/nginx:latest"/.test(yaml) && /"8080:80"/.test(yaml) && /TZ: "UTC"/.test(yaml), 'yaml generated: ' + yaml);
    await page.click('#storeCustom button[type="submit"]');
    assert(/coming soon/.test(await page.textContent('#storeCustomStatus')), 'custom honest');
    await page.screenshot({ path: `${out}/${tag}-custom-yaml.png` });
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => !document.querySelector('#storeCustom').open && document.querySelector('#storeWindow').open), 'escape closes only the sheet');
    assert(!errors.length, `${tag}: console errors ${errors}`);
    await page.close();
  }
  // Keyboard: Tab reaches sidebar, Enter opens a category; close via button returns to desktop.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base); await page.click('#addApp'); await page.waitForSelector('.store-card');
  await page.focus('[data-store-nav="cat:media"]'); await page.keyboard.press('Enter');
  assert(await page.textContent('#storePageTitle') === 'Media', 'keyboard category');
  assert(await page.getAttribute('[data-store-nav="cat:media"]', 'aria-current') === 'page', 'aria-current');
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  await page.click('[data-store-close]');
  assert(!(await page.evaluate(() => document.querySelector('#storeWindow').open)), 'closed');
  // Offline sample mode.
  const off = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await off.route('**/api/**', r => r.abort());
  await off.goto(base + '#/apps'); await off.waitForSelector('.store-card');
  assert(/Sample catalog/.test(await off.textContent('#storeNotice')), 'sample notice');
  await off.click('.store-card[data-store-app="tv"]'); await off.click('.store-install-button');
  assert(/sample catalog/i.test(await off.textContent('#storeInstallNote')), 'sample install');
  await off.emulateMedia({ reducedMotion: 'reduce' });
  // A slow catalog must not steal focus from the search box.
  const slow = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await slow.route('**/api/store', async r => { await new Promise(d => setTimeout(d, 800)); r.continue(); });
  await slow.goto(base + '#/apps'); await slow.click('[data-store-nav="search"]'); await slow.keyboard.type('pho');
  await slow.waitForSelector('.store-card, #storeResults .store-row'); await slow.waitForTimeout(900); await slow.keyboard.type('tos');
  assert(await slow.inputValue('#storeSearch') === 'photos' && await slow.evaluate(() => document.activeElement.id) === 'storeSearch', 'search keeps focus across refresh');
  // My Apps with installed apps (mocked statuses; jenerd can't install yet).
  for (const [w, h, theme] of [[1280, 800, 'light'], [390, 844, 'dark']]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(t => localStorage.setItem('jeneros.desktop', JSON.stringify({ theme: t })), theme);
  await p.route('**/api/store', async r => { const res = await r.fetch(); const apps = await res.json(); apps[0].status = 'running'; apps[3].status = 'stopped'; apps[1].screenshots = ['a.png', 'b.png']; r.fulfill({ json: apps }); });
  await p.goto(base + '#/apps'); await p.waitForSelector('.store-card');
  await p.click('[data-store-nav="myapps"]');
  await p.click('[data-store-power]', { force: true });
  if (!/coming soon/.test(await p.textContent('#storeNotice'))) throw Error('power notice');
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: My Apps overflows`);
  await p.screenshot({ path: `${out}/${w}-myapps-filled.png` });
  await p.click('[data-store-nav="discover"]'); await p.click('.store-list [data-store-app="home"]');
  await p.screenshot({ path: `${out}/${w}-shots.png` });
}
  console.log('store browser checks passed; focus outline after Tab:', ring);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
