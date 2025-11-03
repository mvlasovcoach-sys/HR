(function(){
  if (typeof document === 'undefined') return;
  const page = document.body?.dataset?.page;
  if (page !== 'demo') return;

  const root = document.getElementById('demo-toolbar');
  if (!root) return;

  const LANGS = ['EN', 'NL', 'RU'];
  const langGroupButtons = Array.from(root.querySelectorAll('.demo-toolbar__lang [data-demo-lang]'));
  const menuContainer = root.querySelector('[data-demo-lang-menu]');
  const menuToggle = menuContainer?.querySelector('[data-demo-lang-toggle]') || null;
  const menuPanel = menuContainer?.querySelector('.demo-lang-menu') || null;
  const menuButtons = Array.from(menuPanel?.querySelectorAll('[data-demo-lang]') || []);
  const langButtons = Array.from(new Set([...langGroupButtons, ...menuButtons]));
  const exportButton = root.querySelector('[data-demo-export]');
  const baseExportLabel = exportButton?.getAttribute('data-label') || exportButton?.textContent?.trim() || 'Export';
  const emptyExportLabel = exportButton?.getAttribute('data-empty-label') || 'No data to export';
  const state = {
    lang: normalise(readStoredLang()) || 'EN',
    menuOpen: false,
    hasData: false
  };

  initialiseLangButtons();
  initialiseMenu();
  initialiseExport();
  applyLanguage(state.lang);
  setExportState(false);

  window.addEventListener('demo:dataState', handleDataState);

  function initialiseLangButtons(){
    if (!langButtons.length) return;
    langButtons.forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        const lang = normalise(button.dataset.demoLang);
        if (!lang) return;
        applyLanguage(lang);
        closeMenu();
      });
    });
  }

  function initialiseMenu(){
    if (!menuToggle || !menuPanel) return;
    menuToggle.addEventListener('click', event => {
      event.preventDefault();
      toggleMenu(!state.menuOpen);
    });
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function initialiseExport(){
    if (!exportButton) return;
    exportButton.addEventListener('click', event => {
      if (exportButton.disabled) return;
      event.preventDefault();
      if (typeof window.exportDemo === 'function') {
        window.exportDemo();
      }
    });
  }

  function handleDataState(event){
    const detail = event?.detail || {};
    const hasData = Boolean(detail.hasData);
    state.hasData = hasData;
    setExportState(hasData);
  }

  function toggleMenu(open){
    if (!menuContainer || !menuPanel || !menuToggle) return;
    const next = Boolean(open);
    state.menuOpen = next;
    menuContainer.classList.toggle('is-open', next);
    menuPanel.hidden = !next;
    menuToggle.setAttribute('aria-expanded', String(next));
    if (next) {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKeyDown, true);
      requestAnimationFrame(() => {
        const active = menuPanel.querySelector('[data-demo-lang].active') || menuPanel.querySelector('[data-demo-lang]');
        active?.focus?.({ preventScroll: true });
      });
    } else {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    }
  }

  function closeMenu(){
    if (!state.menuOpen) return;
    toggleMenu(false);
  }

  function handlePointerDown(event){
    if (!menuContainer) return;
    if (menuContainer.contains(event.target)) return;
    closeMenu();
  }

  function handleKeyDown(event){
    if (event.key === 'Escape') {
      closeMenu();
      menuToggle?.focus?.({ preventScroll: true });
    }
  }

  function applyLanguage(lang){
    const resolved = normalise(lang) || 'EN';
    if (state.lang === resolved) {
      updateLangUI(resolved);
      return;
    }
    state.lang = resolved;
    persistLang(resolved);
    updateLangUI(resolved);
    runLocale(resolved);
  }

  function updateLangUI(lang){
    langButtons.forEach(button => {
      const isActive = normalise(button.dataset.demoLang) === lang;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    if (menuToggle) {
      menuToggle.setAttribute('data-current-lang', lang);
      menuToggle.setAttribute('aria-label', `Language menu (current ${lang})`);
    }
  }

  function persistLang(lang){
    try {
      localStorage.setItem('lang', lang);
      localStorage.setItem('hr:lang', lang.toLowerCase());
    } catch (err) {
      /* storage optional */
    }
  }

  function runLocale(lang){
    const lower = lang.toLowerCase();
    if (typeof window.switchLocale === 'function') {
      window.switchLocale(lang);
      return;
    }
    if (typeof window.I18N?.setLang === 'function') {
      window.I18N.setLang(lower);
    } else if (typeof window.I18N?.set === 'function') {
      try {
        window.I18N.set(lower);
      } catch (err) {
        /* noop */
      }
    }
    window.dispatchEvent(new CustomEvent('demo:langChanged', { detail: { lang } }));
  }

  function normalise(value){
    const upper = String(value || '').trim().toUpperCase();
    return LANGS.includes(upper) ? upper : null;
  }

  function readStoredLang(){
    try {
      const stored = localStorage.getItem('lang') || localStorage.getItem('hr:lang') || document.documentElement.lang;
      return stored;
    } catch (err) {
      return document.documentElement.lang;
    }
  }

  function setExportState(enabled){
    if (!exportButton) return;
    const allow = Boolean(enabled);
    exportButton.disabled = !allow;
    if (allow) {
      exportButton.removeAttribute('aria-disabled');
      exportButton.setAttribute('title', baseExportLabel);
    } else {
      exportButton.setAttribute('aria-disabled', 'true');
      exportButton.setAttribute('title', emptyExportLabel);
    }
  }
})();
