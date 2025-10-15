(async function(){
  const slot = document.getElementById('sidebar-slot');
  if (!slot) return;

  async function resolveVersion(){
    if (typeof window.APP_VERSION !== 'undefined') {
      return window.APP_VERSION || '';
    }
    return new Promise(resolve => {
      const handler = () => {
        window.removeEventListener('app:version', handler);
        resolve(window.APP_VERSION || '');
      };
      window.addEventListener('app:version', handler, {once: true});
    });
  }

  try {
    const version = await resolveVersion();
    const response = await fetch(`./partials/sidebar.html?v=${encodeURIComponent(version)}`, {cache: 'no-store'});
    if (!response.ok) {
      throw new Error('sidebar fetch failed');
    }
    const html = await response.text();
    slot.innerHTML = html;
  } catch (e) {
    slot.innerHTML = '<nav class="side"><div class="side__brand"><span data-i18n="app.title">SPA2099 HR Health</span></div>' +
      '<ul class="side__nav">' +
      '<li><a href="./Summary.html" data-key="summary" data-i18n="nav.summary">Summary</a></li>' +
      '<li><a href="./User.html" data-key="wellness" data-i18n="nav.wellness">Wellness</a></li>' +
      '<li><a href="./Analytics.html" data-key="analytics" data-i18n="nav.analytics">Analytics</a></li>' +
      '<li><a href="./Engagement.html" data-key="engagement" data-i18n="nav.engagement">Engagement</a></li>' +
      '<li><a href="./Corporate.html" data-key="corporate" data-i18n="nav.corporate">Corporate</a></li>' +
      '<li><a href="./Devices.html" data-key="devices" data-i18n="nav.devices">Devices</a></li>' +
      '<li><a href="./Settings.html" data-key="settings" data-i18n="nav.settings">Settings</a></li>' +
      '</ul></nav>';
  }
  const event = new CustomEvent('sidebar:ready', {detail: {root: slot}});
  document.dispatchEvent(event);

  const here = location.pathname.split('/').pop().toLowerCase();
  slot.querySelectorAll('.side__nav a').forEach(a => {
    const fname = a.getAttribute('href').split('/').pop().toLowerCase();
    if (fname === here) a.classList.add('is-active');
  });

  if (window.I18N?.onReady) {
    window.I18N.onReady(() => {
      window.I18N.translate?.();
    });
  }
})();
