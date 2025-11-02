import { AppState } from '../appState.js';
import { renderToolbar } from '../components/Toolbar.js';
import { loadDemoSamples, loadLiveSamples } from '../modules/services/dataSource.js';
import { renderSummary } from '../render/summaryRender.js';
import { ModeStore } from '../stores/modeStore.js';

function t(key, fallback){
  try {
    const value = window.I18N?.t?.(key);
    if (value && value !== key) return value;
  } catch (err) {
    /* noop */
  }
  return fallback;
}

function updateBanner(mode, hasData){
  const banner = document.getElementById('scenario-banner');
  if (!banner) return;
  const textEl = banner.querySelector('.banner__text') || banner;
  const resolved = mode === 'LIVE' ? 'LIVE' : 'DEMO';
  const message = resolved === 'DEMO'
    ? t('summary.banner.demo', 'Demo scenario active — simulated data.')
    : hasData
      ? t('summary.banner.liveReady', 'Live (connected).')
      : t('summary.banner.liveEmpty', 'Live (connected). No live data yet.');
  banner.classList.toggle('banner--demo', resolved === 'DEMO');
  banner.classList.toggle('banner--live', resolved === 'LIVE');
  banner.dataset.mode = resolved;
  textEl.textContent = message;
  banner.hidden = false;
}

async function applyMode(mode){
  const resolved = mode === 'LIVE' ? 'LIVE' : 'DEMO';
  let samples = [];
  try {
    samples = resolved === 'DEMO'
      ? await loadDemoSamples()
      : await loadLiveSamples();
  } catch (err) {
    console.error('[Summary] Failed to load samples', err);
    samples = [];
  }
  AppState.setMode(resolved);
  AppState.setSamples(Array.isArray(samples) ? samples : []);
  updateBanner(resolved, Array.isArray(samples) && samples.length > 0);
  renderSummary();
}

function initSummary(){
  const mount = document.getElementById('toolbar');
  if (!mount) return;
  const initialMode = ModeStore.init();
  renderToolbar({
    mount,
    pageTitle: t('header.summary', 'Summary'),
    pageTitleKey: 'header.summary',
    mode: initialMode,
    infoButton: {
      id: 'legend-trigger',
      ariaLabel: t('ui.legend', 'Legend'),
      ariaLabelKey: 'ui.legend'
    },
    onModeChange: async next => {
      ModeStore.set(next);
      await applyMode(next);
    }
  });
  ModeStore.set(initialMode);
  applyMode(initialMode);
}

function boot(){
  initSummary();
}

if (document.readyState !== 'loading') {
  boot();
} else {
  document.addEventListener('DOMContentLoaded', boot);
}

document.addEventListener('i18n:change', () => {
  updateBanner(AppState.mode, Array.isArray(AppState.samples) && AppState.samples.length > 0);
});

document.addEventListener('mode:change', event => {
  const next = event?.detail?.mode || AppState.mode;
  updateBanner(next, Array.isArray(AppState.samples) && AppState.samples.length > 0);
});
