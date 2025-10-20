(function(){
  function initDensity(){
    if (document?.body) {
      document.body.classList.add('density--compact');
    }
  }

  function initLang(){
    const host = document.getElementById('lang-switch');
    if (!host) return;

    host.innerHTML = `
      <button class="pill" data-lang="en" id="btn-lang-en" type="button">EN</button>
      <button class="pill" data-lang="nl" id="btn-lang-nl" type="button">NL</button>
    `;

    const updateActive = (lang)=>{
      host.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
        btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
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
