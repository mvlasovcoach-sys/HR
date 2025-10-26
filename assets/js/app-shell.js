(function(){
  window.ASSET_VERSION = '2025.10.19-05';
  if (typeof window.APP_VERSION === 'undefined' || !window.APP_VERSION) {
    window.APP_VERSION = window.ASSET_VERSION;
  }
  function initDensity(){
    if (!document?.body) return;
    let density = 'compact';
    try {
      density = localStorage.getItem('hr:density') || 'compact';
    } catch (err) {
      density = 'compact';
    }
    if (density === 'compact') {
      document.body.classList.add('density--compact');
    }
    try {
      localStorage.setItem('hr:density', 'compact');
    } catch (err) {
      // ignore storage failures
    }
  }

  function initLang(){
    const host = document.getElementById('lang-switch');
    if (!host) return;

    host.innerHTML = `
      <button class="pill range-pill lang-pill" data-lang="en" id="btn-lang-en" type="button">EN</button>
      <button class="pill range-pill lang-pill" data-lang="nl" id="btn-lang-nl" type="button">NL</button>
      <button class="pill range-pill lang-pill" data-lang="ru" id="btn-lang-ru" type="button">RU</button>
    `;
    host.setAttribute('role', 'group');

    const updateGroupLabel = () => {
      const label = window.I18N?.t?.('label.language');
      host.setAttribute('aria-label', label || 'Language');
    };
    updateGroupLabel();

    const updateActive = (lang)=>{
      host.querySelectorAll('button').forEach(btn => {
        const isActive = btn.dataset.lang === lang;
        btn.classList.toggle('is-active', isActive);
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', String(isActive));
      });
    };

    const apply = (lang)=>{
      const run = (resolvedLang)=>{
        const nextLang = resolvedLang || lang;
        if (typeof document !== 'undefined') {
          if (window.I18N?.refresh) {
            window.I18N.refresh(document.body);
          }
        }
        document.dispatchEvent(new CustomEvent('language:changed', {detail: {lang: nextLang}}));
        updateActive(nextLang);
      };

      try {
        localStorage.setItem('lang', lang);
        localStorage.setItem('hr:lang', lang);
      } catch (err) {
        // storage is optional
      }

      if (typeof window.I18N?.setLang === 'function') {
        Promise.resolve(window.I18N.setLang(lang))
          .then(() => run(window.I18N?.getLang?.()))
          .catch(() => run(window.I18N?.getLang?.() || lang));
      } else if (typeof window.I18N?.set === 'function') {
        try {
          window.I18N.set(lang);
        } catch (err) {
          // ignore set errors
        }
        run(window.I18N?.getLang?.() || lang);
      } else {
        run(lang);
      }
    };

    const saved = (() => {
      try {
        return localStorage.getItem('lang') || localStorage.getItem('hr:lang') || window.I18N?.getLang?.() || 'en';
      } catch (err) {
        return window.I18N?.getLang?.() || 'en';
      }
    })();

    apply(saved);

    host.addEventListener('click', event => {
      const lang = event.target?.dataset?.lang;
      if (!lang) return;
      if (host.querySelector(`button[data-lang="${lang}"]`)?.classList.contains('active')) {
        return;
      }
      apply(lang);
    });

    window.addEventListener('i18n:change', evt => {
      const lang = evt?.detail?.lang || window.I18N?.getLang?.();
      if (lang) {
        updateActive(lang);
      }
      updateGroupLabel();
    });
  }

  function init(){
    initDensity();
    initLang();
  }

  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
