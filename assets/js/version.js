(async function(){
  const loaderGlobals = window.loaderGlobals || {};
  const fetchJson = typeof loaderGlobals.fetchJson === 'function'
    ? loaderGlobals.fetchJson
    : async url => {
        const response = await fetch(url, {cache: 'no-store'});
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`version fetch failed: ${response.status}`);
        return response.json();
      };
  const withVersion = typeof loaderGlobals.withV === 'function'
    ? loaderGlobals.withV
    : value => value;

  let version = '';
  try {
    const url = new URL('./data/version.json', document.baseURI);
    url.searchParams.set('ts', Date.now().toString());
    const payload = await fetchJson(withVersion(url.toString()));
    version = payload?.v || '';
  } catch (err) {
    version = '';
  }

  window.APP_VERSION = version;
  window.dispatchEvent(new CustomEvent('app:version', {detail: {version}}));

  let preferredLang = 'en';
  try {
    preferredLang = localStorage.getItem('demo-lang')
      || localStorage.getItem('lang')
      || localStorage.getItem('hr:lang')
      || 'en';
  } catch (err) {
    preferredLang = 'en';
  }

  if (window.I18N?.init) {
    window.I18N.init(preferredLang);
  }
})();
