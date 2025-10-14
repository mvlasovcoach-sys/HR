(function(){
  let dict = {};
  let ready = false;
  let queue = [];
  let currentLang = 'en';

  function interpolate(template, vars){
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars && key in vars ? vars[key] : `{${key}}`));
  }

  function translateElement(el){
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const text = window.I18N?.t(key);
    if (typeof text === 'string') {
      el.textContent = text;
    }
  }

  function translateDocument(){
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-i18n]').forEach(translateElement);
  }

  function flushQueue(){
    const pending = queue.slice();
    queue = [];
    pending.forEach(fn => {
      try { fn(); } catch (e) { console.error(e); }
    });
  }

  function storeLang(lang){
    try {
      localStorage.setItem('lang', lang);
      localStorage.setItem('hr:lang', lang);
    } catch (e) {}
  }

  async function init(lang){
    const target = (lang || 'en').toLowerCase();
    const versionSuffix = window.APP_VERSION ? `?v=${encodeURIComponent(window.APP_VERSION)}` : '';

    try {
      const response = await fetch(`./assets/i18n/${target}.json${versionSuffix}`);
      if (!response.ok) {
        throw new Error(`i18n: failed ${target}`);
      }
      dict = await response.json();
      currentLang = target;
    } catch (err) {
      if (target !== 'en') {
        return init('en');
      }
      console.warn('i18n fallback to keys');
      dict = {};
      currentLang = 'en';
    }

    ready = true;
    storeLang(currentLang);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', currentLang);
    }
    translateDocument();
    flushQueue();
    window.dispatchEvent(new Event('i18n:ready'));
    window.dispatchEvent(new CustomEvent('i18n:change', {detail: {lang: currentLang}}));
  }

  function t(key, vars){
    let template = dict[key];
    if (typeof template !== 'string') {
      template = key;
    }
    return interpolate(template, vars);
  }

  function onReady(fn){
    if (typeof fn !== 'function') return;
    if (ready) {
      try { fn(); } catch (e) { console.error(e); }
    } else {
      queue.push(fn);
    }
  }

  function setLang(lang){
    return init(lang);
  }

  function getLang(){
    return currentLang;
  }

  window.I18N = {init, t, onReady, setLang, getLang, translate: translateDocument};
  window.t = (key, vars) => window.I18N.t(key, vars);
})();
