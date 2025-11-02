import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { loadSamples } from '../services/dataSource.js';
import { AppState } from '../appState.js';
import { renderSummary } from '../render/summaryRender.js';

function updateBanner(mode){
  const banner = document.getElementById('scenario-banner');
  if (!banner) return;
  const textEl = banner.querySelector('.banner__text') || banner;
  const resolved = mode === 'LIVE' ? 'LIVE' : 'DEMO';
  const message = resolved === 'DEMO'
    ? 'Demo scenario active — simulated data.'
    : 'Live (connected). No live data yet.';
  banner.classList.toggle('banner--demo', resolved === 'DEMO');
  banner.classList.toggle('banner--live', resolved === 'LIVE');
  banner.dataset.mode = resolved;
  textEl.textContent = message;
  banner.hidden = false;
}

async function applyMode(mode){
  ModeStore.set(mode);
  const data = await loadSamples(mode);
  AppState.setMode(mode);
  AppState.setSamples(data);
  updateBanner(mode);
  renderSummary();
}

async function initPage(){
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Summary',
    mode: ModeStore.mode,
    onModeChange: applyMode
  });
  await applyMode(ModeStore.mode);
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
