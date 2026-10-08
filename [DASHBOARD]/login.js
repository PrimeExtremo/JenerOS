(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let pending = false, retryAt = 0;
  $('showPassword').addEventListener('click', () => {
    const show = $('loginPassword').type === 'password';
    $('loginPassword').type = show ? 'text' : 'password';
    $('showPassword').textContent = show ? 'Hide password' : 'Show password';
    $('showPassword').setAttribute('aria-pressed', String(show));
  });
  $('loginForm').addEventListener('input', () => {
    $('loginError').hidden = true;
    for (const id of ['loginUsername', 'loginPassword']) $(id).setAttribute('aria-invalid', 'false');
  });
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (pending || Date.now() < retryAt) return;
    $('loginError').hidden = true;
    const username = $('loginUsername').value, password = $('loginPassword').value;
    if (!username || !password) {
      $('loginError').textContent = 'Enter your username and password.';
      $('loginError').hidden = false;
      $(!username ? 'loginUsername' : 'loginPassword').focus();
      return;
    }
    pending = true; $('signIn').disabled = true;
    $('loginForm').setAttribute('aria-busy', 'true');
    $('loginStatus').hidden = false; $('loginStatus').textContent = 'Signing in…';
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', cache: 'no-store',
        headers: { 'X-JenerOS': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(15000) });
      $('loginPassword').value = '';
      if (res.status === 429) {
        const seconds = Math.min(60, Math.max(1, Number(res.headers.get('Retry-After')) || 60));
        retryAt = Date.now() + seconds * 1000;
        setTimeout(() => { if (!pending) $('signIn').disabled = false; }, seconds * 1000);
      }
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401 || res.status === 400) {
          for (const id of ['loginUsername', 'loginPassword']) $(id).setAttribute('aria-invalid', 'true');
        }
        throw new Error(data.error || 'Could not sign in. Please try again.');
      }
      location.replace(JenerSession.destination());
    } catch (err) {
      $('loginPassword').value = '';
      $('loginError').textContent = err.name === 'TimeoutError' || err.name === 'TypeError'
        ? 'Could not reach your box. Check your connection and try again.' : err.message;
      $('loginError').hidden = false;
      if (Date.now() >= retryAt) $('loginPassword').focus();
    } finally {
      pending = false; $('signIn').disabled = Date.now() < retryAt;
      $('loginStatus').hidden = true; $('loginForm').setAttribute('aria-busy', 'false');
    }
  });
  (async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) location.replace(JenerSession.destination());
    } catch { /* The form can retry when the box reconnects. */ }
  })();
})();
