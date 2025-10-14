(function(){
  const STORAGE_KEY = 'hr:lang';
  const SUPPORTED = ['en', 'nl'];
  const cache = new Map();
  let currentLang = readStoredLang();
  let ready = false;
  let hasDispatchedReady = false;
  const queue = [];

  function readStoredLang(){
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) {
        return stored;
      }
    } catch (e) {
      // ignore storage errors
    }
    return 'en';
  }

  function writeStoredLang(lang){
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // ignore storage errors
    }
  }

  function normalizeLang(lang){
    if (!lang || !SUPPORTED.includes(lang)) return 'en';
    return lang;
  }

  function interpolate(template, vars){
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : `{${key}}`));
  }

  async function loadDictionary(lang){
    if (cache.has(lang)) {
      return cache.get(lang);
    }
    const version = window.APP_VERSION ? `?v=${encodeURIComponent(window.APP_VERSION)}` : '';
    const resp = await fetch(`./assets/i18n/${lang}.json${version}`, {cache: 'no-store'});
    if (!resp.ok) {
      throw new Error(`i18n: failed to load ${lang}`);
    }
    const data = await resp.json();
    cache.set(lang, data);
    return data;
  }

  function translateElement(el){
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  }

  function translateAll(){
    document.querySelectorAll('[data-i18n]').forEach(translateElement);
  }

  function flushQueue(){
    while (queue.length) {
      const fn = queue.shift();
      try { fn(); } catch (e) { console.error(e); }
    }
  }

  async function init(lang){
    const target = normalizeLang(lang || currentLang);
    ready = false;
    let dict = null;
    try {
      dict = await loadDictionary(target);
      currentLang = target;
      writeStoredLang(currentLang);
      document.documentElement.setAttribute('lang', currentLang);
    } catch (err) {
      if (target !== 'en') {
        return init('en');
      }
      console.warn('i18n: fallback to keys', err);
      dict = {};
      cache.set('en', dict);
      currentLang = 'en';
      document.documentElement.setAttribute('lang', currentLang);
    }

    // Ensure English fallback is cached for lookups
    if (currentLang !== 'en' && !cache.has('en')) {
      try {
        await loadDictionary('en');
      } catch (err) {
        cache.set('en', {});
      }
    }

    ready = true;
    translateAll();
    flushQueue();

    if (!hasDispatchedReady) {
      hasDispatchedReady = true;
      window.dispatchEvent(new Event('i18n:ready'));
    }
    window.dispatchEvent(new CustomEvent('i18n:change', {detail: {lang: currentLang}}));
    return dict;
  }

  function t(key, vars){
    const active = cache.get(currentLang) || {};
    let value = active[key];
    if (typeof value !== 'string') {
      const fallback = cache.get('en') || {};
      value = fallback[key];
    }
    if (typeof value !== 'string') {
      value = key.replace(/^label\.|^range\./, '');
    }
    return interpolate(value, vars);
  }

  function onReady(fn){
    if (typeof fn !== 'function') return;
    if (ready) {
      try { fn(); } catch (e) { console.error(e); }
    } else {
      queue.push(fn);
    }
  }

  async function setLang(lang){
    const target = normalizeLang(lang);
    if (target === currentLang && ready) return;
    await init(target);
  }

  function getLang(){
    return currentLang;
  }

  window.I18N = {
    init,
    t,
    onReady,
    setLang,
    getLang,
    translate: translateAll,
    supported: SUPPORTED.slice()
  };
  window.t = (key, vars) => window.I18N.t(key, vars);
})();
