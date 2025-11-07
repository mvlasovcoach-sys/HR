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
import { clampToDemo } from '../utils/dateRange.js';
import { demoBounds } from '../services/demoData.js';

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
let demoFallbackActive = false;

const DEMO_FALLBACK_MESSAGE = 'No demo data for this period — switched to 7 Days';

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
  const startISO = resolved?.startISO || resolved?.start;
  const endISO = resolved?.endISO || resolved?.end;
  if (!startISO || !endISO) return;
  currentRange = resolved;
  const controller = await ensureKpiController();
  const requestId = ++activeRequestId;
  controller.setLoading(true);
  try {
    const service = await loadKpiService();
    const mode = (ModeStore.mode || '').toLowerCase() === 'live' ? 'live' : 'demo';
    const teamId = resolveTeamId();
    if (mode === 'demo') {
      const bounds = await demoBounds();
      if (requestId !== activeRequestId) return;
      const clampResult = clampToDemo({ startISO, endISO }, bounds);
      if (!clampResult.ok) {
        demoFallbackActive = true;
        controller.setLoading(false);
        controller.setNotice?.(DEMO_FALLBACK_MESSAGE);
        if (resolved.kind !== '7d') {
          AppState.setRangeKind('7d');
        }
        return;
      }
    }

    const data = await service.getKpis({
      startISO,
      endISO,
      compareStartISO: resolved.compare?.startISO || resolved.compare?.start,
      compareEndISO: resolved.compare?.endISO || resolved.compare?.end,
      teamId,
      mode,
      lang: document.documentElement?.lang || 'en'
    });
    if (requestId !== activeRequestId) return;
    if (mode === 'demo') {
      if (data?.reason === 'no-demo-range' || data?.isInsufficient) {
        demoFallbackActive = true;
        controller.setLoading(false);
        controller.setNotice?.(DEMO_FALLBACK_MESSAGE);
        if (resolved.kind !== '7d') {
          AppState.setRangeKind('7d');
        }
        return;
      }
      demoFallbackActive = resolved.kind === '7d' ? demoFallbackActive : false;
    } else {
      demoFallbackActive = false;
    }
    controller.setNotice?.(demoFallbackActive ? DEMO_FALLBACK_MESSAGE : null);
    controller.update(data);
  } catch (err) {
    if (requestId !== activeRequestId) return;
    devError('KPI fetch failed:', err);
    controller.showError(translate('actions.retry', 'Retry'));
  }
}

function handleRangeChange(event){
  const resolved = event?.detail?.range;
  if (!resolved) return;
  fetchKpiSnapshot(resolved).catch(err => {
    devError('KPI range update failed:', err);
  });
}

async function handleModeChange(mode){
  const resolved = currentRange || await AppState.getResolvedRangeAsync?.();
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
    const initialRange = await AppState.getResolvedRangeAsync?.();
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
