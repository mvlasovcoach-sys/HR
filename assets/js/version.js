(async function(){
  try {
    const response = await fetch('./data/version.json?ts=' + Date.now(), {cache: 'no-store'});
    const payload = await response.json();
    window.APP_VERSION = payload.v || String(Date.now());
  } catch (e) {
    window.APP_VERSION = String(Date.now());
  }
  window.dispatchEvent(new Event('app:version'));

  let storedLang = 'en';
  try {
    storedLang = localStorage.getItem('hr:lang') || localStorage.getItem('lang') || 'en';
  } catch (e) {
    storedLang = 'en';
  }
  I18N.init(storedLang || 'en');
})();
