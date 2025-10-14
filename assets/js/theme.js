(function(){
  const STORAGE_KEY = 'hr:theme';
  const DEFAULT_THEME = './data/theme.json';

  let currentTheme = null;

  init();

  async function init(){
    const themeFromUrl = readThemeFromUrl();
    const persisted = themeFromUrl || readThemeFromStorage();
    const path = themeFromUrl ? buildThemePath(themeFromUrl) : (persisted ? buildThemePath(persisted) : DEFAULT_THEME);
    try {
      currentTheme = await fetchTheme(path);
      if (themeFromUrl) {
        persistTheme(themeFromUrl);
      }
    } catch (e) {
      console.warn('theme: failed to load theme file, using default', e);
      currentTheme = await fallbackTheme();
    }
    applyTheme(currentTheme);
    document.addEventListener('sidebar:ready', () => applyThemeToSidebar(currentTheme));
    document.addEventListener('sidebar:update', () => applyThemeToSidebar(currentTheme));
  }

  function readThemeFromUrl(){
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('theme');
      if (!value) return null;
      params.delete('theme');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, document.title, next);
      return value.toLowerCase();
    } catch (e) {
      console.warn('theme: unable to parse theme parameter', e);
      return null;
    }
  }

  function readThemeFromStorage(){
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function persistTheme(id){
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      console.warn('theme: persist failed', e);
    }
  }

  function buildThemePath(id){
    if (!id) return DEFAULT_THEME;
    return `./data/themes/${id}.json`;
  }

  async function fetchTheme(path){
    const resp = await fetch(path, {cache: 'no-store'});
    if (!resp.ok) throw new Error('theme fetch failed');
    const data = await resp.json();
    return data;
  }

  async function fallbackTheme(){
    try {
      const resp = await fetch(DEFAULT_THEME, {cache: 'no-store'});
      if (resp.ok) return await resp.json();
    } catch (e) {
      console.warn('theme: fallback fetch failed', e);
    }
    return {brand: 'SPA2099 HR Health', primary: '#27E0FF', logo: ''};
  }

  function applyTheme(theme){
    if (!theme) return;
    const docStyle = document.documentElement.style;
    if (theme.primary) {
      docStyle.setProperty('--cyan', theme.primary);
      docStyle.setProperty('--accent-strong', theme.primary);
      docStyle.setProperty('--stroke', hexToRgba(theme.primary, 0.35));
      docStyle.setProperty('--stroke-strong', hexToRgba(theme.primary, 0.5));
      docStyle.setProperty('--focus-ring', `0 0 0 3px ${hexToRgba(theme.primary, 0.35)}`);
    }
    applyThemeToSidebar(theme);
    document.dispatchEvent(new CustomEvent('theme:change', {detail: theme}));
  }

  function applyThemeToSidebar(theme){
    const root = document.getElementById('sidebar-slot');
    if (!root || !theme) return;
    const logoEl = root.querySelector('[data-theme-logo]');
    if (logoEl) {
      if (theme.logo) {
        logoEl.src = theme.logo;
        logoEl.hidden = false;
      } else {
        logoEl.hidden = true;
      }
    }
    const brandEl = root.querySelector('.side__brand-name');
    if (brandEl && theme.brand) {
      brandEl.textContent = theme.brand;
    }
  }

  function hexToRgba(hex, alpha){
    const cleaned = (hex || '').replace('#', '');
    if (cleaned.length !== 6) return `rgba(39,224,255,${alpha})`;
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  window.theme = {
    current(){
      return currentTheme;
    }
  };
})();
