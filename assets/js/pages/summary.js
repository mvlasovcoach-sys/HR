import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { loadSamples } from '../services/dataSource.js';
import { AppState } from '../appState.js';
import { renderSummary } from '../render/summaryRender.js';

async function applyMode(mode){
  const next = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  ModeStore.set(next);
  AppState.setMode(next);
  updateScenarioBanner(next);
  AppState.setSamples(await loadSamples(next));
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

document.addEventListener('DOMContentLoaded', initPage);

function updateScenarioBanner(mode){
  const banner = document.getElementById('scenario-banner');
  if (!banner) return;
  const textHost = banner.querySelector('.banner__text') || banner;
  const normalized = mode === 'LIVE' ? 'LIVE' : 'DEMO';
  banner.hidden = false;
  banner.classList.toggle('banner--demo', normalized === 'DEMO');
  banner.classList.toggle('banner--live', normalized === 'LIVE');
  textHost.textContent = normalized === 'DEMO'
    ? 'Demo scenario active — simulated data.'
    : 'Live mode enabled. Switch to Demo.';
}
