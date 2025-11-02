const MODE_STORAGE_KEY = 'spa2099_mode';
const LEGACY_SCENARIO_KEY = 'hr:scenario';
const DEFAULT_MODE = 'DEMO';

function normaliseMode(value){
  if (!value && value !== 0) return null;
  const text = String(value).trim().toUpperCase();
  if (text === 'LIVE' || text === 'DEMO') return text;
  if (text === 'NIGHT' || text === 'NIGHT_SHIFT' || text === 'NIGHT-SHIFT') return 'DEMO';
  return null;
}

function readQueryMode(){
  try {
    const params = new URLSearchParams(window.location.search);
    return normaliseMode(params.get('mode'));
  } catch (err) {
    return null;
  }
}

function readStoredMode(){
  try {
    return normaliseMode(localStorage.getItem(MODE_STORAGE_KEY));
  } catch (err) {
    return null;
  }
}

function readLegacyScenario(){
  try {
    const scenario = localStorage.getItem(LEGACY_SCENARIO_KEY);
    if (!scenario) return null;
    return scenario === 'night' ? 'DEMO' : 'LIVE';
  } catch (err) {
    return null;
  }
}

function writeLegacyScenario(mode){
  const scenario = mode === 'DEMO' ? 'night' : 'live';
  try {
    localStorage.setItem(LEGACY_SCENARIO_KEY, scenario);
  } catch (err) {
    /* ignore quota errors */
  }
  try {
    dispatchEvent(new StorageEvent('storage', {key: LEGACY_SCENARIO_KEY}));
  } catch (err) {
    /* ignore event errors */
  }
}

function syncQueryParam(mode){
  try {
    const params = new URLSearchParams(window.location.search);
    const lower = mode.toLowerCase();
    if (params.get('mode') === lower) {
      return;
    }
    params.set('mode', lower);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);
  } catch (err) {
    /* noop */
  }
}

export const ModeStore = {
  mode: DEFAULT_MODE,
  init(){
    const query = typeof window !== 'undefined' ? readQueryMode() : null;
    const stored = typeof window !== 'undefined' ? readStoredMode() : null;
    const legacy = typeof window !== 'undefined' ? readLegacyScenario() : null;
    this.mode = query || stored || legacy || DEFAULT_MODE;
    return this.mode;
  },
  set(nextMode){
    const resolved = normaliseMode(nextMode) || DEFAULT_MODE;
    this.mode = resolved;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, resolved);
    } catch (err) {
      /* ignore quota errors */
    }
    writeLegacyScenario(resolved);
    syncQueryParam(resolved);
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent('mode:change', {detail: {mode: resolved}}));
    }
    return this.mode;
  }
};
