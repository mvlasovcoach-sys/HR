(async function(){
  let version = '';
  try {
    const response = await fetch(`./data/version.json?ts=${Date.now()}`);
    if (!response.ok) {
      throw new Error('version fetch failed');
    }
    const payload = await response.json();
    version = payload?.v || '';
  } catch (err) {
    version = '';
  }

  window.APP_VERSION = version;
  window.dispatchEvent(new CustomEvent('app:version', {detail: {version}}));

  let preferredLang = 'en';
  try {
    preferredLang = localStorage.getItem('lang') || localStorage.getItem('hr:lang') || 'en';
  } catch (err) {
    preferredLang = 'en';
  }

  if (window.I18N?.init) {
    window.I18N.init(preferredLang);
  }
})();
