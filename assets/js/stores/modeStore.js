export const ModeStore = {
  mode: 'DEMO',
  init() {
    const query = new URLSearchParams(location.search).get('mode');
    const stored = localStorage.getItem('spa2099_mode');
    this.mode = (query?.toUpperCase() || stored?.toUpperCase() || 'DEMO');
  },
  set(mode) {
    this.mode = mode;
    localStorage.setItem('spa2099_mode', mode);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('mode', mode.toLowerCase());
    history.replaceState(null, '', `${location.pathname}?${searchParams}`);
  }
};
