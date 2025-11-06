import '../utils/env.js';
import '../data-loader.js';
import '../api.js';
import '../i18n.js';
import '../team-filter.js';
import '../version.js';
import '../site.js';
import '../nav.js';
import '../app-shell.js';
import '../date-controls.js';
import '../caption.js';
import '../lazy-charts.js';
import '../guard.js';
import '../about.js';
import '../auth.js';
import '../guards.js';
import '../theme.js';
import '../asof.js';

import { bootstrapCorporatePage } from '../pages/corporate.js';
import { handleExportClick } from '../exporter.js';
import { mountKpiCards, KPI_CONFIG } from '../../../components/kpi-cards/kpi-cards.js';
import { exportCurrentView } from '../components/Toolbar.js';
import { getKpiData } from '../../../adapters/kpiAdapter.js';

const devError = globalThis.devError || ((...args) => console.error(...args));

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

async function initKpiCards() {
  try {
    const data = await getKpiData();

    function bindExternalRange(cb) {
      document.addEventListener('toolbar:range', event => {
        const range = event?.detail?.range;
        cb(range);
      });
    }

    mountKpiCards('#kpi', data, KPI_CONFIG, {
      initialRange: '1d',
      bindExternalRange
    });
  } catch (err) {
    devError('KPI mount failed:', err);
  }
}

function bindExportButton() {
  const exportBtn = document.getElementById('tb-export');
  if (!exportBtn) return;
  exportBtn.removeEventListener('click', exportCurrentView);
  exportBtn.addEventListener('click', async event => {
    event.preventDefault();
    try {
      await handleExportClick({ trigger: exportBtn, onExport: exportCurrentView });
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

  if (window.DateControls?.mount) {
    window.DateControls.mount('#tb-quick', {
      presets: ['Today', '7D', 'MTD', 'QTD', 'YTD'],
      compare: false,
      startSlot: '#tb-dates [data-date-slot="start"]',
      endSlot: '#tb-dates [data-date-slot="end"]',
      compareSlot: '#tb-compare'
    });
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
  await bootstrapCorporatePage();
  await initKpiCards();
  bindExportButton();
  setupLayoutChrome();
}

onDomReady(() => {
  bootstrap().catch(err => {
    devError('Corporate bootstrap failed:', err);
  });
});
