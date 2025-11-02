import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { loadSamples } from '../services/dataSource.js';
import { AppState } from '../appState.js';
import { renderSummary } from '../render/summaryRender.js';

function mountPageLayout(){
  const container = document.getElementById('page-content');
  if (!container || container.dataset.bound === 'true') {
    return;
  }

  container.dataset.bound = 'true';
  container.innerHTML = `
    <div id="app" class="page">
      <template id="tpl-kpi">
        <article class="kpi--brand" role="group" aria-labelledby="kpi-title">
          <header class="kpi-head">
            <div id="kpi-title" class="kpi-title"></div>
            <span class="delta same" aria-live="polite">
              <svg aria-hidden="true" viewBox="0 0 10 10"><path/></svg>
              <span class="delta-text">No change</span>
            </span>
          </header>
          <div class="kpi-value">
            <span class="kpi-number num">--</span>
            <span class="kpi-unit"></span>
          </div>
          <svg class="spark" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
            <path class="ci"></path>
            <path class="line"></path>
          </svg>
          <footer class="kpi-footer">
            <span class="updated">Updated</span>
            <span class="pts">0 pts</span>
          </footer>
        </article>
      </template>
      <nav id="side-nav" class="sidebar"></nav>
      <div class="main page-wrap">
        <section class="card card--context" aria-live="polite">
          <div id="global-caption"></div>
          <div class="page-subhead">
            <span id="period-label"></span>
            <span id="asof-label" class="muted"></span>
          </div>
          <span id="org-badge" class="pill brand-pill range-pill" hidden></span>
          <div id="scenario-banner" class="banner banner--demo" role="status" hidden>
            <span class="banner__text"></span>
          </div>
          <div id="sum-toast" class="toast" aria-live="polite" role="status" hidden></div>
        </section>
        <section class="card card--summary" aria-live="polite">
          <div id="summary-root" class="space-y-6">
            <div id="kpi-row" class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4"></div>
            <div id="trends" class="grid gap-6 lg:grid-cols-3"></div>
            <div id="at-risk"></div>
          </div>
        </section>
      </div>
    </div>
    <div id="legend-modal" class="modal" aria-hidden="true">
      <div class="modal__backdrop"></div>
      <section class="modal__panel legend-modal summary-legend" role="dialog" aria-modal="true" aria-labelledby="legend-title" aria-describedby="legend-body" tabindex="-1">
        <div class="legend-header">
          <h3 id="legend-title">Legend</h3>
          <button id="legend-close" class="legend-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="legend-body" id="legend-body"></div>
      </section>
    </div>
  `;
}

async function applyMode(mode){
  const next = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  ModeStore.set(next);
  AppState.setMode(next);
  updateScenarioBanner(next);
  AppState.setSamples(await loadSamples(next));
  renderSummary();
}

async function initPage(){
  mountPageLayout();
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Summary',
    mode: ModeStore.mode,
    onModeChange: m => applyMode(m),
    controls: {
      ranges: ['Today','7 Days','Month to date','Quarter to date','Year to date'],
      showTeam: true,
      showDates: true,
      showCompare: true
    }
  });
  if (typeof window.renderSideNav === 'function') {
    window.renderSideNav('summary');
  }
  window.DateControls?.mount('#rangeSwitch', {
    presets: ['Today', '7D', 'MTD', 'QTD', 'YTD'],
    compare: true
  });
  window.Caption?.render('#global-caption', {
    asOf: new Date(),
    insight: window.PageInsight || ''
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
