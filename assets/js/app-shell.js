(function(){
  function ensureToolsContainer(){
    if (document.getElementById('app-tools')) return;
    const tools = document.createElement('div');
    tools.id = 'app-tools';
    tools.innerHTML = '<div id="lang-switch" class="lang-switch" role="group" aria-label="Language"></div>';
    document.body.appendChild(tools);
  }

  function renderLang(){
    ensureToolsContainer();
    const host = document.getElementById('lang-switch');
    if (!host || host.dataset.bound === 'true') return;

    host.innerHTML = `
      <button type="button" data-lang="en" class="pill" aria-pressed="false">EN</button>
      <button type="button" data-lang="nl" class="pill" aria-pressed="false">NL</button>`;

    host.addEventListener('click', evt => {
      const btn = evt.target.closest('button[data-lang]');
      if (!btn) return;
      const lang = btn.dataset.lang;
      if (!lang) return;
      window.I18N?.set?.(lang);
      try {
        localStorage.setItem('lang', lang);
      } catch (err) {
        // ignore storage issues
      }
      if (window.I18N?.refresh) {
        window.I18N.refresh(document.body);
      }
      updateActive();
    });

    host.dataset.bound = 'true';

    const saved = (() => {
      try {
        return localStorage.getItem('lang') || localStorage.getItem('hr:lang');
      } catch (err) {
        return null;
      }
    })();
    if (saved && window.I18N?.getLang?.() !== saved) {
      window.I18N?.set?.(saved);
    }
    updateActive();
  }

  function updateActive(){
    const host = document.getElementById('lang-switch');
    if (!host) return;
    const lang = window.I18N?.getLang?.() || (() => {
      try {
        return localStorage.getItem('lang') || localStorage.getItem('hr:lang') || 'en';
      } catch (err) {
        return 'en';
      }
    })();
    host.querySelectorAll('button[data-lang]').forEach(btn => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureToolsContainer();
    renderLang();
  });

  document.addEventListener('i18n:change', updateActive);
})();
