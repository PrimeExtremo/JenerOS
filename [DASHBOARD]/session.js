// Cookies stay with the browser; no session token or password enters storage.
window.JenerSession = {
  loginURL() {
    const next = location.pathname === '/screen.html' ? '/screen.html' : '/' + location.hash;
    return '/login?next=' + encodeURIComponent(next);
  },
  async fetch(path, options) {
    const res = await fetch(path, options);
    if (res.status === 401) {
      location.replace(this.loginURL());
      throw new Error('Sign in to your owner account to continue.');
    }
    return res;
  },
  destination() {
    const next = new URLSearchParams(location.search).get('next') || '/';
    // Fixed local destinations, including the existing dashboard panels.
    return next === '/screen.html' || /^\/(?:#\/(?:home|files|apps|settings|storage|network|account|system|photos|backup|machines))?$/.test(next) ? next : '/';
  },
};
