(async function(){
  try {
    const response = await fetch(`./data/version.json?ts=${Date.now()}`);
    const payload = await response.json();
    window.APP_VERSION = payload.v || '';
  } catch (e) {
    window.APP_VERSION = '';
  }
  const storedLang = (() => {
    try {
      return localStorage.getItem('lang') || localStorage.getItem('hr:lang') || 'en';
    } catch (e) {
      return 'en';
    }
  })();
  window.I18N?.init(storedLang || 'en');
})();
