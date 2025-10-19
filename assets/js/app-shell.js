(async function(){
  const slot = document.getElementById('sidebar-slot');
  if (!slot) return;

  const FALLBACK_HTML = '<nav class="side"><ul class="side__nav">'
    + '<li><a href="./Summary.html">Summary</a></li>'
    + '<li><a href="./User.html">Wellness</a></li>'
    + '<li><a href="./Analytics.html">Analytics</a></li>'
    + '<li><a href="./Engagement.html">Engagement</a></li>'
    + '<li><a href="./Corporate.html">Corporate</a></li>'
    + '<li><a href="./Devices.html">Devices</a></li>'
    + '<li><a href="./Settings.html">Settings</a></li>'
    + '<li><a href="./Demo.html">Demo</a></li>'
    + '</ul></nav>';

  function waitForVersion(){
    if (typeof window.APP_VERSION !== 'undefined') {
      return Promise.resolve(window.APP_VERSION || '');
    }
    return new Promise(resolve => {
      const handler = () => {
        window.removeEventListener('app:version', handler);
        resolve(window.APP_VERSION || '');
      };
      window.addEventListener('app:version', handler, {once: true});
    });
  }

  const version = await waitForVersion();
  let html = '';
  try {
    const res = await fetch(`./partials/sidebar.html?v=${encodeURIComponent(version)}`, {cache: 'no-store'});
    if (!res.ok) throw new Error('sidebar fetch failed');
    html = await res.text();
  } catch (e) {
    console.error('app-shell: cannot load sidebar', e);
    html = FALLBACK_HTML;
  }

  slot.innerHTML = html;

  const ensureOk = () => {
    const ok = slot.querySelectorAll('.side__nav a').length >= 6 &&
               slot.querySelector('.side__nav a[href$="Demo.html"]');
    if (!ok) {
      console.warn('app-shell: sidebar invalid, using fallback HTML');
      slot.innerHTML = FALLBACK_HTML;
    }
  };
  ensureOk();

  console.debug('nav:', [...document.querySelectorAll('#sidebar-slot .side__nav a')].map(a=>a.textContent.trim()));

  const here = location.pathname.split('/').pop().toLowerCase();
  slot.querySelectorAll('.side__nav a').forEach(a => {
    const fname = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
    if (fname === here) a.classList.add('is-active');
  });

  try {
    window.I18N?.translate?.();
  } catch (err) {
    console.warn('app-shell: translate failed', err);
  }

  const detail = {root: slot, version};
  document.dispatchEvent(new CustomEvent('sidebar:ready', {detail}));
  document.dispatchEvent(new CustomEvent('sidebar:update', {detail}));
})();
