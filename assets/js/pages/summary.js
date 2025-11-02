import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { loadSamples } from '../services/dataSource.js';
import { AppState } from '../appState.js';
import { renderSummary } from '../render/summaryRender.js';

async function applyMode(mode){
  ModeStore.set(mode);
  AppState.setMode(mode);
  AppState.setSamples(await loadSamples(mode));
  renderSummary(); // строит KPI/Trends/At-Risk или empty для Live
}
async function initPage(){
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Summary',
    mode: ModeStore.mode,
    onModeChange: applyMode
  });
  await applyMode(ModeStore.mode); // DEMO по умолчанию
}
document.addEventListener('DOMContentLoaded', initPage);
