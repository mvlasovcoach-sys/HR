import { AppState } from '../appState.js';
import { loadDemoSamples, loadLiveSamples } from '../modules/services/dataSource.js';
import { renderSummary } from '../render/summaryRender.js';

document.querySelector('#btnNight')?.addEventListener('click', async (e) => {
  e.preventDefault();
  AppState.setMode('DEMO');
  AppState.setSamples(await loadDemoSamples());
  renderSummary();
});

document.querySelector('#btnReturnLive')?.addEventListener('click', async (e) => {
  e.preventDefault();
  AppState.setMode('LIVE');
  AppState.setSamples(await loadLiveSamples());
  renderSummary();
});

renderSummary();
