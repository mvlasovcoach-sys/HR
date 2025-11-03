import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';

const TITLE = 'Demo';

function syncScenario(mode, options = {}){
  const scenario = mode === 'LIVE' ? 'live' : 'night';
  const { forceEvent = false } = options;
  let shouldDispatch = forceEvent;
  try {
    const prev = localStorage.getItem('hr:scenario');
    if (prev !== scenario) {
      localStorage.setItem('hr:scenario', scenario);
      dispatchEvent(new StorageEvent('storage', { key: 'hr:scenario' }));
      shouldDispatch = true;
    }
  } catch (err) {
    shouldDispatch = true;
  }
  if (shouldDispatch) {
    document.dispatchEvent(new CustomEvent('app:scenarioChanged', { detail: { scenario } }));
  }
}

function applyMode(mode, options = {}){
  const normalized = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  ModeStore.set(normalized);
  syncScenario(normalized, options);
  return normalized;
}

function decorateToolbar(){
  const root = document.getElementById('toolbar');
  if (!root) return;
  const infoBtn = root.querySelector('.title .info');
  if (infoBtn) {
    infoBtn.setAttribute('data-about-open', '');
    infoBtn.setAttribute('aria-haspopup', 'dialog');
    infoBtn.setAttribute('aria-expanded', 'false');
  }
  const exportBtn = root.querySelector('#tb-export');
  if (exportBtn) {
    exportBtn.remove();
  }
}

function initPage(){
  const mount = document.getElementById('toolbar');
  if (!mount) return;
  ModeStore.init();
  renderToolbar({
    mount,
    title: TITLE,
    mode: ModeStore.mode,
    onModeChange: value => applyMode(value)
  });
  decorateToolbar();
  applyMode(ModeStore.mode, { forceEvent: true });
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
