(function(){
  const LANG_KEY = 'hr:lang';
  const SUPPORTED = ['en', 'nl'];
  const dictionaries = new Map();
  let currentLang = readStoredLang();
  const readyCallbacks = [];
  let isReady = false;

  function readStoredLang(){
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && SUPPORTED.includes(stored)) {
        return stored;
      }
    } catch (e) {
      // ignore storage errors
    }
    return 'en';
  }

  function writeLang(lang){
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      // ignore
    }
  }

  function template(str, vars){
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : `{${key}}`));
  }

  function getDict(lang){
    if (dictionaries.has(lang)) return dictionaries.get(lang);
    return {};
  }

  function translateElement(el){
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  }

  function translateAll(){
    document.querySelectorAll('[data-i18n]').forEach(translateElement);
  }

  function t(key, vars){
    const dict = getDict(currentLang);
    if (key in dict) {
      return template(dict[key], vars);
    }
    const fallback = getDict('en');
    if (key in fallback) {
      return template(fallback[key], vars);
    }
    return key;
  }

  function setLang(lang){
    if (!SUPPORTED.includes(lang)) lang = 'en';
    if (lang === currentLang) return;
    currentLang = lang;
    writeLang(lang);
    document.documentElement.setAttribute('lang', lang);
    if (isReady) {
      translateAll();
      document.dispatchEvent(new CustomEvent('i18n:change', {detail: {lang}}));
    }
  }

  function onReady(cb){
    if (typeof cb !== 'function') return;
    if (isReady) {
      cb();
    } else {
      readyCallbacks.push(cb);
    }
  }

  async function loadLang(lang){
    if (dictionaries.has(lang)) return;
    try {
      const data = await window.dataLoader.fetch(`./assets/i18n/${lang}.json`, {team: null, range: null});
      if (data && typeof data === 'object') {
        dictionaries.set(lang, data);
      } else {
        dictionaries.set(lang, {});
      }
    } catch (e) {
      console.error('i18n: failed to load language', lang, e);
      dictionaries.set(lang, {});
    }
  }

  async function init(){
    await Promise.all(SUPPORTED.map(loadLang));
    if (!dictionaries.has('en')) {
      dictionaries.set('en', {});
    }
    document.documentElement.setAttribute('lang', currentLang);
    translateAll();
    isReady = true;
    readyCallbacks.splice(0).forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  window.i18n = {t, setLang, getLang: () => currentLang, onReady, translate: translateAll, supported: SUPPORTED.slice()};
  window.t = t;
})();
