// Real layout/visibility fixture, stdlib only. Uses an already installed browser.
// Windows: $env:WELCOME_BROWSER='C:/Program Files/Zen Browser/zen.exe'; node .scratch/setup/check-welcome-browser.cjs
// CI/Linux: google-chrome (or WELCOME_BROWSER). No downloads or installs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve('[DASHBOARD]');
const baseline = process.argv.includes('--baseline');
const suite = process.env.JENER_UI_FIXTURE || 'welcome';
if (!['welcome', 'click-shim', 'shine', 'kiosk-shine', 'phone-polish', 'storage'].includes(suite)) throw Error('Unknown browser fixture');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const checks = fs.readFileSync(path.join(__dirname, suite === 'storage' ? '../zimaos/storage-browser.js' : suite + '-browser.js'), 'utf8');
let browser, timer;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture');
  if (url.pathname === '/result') {
    let body = ''; req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const result = JSON.parse(body); console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.errors.length ? 1 : 0;
      res.end('ok'); clearTimeout(timer); browser.kill(); server.close();
    }); return;
  }
  if (url.pathname === '/fixture.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<html><body><script>
      (async () => {
        const errors = [], passed = [];
        for (const page of ${JSON.stringify(suite === 'storage' ? ['index'] : suite === 'phone-polish' ? ['setup', 'login', 'index'] : suite === 'kiosk-shine' ? ['setup', 'login', 'screen'] : suite === 'shine' ? ['setup', 'login'] : ['setup'])})
        for (const theme of ['dark', 'light']) for (const [width, height] of ${JSON.stringify(suite === 'storage' ? [[360,780],[390,844],[780,360],[1280,800]] : suite === 'phone-polish' ? [[360,780],[390,844],[430,932],[780,360],[932,430],[1280,800]] : [[1280,800],[390,800]])}) for (const mode of ${JSON.stringify(suite === 'storage' ? ['native', 'missing', 'reduced-motion', 'large-text'] : suite === 'phone-polish' ? ['native', 'large-text', 'missing'] : suite === 'welcome' ? ['native', 'missing', 'throwing', 'noop', 'qr-failure'] : suite.endsWith('shine') ? ['native', 'reduced-motion', 'reduced-transparency'] : ['native'])}) {
          const frame = document.createElement('iframe'); frame.width = width; frame.height = height;
          frame.style.border = '0'; document.body.append(frame);
          const result = await new Promise(resolve => {
            const timeout = setTimeout(() => { window.removeEventListener('message', listener); resolve({error:'Frame did not report a result: ' + page}); }, 8000);
            const listener = e => { if (e.source === frame.contentWindow) { clearTimeout(timeout); window.removeEventListener('message', listener); resolve(e.data); } };
            window.addEventListener('message', listener);
            frame.src = '/' + page + '.html?code=012345&theme=' + theme + '&mode=' + mode;
          });
          const tag = page + '/' + theme + '/' + width + 'x' + height + '/' + mode;
          if (result.error) errors.push(tag + ': ' + result.error); else passed.push(tag);
          frame.remove();
        }
        await fetch('/result', {method:'POST', body:JSON.stringify({passed, errors})});
      })();
    </script></body></html>`); return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/auth/session') {
      const dashboard = ['phone-polish', 'storage'].includes(suite) && /index.html/.test(req.headers.referer || '');
      res.writeHead(dashboard ? 200 : 401); res.end('{"username":"Owner"}'); return;
    }
    if (['phone-polish', 'storage'].includes(suite) && !['/api/system', '/api/setup/status', '/api/setup/options'].includes(url.pathname)) { res.writeHead(503); res.end('{}'); return; }
    res.end(JSON.stringify(url.pathname === '/api/system' ? { hostname: 'jeneros', addresses: ['192.168.1.20'] }
      : url.pathname === '/api/setup/status' ? { state: 'waiting' }
      : { keymaps: [{ id: 'us', name: 'English (US)' }], timezones: ['UTC'], interfaces: ['eth0'], hostname: 'jeneros', reservedUsernames: [] })); return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  let source = baseline && /\.(html|css|js)$/.test(file)
    ? execFileSync('git', ['show', 'HEAD:[DASHBOARD]/' + path.relative(root, file).replaceAll('\\', '/')]) : fs.readFileSync(file);
  // The remote shine suite runs on a loopback fixture server. Exercise the
  // non-local branch explicitly; kiosk-shine uses the actual BoxUI detection.
  if (suite === 'shine' && url.pathname === '/box-ui.js') source += '\nwindow.BoxUI.local = false;\n';
  // The shared controller now also detects loopback without BoxUI (dashboard).
  if (suite === 'shine' && url.pathname === '/onboarding-shine.js') source = source.toString().replace(/const local =[^;]+;/, 'const local = false;');
  if (url.pathname === '/setup.html' || ((suite.endsWith('shine') || suite === 'phone-polish') && url.pathname === '/login.html') || (suite === 'kiosk-shine' && url.pathname === '/screen.html') || (['phone-polish', 'storage'].includes(suite) && url.pathname === '/index.html')) {
    source = source.toString().replace('<head>', `<head><script>
      const mode = new URLSearchParams(location.search).get('mode');
      localStorage.setItem('jeneros.desktop', JSON.stringify({theme:new URLSearchParams(location.search).get('theme')}));
      if (mode === 'missing') HTMLDialogElement.prototype.showModal = undefined;
      if (mode === 'throwing') HTMLDialogElement.prototype.showModal = function(){throw Error('fixture showModal failure')};
      if (mode === 'noop') HTMLDialogElement.prototype.showModal = function(){};
      if (mode === 'qr-failure') window.TextEncoder = undefined;
      ${(suite.endsWith('shine') || suite === 'storage') ? `
      window.fixturePreferences = {};
      const realMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const actual = realMatchMedia(query), listeners = [];
        const mock = { override:query === '(prefers-' + mode + ': reduce)' ? true : undefined,
          get matches(){return mock.override === undefined ? actual.matches : mock.override},
          addEventListener(type, fn){listeners.push(fn)}, addListener(fn){listeners.push(fn)},
          set(value){mock.override=value; listeners.forEach(fn => fn(mock))} };
        (window.fixturePreferences[query] ||= []).push(mock); return mock;
      };
      ` : ''}
    </script>`).replace('</body>', `<script>${checks}</script></body>`);
  }
  res.end(source);
});
server.listen(0, '127.0.0.1', () => {
  const exe = process.env.WELCOME_BROWSER || 'google-chrome';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jeneros-welcome-browser-'));
  const url = `http://127.0.0.1:${server.address().port}/fixture.html`;
  const firefox = /zen|firefox/i.test(exe);
  browser = spawn(exe, firefox ? ['--headless', '--no-remote', '--profile', profile, url]
    : ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--user-data-dir=' + profile, url], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; browser.stderr.on('data', data => stderr += data);
  browser.on('exit', code => { if (server.listening) { console.error('Browser exited before results: ' + code + '\n' + stderr.slice(-1500)); process.exitCode = 1; clearTimeout(timer); server.close(); } });
  browser.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; server.close(); });
  timer = setTimeout(() => { console.error('Browser fixture timed out. ' + stderr.slice(-1500)); process.exitCode = 1; browser.kill(); server.close(); }, ['kiosk-shine', 'phone-polish', 'storage'].includes(suite) ? 240000 : 45000);
});
