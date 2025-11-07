import '../utils/env.js';
import '../data-loader.js';
import '../api.js';
import '../i18n.js';
import '../team-filter.js';
import '../version.js';
import '../site.js';
import '../nav.js';
import '../app-shell.js';
import '../caption.js';
import '../lazy-charts.js';
import '../guard.js';
import '../about.js';
import '../auth.js';
import '../guards.js';
import '../theme.js';
import '../asof.js';
import { AppState } from '../stores/appState.js';
import { ModeStore } from '../stores/modeStore.js';

const devError = globalThis.devError || ((...args) => console.error(...args));

let corporateModulePromise;
let exporterModulePromise;
let toolbarModulePromise;
let kpiCardsModulePromise;
let kpiServiceModulePromise;

function loadCorporatePage() {
  corporateModulePromise ||= import('../pages/corporate.js');
  return corporateModulePromise;
}

function loadExporter() {
  exporterModulePromise ||= import('../exporter.js');
  return exporterModulePromise;
}

function loadToolbar() {
  toolbarModulePromise ||= import('../components/Toolbar.js');
  return toolbarModulePromise;
}

function loadKpiCards() {
  kpiCardsModulePromise ||= import('../components/kpi-cards/corporateCards.js');
  return kpiCardsModulePromise;
}

function loadKpiService() {
  kpiServiceModulePromise ||= import('../services/kpiService.js');
  return kpiServiceModulePromise;
}

function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function waitForI18n() {
  if (window.I18N?.onReady) {
    return new Promise(resolve => {
      window.I18N.onReady(() => resolve());
    });
  }
  return Promise.resolve();
}

const translate = (key, fallback) => window.I18N?.t?.(key, fallback) || fallback;

let kpiControllerPromise;
let currentRange = null;
let activeRequestId = 0;

async function ensureKpiController(){
  if (!kpiControllerPromise) {
    kpiControllerPromise = loadKpiCards().then(module =>
      module.mountCorporateKpiCards('#kpi', {
        onRetry: () => {
          if (currentRange) {
            fetchKpiSnapshot(currentRange).catch(err => {
              devError('KPI retry failed:', err);
            });
          }
        }
      })
    ).catch(err => {
      kpiControllerPromise = null;
      throw err;
    });
  }
  return kpiControllerPromise;
}

function resolveTeamId(){
  const teams = AppState.getActiveTeams?.();
  if (Array.isArray(teams) && teams.length) {
    return teams[0];
  }
  return 'all';
}

async function fetchKpiSnapshot(resolved){
  if (!resolved || !resolved.start || !resolved.end) return;
  currentRange = resolved;
  const controller = await ensureKpiController();
  const requestId = ++activeRequestId;
  controller.setLoading(true);
  try {
    const service = await loadKpiService();
    const mode = (ModeStore.mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
    const teamId = resolveTeamId();
    const data = await service.getKpis({
      start: resolved.start,
      end: resolved.end,
      compareStart: resolved.compare?.start,
      compareEnd: resolved.compare?.end,
      teamId,
      mode,
      lang: document.documentElement?.lang || 'en'
    });
    if (requestId !== activeRequestId) return;
    controller.update(data);
  } catch (err) {
    if (requestId !== activeRequestId) return;
    devError('KPI fetch failed:', err);
    const controller = await ensureKpiController();
    controller.showError(translate('actions.retry', 'Tap to retry'));
  }
}

function handleRangeChange(event){
  const resolved = event?.detail?.range;
  if (!resolved) return;
  fetchKpiSnapshot(resolved).catch(err => {
    devError('KPI range update failed:', err);
  });
}

function handleModeChange(mode){
  const resolved = currentRange || AppState.getResolvedRange?.();
  if (!resolved) return;
  fetchKpiSnapshot(resolved).catch(err => {
    devError('KPI mode update failed:', err);
  });
}

async function initKpiCards(){
  try {
    await ensureKpiController();
    document.addEventListener('state:range-changed', handleRangeChange);
    document.addEventListener('state:mode-changed', event => {
      handleModeChange(event?.detail?.mode);
    });
    const initialRange = AppState.getResolvedRange?.();
    if (initialRange) {
      fetchKpiSnapshot(initialRange).catch(err => {
        devError('KPI initial load failed:', err);
      });
    }
  } catch (err) {
    devError('KPI mount failed:', err);
  }
}

function bindExportButton() {
  const exportBtn = document.getElementById('tb-export');
  if (!exportBtn) return;
  exportBtn.addEventListener('click', async event => {
    event.preventDefault();
    try {
      const [exporter, toolbar] = await Promise.all([
        loadExporter(),
        loadToolbar()
      ]);
      await exporter.handleExportClick({
        trigger: exportBtn,
        onExport: toolbar.exportCurrentView
      });
    } catch (err) {
      devError('Export failed:', err);
    }
  });
}

function setupLayoutChrome() {
  try {
    if (typeof window.renderSideNav === 'function') {
      window.renderSideNav('corporate');
    }
  } catch (err) {
    devError('Side nav render failed:', err);
  }

  if (window.Caption?.render) {
    window.Caption.render('#global-caption', {
      asOf: new Date(),
      insight: window.PageInsight || ''
    });
  }
}

async function bootstrap() {
  await waitForI18n();
  const { bootstrapCorporatePage } = await loadCorporatePage();
  await bootstrapCorporatePage();
  await initKpiCards();
  AppState.notifyRange?.();
  bindExportButton();
  setupLayoutChrome();
}

onDomReady(() => {
  bootstrap().catch(err => {
    devError('Corporate bootstrap failed:', err);
  });
});
