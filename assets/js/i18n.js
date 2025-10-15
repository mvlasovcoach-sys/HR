(function(){
  let dict = {};
  let ready = false;
  let queue = [];
  let currentLang = 'en';

  function safeCall(fn){
    try {
      fn();
    } catch (err) {
      console.error('i18n:onReady handler', err);
    }
  }

  function format(template, vars){
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars && key in vars) ? vars[key] : `{${key}}`);
  }

  function translateElement(el){
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const attrTargets = (el.getAttribute('data-i18n-attr') || '').split(/[,\s]+/).filter(Boolean);
    const translation = t(key);
    if (!attrTargets.length || attrTargets.includes('text')) {
      el.textContent = translation;
    }
    attrTargets.forEach(attr => {
      if (attr === 'text') return;
      el.setAttribute(attr, translation);
    });
  }

  function translateDocument(){
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-i18n]').forEach(translateElement);
  }

  function flushQueue(){
    const pending = queue.splice(0);
    pending.forEach(safeCall);
  }

  function storeLang(lang){
    try {
      localStorage.setItem('lang', lang);
      localStorage.setItem('hr:lang', lang);
    } catch (err) {
      // ignore storage failures
    }
  }

  function t(key, vars){
    let template = dict[key];
    if (typeof template !== 'string') {
      template = key.replace(/^label\.|^range\./, '');
    }
    return format(String(template), vars);
  }

  function onReady(fn){
    if (typeof fn !== 'function') return;
    if (ready) {
      safeCall(fn);
    } else {
      queue.push(fn);
    }
  }

  async function init(lang){
    const target = (lang || 'en').toLowerCase();
    const ver = window.APP_VERSION || '';
    ready = false;
    try {
      const response = await fetch(`./assets/i18n/${target}.json?v=${ver}`);
      if (!response.ok) {
        throw new Error(`i18n: failed ${target}`);
      }
      dict = await response.json();
      currentLang = target;
    } catch (err) {
      if (target !== 'en') {
        return init('en');
      }
      console.warn('i18n: fallback to keys');
      dict = {};
      currentLang = 'en';
    }

    ready = true;
    storeLang(currentLang);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', currentLang);
      translateDocument();
    }
    flushQueue();
    window.dispatchEvent(new Event('i18n:ready'));
    window.dispatchEvent(new CustomEvent('i18n:change', {detail: {lang: currentLang}}));
    return currentLang;
  }

  function setLang(lang){
    queue = [];
    return init(lang);
  }

  function getLang(){
    return currentLang;
  }

  window.I18N = { t, onReady, init, setLang, getLang, translate: translateDocument };
  window.t = (key, vars) => t(key, vars);
})();
