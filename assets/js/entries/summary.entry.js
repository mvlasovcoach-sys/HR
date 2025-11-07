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
import '../config.js';
import '../caption.js';
import '../lazy-charts.js';
import '../guard.js';
import '../appState.js';
import '../config/thresholds.js';
import '../lib/status.js';
import '../lib/scores.js';
import '../services/dataSource.js';
import '../render/summaryRender.js';
import '../ui/modal.js';
import '../summary.legend.js';
import '../about.js';
import '../exporter.js';
import '../auth.js';
import '../guards.js';
import '../theme.js';
import '../asof.js';
import '../hr-board.neon.js';

import '../stores/modeStore.js';
import '../components/Toolbar.js';
import '../pages/summary.js';

import { mountKpiCards, KPI_CONFIG } from '../../../components/kpi-cards/kpi-cards.js';
import { getKpiData } from '../../../adapters/kpiAdapter.js';

const devError = globalThis.devError || ((...args) => console.error(...args));

function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

async function initKpiCardsIfNeeded() {
  let isNew = false;
  try {
    const params = new URLSearchParams(window.location.search);
    isNew = params.get('kpi') === 'new';
  } catch (err) {
    isNew = false;
  }

  if (isNew) {
    document.body?.setAttribute('data-kpi', 'new');
  }

  if (document.body?.dataset?.kpi !== 'new') {
    return;
  }

  try {
    const data = await getKpiData();
    await mountKpiCards('#kpi', data, KPI_CONFIG);
  } catch (err) {
    devError('Summary KPI mount failed:', err);
  }
}

onDomReady(() => {
  initKpiCardsIfNeeded().catch(err => devError('Summary KPI init error:', err));
});
