import '../utils/env.js';
import '../data-loader.js';
import '../api.js';
import '../i18n.js';
import '../sources.js';
import '../source-badge.js';
import '../team-filter.js';
import '../toolbar.js';
import '../scenario.badge.js';
import '../version.js';
import '../site.js';
import '../nav.js';
import '../app-shell.js';
import '../date-controls.js';
import '../caption.js';
import '../lazy-charts.js';
import '../guard.js';
import '../guards.js';
import '../dev.source-guard.js';
import '../auth.js';
import '../theme.js';
import '../exporter.js';
import '../demo.utils.js';
import '../asof.js';

import '../modules/components/DemoToolbar/index.js';
import '../stores/modeStore.js';
import '../demo.js';

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

function bindRangeSwitch(rangeSwitch) {
  if (!rangeSwitch) return;
  rangeSwitch.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-r]');
    if (!(button instanceof Element)) return;
    const range = button.getAttribute('data-r');
    if (!range) return;
    rangeSwitch.querySelectorAll('.seg-btn').forEach(el => el.classList.remove('is-active'));
    button.classList.add('is-active');
    document.dispatchEvent(new CustomEvent('demo:range', { detail: { range } }));
  });
}

async function initDemoKpi(rangeSwitch) {
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
    if (rangeSwitch) {
      rangeSwitch.setAttribute('hidden', '');
    }
    return;
  }

  try {
    const data = await getKpiData();
    await mountKpiCards('#kpi', data, KPI_CONFIG, {
      initialRange: '1d',
      bindExternalRange(cb) {
        document.addEventListener('demo:range', event => {
          const range = event.detail?.range;
          if (typeof range === 'string') {
            cb(range);
          }
        });
      }
    });
    bindRangeSwitch(rangeSwitch);
  } catch (err) {
    devError('Demo KPI mount failed:', err);
  }
}

function setupLayoutChrome() {
  try {
    window.renderSideNav?.('demo');
  } catch (err) {
    devError('Side nav render failed:', err);
  }

  try {
    window.Caption?.render('#global-caption', {
      asOf: new Date(),
      insight: window.PageInsight || ''
    });
  } catch (err) {
    devError('Caption render failed:', err);
  }
}

onDomReady(() => {
  const rangeSwitch = document.getElementById('demo-range');
  initDemoKpi(rangeSwitch).catch(err => devError('Demo KPI init error:', err));
  setupLayoutChrome();
});
