// Shared confirmation for the local screen and dashboard update center.
window.JenerRollback = {
  bind(button, notify) {
    let pending = false, needsLogin = false;
    const dialog = document.createElement('dialog');
    dialog.className = 'rollback-dialog';
    dialog.setAttribute('aria-labelledby', 'rollbackTitle');
    dialog.innerHTML = '<form method="dialog"><h2 id="rollbackTitle" class="panel-title">Start the other version?</h2><p class="lede">Your box will restart into the other installed JenerOS version. Files and settings stay on your box.</p><p class="note">This changes the next boot only. A previous version must already be installed.</p><div class="row"><button class="pill" value="cancel" autofocus>Keep this version</button><button class="pill pill-accent" value="start">Start previous version</button></div></form>';
    document.body.append(dialog);
    const open = () => {
      if (needsLogin) { location.assign(JenerSession.loginURL()); return; }
      if (!button.disabled && !dialog.open && !pending) { dialog.returnValue = ''; dialog.showModal(); }
    };
    button.addEventListener('click', open);
    dialog.addEventListener('close', async () => {
      if (dialog.returnValue !== 'start' || pending) return;
      pending = true; button.disabled = true; notify('Starting the other installed version. Your box will restart.');
      try {
        const res = await JenerSession.fetch('/api/update/rollback', { method: 'POST', headers: { 'X-JenerOS': '1' } });
        if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Couldn't start the other version."); }
      } catch (err) { pending = false; notify(err.message || "Couldn't reach your box. Please try again."); }
    });
    return {
      open,
      requireLogin() { needsLogin = true; pending = false; button.disabled = false; notify('Sign in with your owner account to choose the previous version.'); },
      render(info) {
        needsLogin = false;
        const state = info.rollback?.state;
        if (info.rollbackRequested || state === 'rebooting' || state === 'selecting') { pending = true; notify(state === 'failed' ? 'Starting the other installed version.' : info.rollback?.message || 'Starting the other installed version.'); }
        else if (state === 'failed') { pending = false; notify(info.rollback.message || "Couldn't start the other version."); }
        button.disabled = pending || !!info.requested || ['installing', 'rebooting'].includes(info.status?.state);
      },
      offline() { button.disabled = true; },
      get pending() { return pending; },
    };
  },
};
