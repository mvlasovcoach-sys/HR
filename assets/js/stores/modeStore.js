const STORAGE_KEY = 'spa2099_mode';
const DEFAULT_MODE = 'DEMO';

function normaliseMode(value){
  if (!value && value !== 0) return null;
  const text = String(value).trim().toUpperCase();
  if (text === 'LIVE') return 'LIVE';
  if (text === 'DEMO') return 'DEMO';
  return null;
}

function readQueryParam(){
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return normaliseMode(params.get('mode'));
  } catch (err) {
    return null;
  }
}

function readStoredMode(){
  if (typeof window === 'undefined') return null;
  try {
    return normaliseMode(window.localStorage.getItem(STORAGE_KEY));
  } catch (err) {
    return null;
  }
}

function writeStoredMode(mode){
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    /* ignore storage errors */
  }
}

function syncUrl(mode){
  if (typeof window === 'undefined') return;
  try {
    const search = new URLSearchParams(window.location.search);
    search.set('mode', mode.toLowerCase());
    const next = `${window.location.pathname}?${search.toString()}`;
    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState(null, '', next);
    } else {
      window.location.replace(next);
    }
  } catch (err) {
    /* noop */
  }
}

function notify(mode){
  if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
  document.dispatchEvent(new CustomEvent('mode:change', {detail: {mode}}));
}

export const ModeStore = {
  mode: DEFAULT_MODE,
  init(){
    const query = readQueryParam();
    const stored = readStoredMode();
    this.mode = query || stored || DEFAULT_MODE;
    if (typeof window !== 'undefined') {
      window.ModeStore = this;
    }
    return this.mode;
  },
  set(mode){
    const next = normaliseMode(mode) || DEFAULT_MODE;
    const changed = next !== this.mode;
    this.mode = next;
    writeStoredMode(next);
    syncUrl(next);
    if (changed) {
      notify(next);
    }
    if (typeof window !== 'undefined') {
      window.ModeStore = this;
    }
    return this.mode;
  }
};

if (typeof window !== 'undefined') {
  window.ModeStore = ModeStore;
}
