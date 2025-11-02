(function(){
  const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
  const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
  const root = document.documentElement;
  const mode = (root && (root.getAttribute('data-env') || root.dataset?.env || '')).toLowerCase();
  const hostname = location.hostname || '';
  const isDev = mode === 'dev' || mode === 'demo' || /localhost|127\.0\.0\.1/.test(hostname);
  if (!isDev) return;

  const expected = (window.APP_VERSION || '').toString();
  const urls = [...document.querySelectorAll('script[src],link[href]')].map(node => node.src || node.href).filter(Boolean);
  const mismatched = urls.filter(url => /\?v=/.test(url) && expected && !url.endsWith(expected));
  if (mismatched.length) {
    devWarn('[SMOKE] Mismatched versions:', mismatched);
  }

  const interesting = urls
    .filter(url => /\/(api|i18n|team-filter)\.js\?v=/.test(url))
    .map(url => /\/([^/]+\.js)/.exec(url)?.[1])
    .filter(Boolean);
  const hasAll = ['api.js', 'i18n.js', 'team-filter.js'].every(name => interesting.includes(name));
  if (hasAll) {
    const apiIndex = interesting.indexOf('api.js');
    const i18nIndex = interesting.indexOf('i18n.js');
    const teamIndex = interesting.indexOf('team-filter.js');
    const ok = apiIndex !== -1 && i18nIndex > apiIndex && teamIndex > i18nIndex;
    if (!ok) {
      devWarn('[SMOKE] Suspicious script order:', interesting);
    }
  }

  ['#team-filter', '#date-controls', '#global-caption'].forEach(selector => {
    if (!document.querySelector(selector)) {
      devWarn('[SMOKE] Missing host:', selector);
    }
  });
})();
