const STORAGE_KEY = 'spa2099_mode';

const normalizeMode = value => (String(value || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO');

const readStoredMode = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;
  }
};

const writeStoredMode = mode => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    /* storage optional */
  }
};

const updateUrl = mode => {
  const params = new URLSearchParams(location.search || '');
  params.set('mode', mode.toLowerCase());
  const query = params.toString();
  const hash = location.hash || '';
  const next = query ? `${location.pathname}?${query}${hash}` : `${location.pathname}${hash}`;
  if (typeof history.replaceState === 'function') {
    history.replaceState(history.state, '', next);
  }
};

export const ModeStore = {
  mode: 'DEMO',
  init(){
    const params = new URLSearchParams(location.search || '');
    const queryMode = params.get('mode');
    const storedMode = readStoredMode();
    const resolved = normalizeMode(queryMode || storedMode || this.mode);
    this.mode = resolved;
    writeStoredMode(resolved);
    updateUrl(resolved);
  },
  set(mode){
    const resolved = normalizeMode(mode);
    this.mode = resolved;
    writeStoredMode(resolved);
    updateUrl(resolved);
  }
};
