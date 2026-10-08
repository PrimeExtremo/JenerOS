(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let lastUpdate = '';
  const rollback = JenerRollback.bind($('rollbackBtn'), message => { $('rollbackMessage').textContent = message; });
  function clearLinks() {
    for (const id of ['screenAddress', 'screenLocalAddress']) {
      $(id).hidden = true; $(id).removeAttribute('href'); $(id).textContent = '';
    }
    $('screenQR').hidden = true; $('screenQR').replaceChildren(); delete $('screenQR').dataset.text;
  }
  async function refresh() {
    try {
      const res = await fetch('/api/system', { cache: 'no-store' });
      if (!res.ok) throw new Error('Disconnected');
      const s = await res.json();
      const version = `JenerOS ${s.osVersion || ''}`.trim();
      $('screenVersion').textContent = version; $('screenOS').textContent = version;
      for (const [id, value] of Object.entries({ boxName: s.hostname, screenManufacturer: s.manufacturer, screenModel: s.model, screenBuildDate: s.buildDate, screenKernel: s.kernel })) $(id).textContent = value || 'Not available';
      $('screenState').textContent = 'Up and running. All yours.';
      $('screenSSH').textContent = s.sshStatus === 'on' ? 'SSH is on. Use your owner account to connect.' : s.sshStatus === 'off' ? 'SSH is off by default. Local login is available on Ctrl+Alt+F2.' : 'SSH status is unavailable right now.';
      const minutes = Math.floor((s.uptimeSec || 0) / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
      $('screenUptime').textContent = days ? `${days} days ${hours % 24} h` : hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
      const ip = s.addresses?.[0];
      if (ip) {
        const address = BoxUI.address(ip), local = BoxUI.localAddress(s.hostname);
        $('phonePrompt').textContent = 'Open either address to get to your dashboard.';
        $('screenAddress').href = address; $('screenAddress').textContent = address; $('screenAddress').hidden = false;
        $('screenLocalAddress').href = local; $('screenLocalAddress').textContent = local; $('screenLocalAddress').hidden = false;
        $('screenQR').hidden = false; BoxUI.qr($('screenQR'), address);
      } else {
        clearLinks(); $('phonePrompt').textContent = 'Connect a network cable to your router. Your address will appear here.';
      }
      lastUpdate = new Date().toLocaleTimeString();
    } catch {
      clearLinks(); $('screenSSH').textContent = 'Reconnecting to check SSH status.';
      $('screenState').textContent = lastUpdate ? `Reconnecting. Last checked at ${lastUpdate}.` : 'Waiting for your box. We will reconnect in a moment.';
      $('phonePrompt').textContent = 'Reconnecting to your box. Your address will return in a moment.';
    }
    setTimeout(refresh, 5000);
  }
  async function updates() {
    try {
      const res = await fetch('/api/update', { cache: 'no-store' });
      if (!res.ok) throw new Error('Disconnected');
      rollback.render(await res.json());
    } catch { rollback.offline(); }
    setTimeout(updates, 3000);
  }
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 's' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
    e.preventDefault(); rollback.open();
  });
  refresh(); updates();
})();