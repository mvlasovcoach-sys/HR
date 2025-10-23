(function(){
  console.info('Summary init');
  const TILE_COUNT = 4;

  const SUMMARY = window.SUMMARY = window.SUMMARY || {};
  const RANGE = window.RANGE = window.RANGE || {};
  const selectionState = SUMMARY.state = SUMMARY.state || {range: '7d', start: null, end: null};

  const runtime = {
    loading: false,
    rangeStart: null,
    rangeEnd: null
  };

  const SHOW_KPI_DETAILS = window.SHOW_KPI_DETAILS === true;

  function ensureDate(value){
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) {
      return new Date(value.getTime());
    }
    const parsed = new Date(value);
    return isNaN(parsed) ? null : parsed;
  }

  const getToday = () => new Date();
  const fmt = (date, opts) => {
    const lang = window.I18N?.getLang?.() || 'en';
    return new Intl.DateTimeFormat(lang, opts).format(date);
  };

  SUMMARY.computePeriodLabel = computePeriodLabel;
  SUMMARY.setPeriodAndAsOf = setPeriodAndAsOf;
  SUMMARY.setDemoState = setDemoState;
  SUMMARY.clearDemo = () => setScenario('live');

  document.addEventListener('DOMContentLoaded', () => {
    applyScenarioFromUrl();
    if (!SHOW_KPI_DETAILS) {
      removeLegacyFooters();
    }
    bindTileNavigation();
    bindScenarioControls();
    applyRangeSelection(readRange());

    const start = () => {
      updateLegendButtonLabel();
      updateOrgBadge();
      setPeriodAndAsOf(selectionState);
      renderSkeleton();
      loadAndRender();
    };

    if (window.I18N?.onReady) {
      window.I18N.onReady(start);
    } else {
      start();
    }

    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
        if (evt.key === 'hr:range') {
          applyRangeSelection(readRange());
        }
        renderSkeleton();
        if (evt.key === 'hr:scenario') updateScenarioButtons();
        loadAndRender();
      }
    });

    const onLangRefresh = () => {
      updateLegendButtonLabel();
      updateOrgBadge();
      updateScenarioButtons();
      setPeriodAndAsOf(selectionState);
      if (!runtime.loading) {
        loadAndRender();
      }
    };

    document.addEventListener('i18n:change', onLangRefresh);
    document.addEventListener('language:changed', () => setPeriodAndAsOf(selectionState));

    window.addEventListener('site:ready', updateOrgBadge);
  });

  function bindTileNavigation(){
    document.getElementById('sum-kpi-grid')?.addEventListener('click', evt => {
      const tile = evt.target.closest('.tile');
      if (!tile) return;
      window.location.href = './Analytics.html';
    });
  }

  function bindScenarioControls(){
    const loadBtn = document.getElementById('btn-night-scenario');
    const resetBtn = document.getElementById('btn-night-reset');
    const returnLink = document.getElementById('btn-return-live');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        setScenario('night');
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        setScenario('live');
      });
    }
    if (returnLink) {
      returnLink.addEventListener('click', evt => {
        evt.preventDefault();
        SUMMARY.clearDemo();
      });
    }
    updateScenarioButtons();
  }

  function setScenario(mode){
    try {
      const prev = localStorage.getItem('hr:scenario') || 'live';
      const next = mode === 'night' ? 'night' : 'live';
      if (prev === next) return;
      localStorage.setItem('hr:scenario', next);
      window.dataLoader?.clear?.();
      dispatchEvent(new StorageEvent('storage', {key: 'hr:scenario'}));
    } catch (err) {
      console.warn('scenario set failed', err);
    }
    updateScenarioButtons();
    renderSkeleton();
    loadAndRender();
  }

  function readScenario(){
    try {
      return localStorage.getItem('hr:scenario') || 'live';
    } catch (err) {
      return 'live';
    }
  }

  function updateScenarioButtons(){
    const scenario = readScenario();
    const loadBtn = document.getElementById('btn-night-scenario');
    const resetBtn = document.getElementById('btn-night-reset');
    loadBtn?.setAttribute('aria-pressed', String(scenario === 'night'));
    resetBtn?.setAttribute('aria-pressed', String(scenario !== 'night'));
    if (scenario === 'night') {
      loadBtn?.classList.add('is-active');
      resetBtn?.classList.remove('is-active');
    } else {
      resetBtn?.classList.add('is-active');
      loadBtn?.classList.remove('is-active');
    }
    updateScenarioParam(scenario === 'night');
    setDemoState(scenario === 'night');
  }

  function setDemoState(active){
    const banner = document.getElementById('demo-banner');
    if (!banner) return;
    banner.hidden = !active;
    if (active) {
      if (window.I18N?.refresh) {
        window.I18N.refresh(banner);
      }
    }
    document.querySelectorAll('.banner-legacy').forEach(node => node.remove());
  }

  function updateScenarioParam(active){
    if (typeof history?.replaceState !== 'function') return;
    try {
      const url = new URL(window.location.href);
      if (active) {
        url.searchParams.set('scenario', 'night');
      } else {
        url.searchParams.delete('scenario');
      }
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch (err) {
      // ignore URL issues
    }
  }

  function applyScenarioFromUrl(){
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('scenario') === 'night' && readScenario() !== 'night') {
        localStorage.setItem('hr:scenario', 'night');
      }
    } catch (err) {
      // ignore malformed URLs
    }
  }

  function readRange(){
    try {
      const raw = localStorage.getItem('hr:range');
      if (!raw) return {preset: '7d'};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.preset) return parsed;
        if (parsed.start && parsed.end) return parsed;
      }
    } catch (err) {
      // ignore parse errors
    }
    return {preset: '7d'};
  }

  function applyRangeSelection(range){
    const preset = typeof range?.preset === 'string' ? range.preset : null;
    const parseDate = value => {
      if (!value) return null;
      if (value instanceof Date) {
        return isNaN(value) ? null : value;
      }
      const parsed = new Date(value);
      return isNaN(parsed) ? null : parsed;
    };
    selectionState.range = preset || (range?.start && range?.end ? 'custom' : '7d');
    selectionState.start = parseDate(range?.start);
    selectionState.end = parseDate(range?.end);
    setPeriodAndAsOf(selectionState);
  }

  function getRangeKey(range){
    if (range?.preset) {
      if (range.preset === 'day') return '7d';
      if (range.preset === '7d' || range.preset === 'month' || range.preset === 'year') return range.preset;
    }
    if (range?.start && range?.end) {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (!isNaN(start) && !isNaN(end)) {
        const diff = Math.abs(end - start) / (1000 * 60 * 60 * 24);
        if (diff > 120) return 'year';
        if (diff > 21) return 'month';
      }
    }
    return '7d';
  }

  function renderSkeleton(){
    const grid = document.getElementById('sum-kpi-grid');
    if (!grid) return;
    const skeleton = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      skeleton.push(`<div class="tile tile--skeleton skeleton tile--compact kpi-tile" aria-hidden="true">
        <div class="tile__head"><span class="skeleton skeleton--text"></span></div>
        <div class="tile__kpi tile__value"><span class="skeleton skeleton--value"></span></div>
        <div class="tile__spark spark"><span class="skeleton skeleton--spark"></span></div>
      </div>`);
    }
    grid.innerHTML = skeleton.join('');
  }

  async function loadAndRender(){
    runtime.loading = true;
    if (document?.body) {
      document.body.classList.add('is-loading');
    }
    const range = readRange();
    RANGE.current = range;
    applyRangeSelection(range);
    const grid = document.getElementById('sum-kpi-grid');
    if (!grid) {
      runtime.loading = false;
      if (document?.body) {
        document.body.classList.remove('is-loading');
      }
      return;
    }
    try{
      const key = getRangeKey(range);
      const [metrics, trend] = await Promise.all([
        window.dataLoader.fetch(`./data/org/metrics_${key}.json`, {range}),
        window.dataLoader.fetch('./data/org/metrics_7d.json')
      ]);
      updateRangeMetadata(metrics);
      renderKpis(metrics, trend);
    }catch(err){
      console.error('Summary metrics failed', err);
      grid.innerHTML = '';
      runtime.rangeStart = runtime.rangeEnd = null;
      setPeriodAndAsOf(selectionState);
      toast(window.I18N?.t('toast.summaryError') || window.I18N?.t('status.noData') || 'Unable to load data');
    } finally {
      runtime.loading = false;
      if (document?.body) {
        document.body.classList.remove('is-loading');
      }
    }
  }

  function updateRangeMetadata(metrics){
    const dates = Array.isArray(metrics?.heatmap?.dates) ? metrics.heatmap.dates.filter(Boolean) : [];
    runtime.rangeStart = dates.length ? dates[0] : null;
    runtime.rangeEnd = dates.length ? dates[dates.length - 1] : null;
  }

  function renderKpis(metrics, trend){
    const grid = document.getElementById('sum-kpi-grid');
    if(!grid) return;
    if (!SHOW_KPI_DETAILS) {
      removeLegacyFooters();
    }
    const kpi = metrics?.kpi || {};
    const delta = metrics?.delta || {};
    const nValue = Number(metrics?.n);
    const lang = window.I18N?.getLang?.() || 'en';
    const numberFmt = new Intl.NumberFormat(lang, {maximumFractionDigits: 0});
    grid.innerHTML = '';
    if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, grid)) {
      return;
    }
    if (!Number.isFinite(nValue)) {
      grid.removeAttribute('data-guard');
    }

    const sparkSeries = buildSparkSeries(trend?.heatmap);

    const defs = [
      { key:'wellbeing_avg',         label:()=>window.I18N?.t('kpi.orgWellbeing') || window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',     unit:'/100', fmt:v=>Math.round(v) },
      { key:'high_stress_pct',       label:()=>window.I18N?.t('kpi.highStress') || window.I18N?.t('metric.highStress') || 'High Stress %',   unit:'%',    fmt:v=>Math.round(v) },
      { key:'fatigue_elevated_pct',  label:()=>window.I18N?.t('kpi.elevatedFatigue') || window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue %',  unit:'%',    fmt:v=>Math.round(v) },
      { key:'engagement_active_pct', label:()=>window.I18N?.t('kpi.activeEngagement') || window.I18N?.t('metric.activeEngagement') || 'Active Engagement %', unit:'%',    fmt:v=>Math.round(v) }
    ];

    grid.innerHTML = defs.map((d, index)=>{
      const raw = Number(kpi?.[d.key]);
      const formattedValue = Number.isFinite(raw) ? d.fmt(raw) : null;
      const val = formattedValue != null ? numberFmt.format(formattedValue) : '—';
      const dRaw = Number(delta?.[d.key]);
      const del  = Number.isFinite(dRaw) ? dRaw : null;
      const badgeValue = del !== null ? Math.abs(Math.round(del)) : null;
      const badgeLabel = badgeValue !== null ? numberFmt.format(badgeValue) : '';
      const badge = del!==null ? `<span class="tile__badge pill ${del>=0?'pill--strong':'pill--critical'}">${del>=0?'▲':'▼'} ${badgeLabel}</span>`:'';
      const spark = sparkline(sparkSeries);
      return `<div class="tile tile--interactive tile--compact kpi kpi-tile" data-index="${index}">
        <div class="tile__head">${d.label()} ${badge}</div>
        <div class="tile__kpi tile__value">${val}<small>${d.unit}</small></div>
        <div class="tile__spark spark">${spark}</div>
      </div>`;
    }).join('');
  }

  function removeLegacyFooters(){
    document.querySelectorAll('.kpi-footer').forEach(node => node.remove());
  }

  function buildSparkSeries(heatmap){
    if (!heatmap || !heatmap.value || !heatmap.cols) return [];
    const cols = heatmap.cols.length;
    if (!cols) return [];
    const series = new Array(cols).fill(0);
    const counts = new Array(cols).fill(0);
    Object.values(heatmap.value).forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach((value, index) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
          series[index] += num;
          counts[index] += 1;
        }
      });
    });
    return series.map((sum, index) => counts[index] ? sum / counts[index] : null);
  }

  function sparkline(values){
    const points = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
    if (!points.length) return '';
    const width = 64;
    const height = 24;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const path = points.map((val, idx) => {
      const x = (idx / (points.length - 1 || 1)) * width;
      const y = height - ((val - min) / span) * height;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  }

  function toast(message){
    if (!message) return;
    const host = document.getElementById('sum-toast');
    if (!host) return;
    host.textContent = message;
    host.hidden = false;
    host.classList.add('is-visible');
    clearTimeout(host._hideTimer);
    host._hideTimer = setTimeout(() => {
      host.classList.remove('is-visible');
      host.hidden = true;
      host.textContent = '';
    }, 4000);
  }

  function updateOrgBadge(){
    const badge = document.getElementById('org-badge');
    if (!badge) return;
    if (!window.SITE) {
      badge.textContent = '';
      badge.hidden = true;
      return;
    }
    const lang = window.I18N?.getLang?.() || 'en';
    const numberFmt = new Intl.NumberFormat(lang, {maximumFractionDigits: 0});
    const name = window.SITE.name || 'Org';
    const headcount = Number(window.SITE.totals?.headcount) || 0;
    const staffLabel = window.I18N?.t('summary.staff') || 'staff';
    const equipped = headcount ? (window.I18N?.t('summary.equipped', {count: numberFmt.format(headcount)}) || '') : '';
    const parts = [`${name}`, `${numberFmt.format(headcount)} ${staffLabel}`];
    if (equipped) parts.push(equipped);
    badge.textContent = parts.join(' · ');
    badge.hidden = false;
  }

  function updateLegendButtonLabel(){
    const btn = document.getElementById('btn-legend');
    if (!btn) return;
    const label = window.I18N?.t('legend.title') || 'Legend';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  }

  function computePeriodLabel(stateLike){
    const target = stateLike || selectionState;
    const today = getToday();
    const range = target?.range || '7d';
    const selectedStart = ensureDate(target?.start);
    const selectedEnd = ensureDate(target?.end);
    const dataStart = ensureDate(runtime.rangeStart);
    const dataEnd = ensureDate(runtime.rangeEnd);

    const defaultStart = (() => {
      if (range === '7d') return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      if (range === 'month') return new Date(today.getFullYear(), today.getMonth(), 1);
      if (range === 'year') return new Date(today.getFullYear(), 0, 1);
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    })();

    const defaultEnd = (() => {
      if (range === 'day' || range === '7d') return new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (range === 'month') return new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return new Date(today.getFullYear(), 11, 31);
    })();

    const start = dataStart || selectedStart || defaultStart;
    const end = dataEnd || selectedEnd || defaultEnd;
    const opts = {month: 'short', day: 'numeric', year: 'numeric'};
    return start.getTime() === end.getTime()
      ? fmt(end, opts)
      : `${fmt(start, opts)} – ${fmt(end, opts)}`;
  }

  function setPeriodAndAsOf(stateLike){
    const periodEl = document.getElementById('period-label');
    const asofEl = document.getElementById('asof-label');
    const label = computePeriodLabel(stateLike);
    if (periodEl) {
      periodEl.textContent = window.I18N?.t('summary.period', {period: label}) || `Period: ${label}`;
    }
    if (asofEl) {
      const updatedDate = ensureDate(runtime.rangeEnd) || ensureDate(stateLike?.end) || getToday();
      const stamp = fmt(updatedDate, {month: 'short', day: 'numeric', year: 'numeric'});
      asofEl.textContent = window.I18N?.t('summary.asof', {ts: stamp}) || `updated ${stamp}`;
    }
    const startInput = document.getElementById('dc-start');
    const endInput = document.getElementById('dc-end');
    const fromText = window.I18N?.t('date.from') || window.I18N?.t('range.start') || 'From';
    const toText = window.I18N?.t('date.to') || window.I18N?.t('range.end') || 'To';
    if (startInput) {
      startInput.setAttribute('placeholder', fromText);
    }
    if (endInput) {
      endInput.setAttribute('placeholder', toText);
    }
  }
})();
