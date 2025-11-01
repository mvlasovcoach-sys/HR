import { AppState } from '../appState.js';
import { loadDemoSamples, loadLiveSamples } from '../modules/services/dataSource.js';
import { renderSummary } from '../render/summaryRender.js';

const DEBUG = false;

function dumpJson(data){
  if (!DEBUG) return;
  const host = document.getElementById('nightDump');
  if (host) {
    try {
      host.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      host.textContent = 'Failed to stringify data';
    }
  }
  console.debug('Summary dataset', data);
}

async function switchToDemo(event){
  event?.preventDefault?.();
  try {
    AppState.setMode('DEMO');
    const data = await loadDemoSamples();
    AppState.setSamples(data);
    dumpJson(data);
    renderSummary();
  } catch (err) {
    console.error('Failed to load demo samples', err);
  }
}

async function switchToLive(event){
  event?.preventDefault?.();
  try {
    AppState.setMode('LIVE');
    const data = await loadLiveSamples();
    AppState.setSamples(data);
    dumpJson(data);
    renderSummary();
  } catch (err) {
    console.error('Failed to load live samples', err);
  }
}

function mount(){
  document.querySelector('#btnNight')?.addEventListener('click', switchToDemo);
  document.querySelector('#btnReturnLive')?.addEventListener('click', switchToLive);
  document.querySelector('#btnReturnLiveBanner')?.addEventListener('click', switchToLive);
  renderSummary();
  if (AppState.mode === 'DEMO') {
    switchToDemo();
  } else {
    switchToLive();
  }
}

document.addEventListener('DOMContentLoaded', mount);

export { switchToDemo, switchToLive };
