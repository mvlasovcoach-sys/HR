import {mountKpi, renderKpiSkeletons, renderKpiEmpty} from './components/kpi.js';
import { appStore } from './modules/store/appState.js';
import { STRINGS as METRIC_HINT_STRINGS } from './modules/i18n/strings.js';
import { mapToStatus } from './modules/lib/status.js';
import { devError, devWarn } from './utils/env.js';

(function(){
  const loaderGlobals = window.loaderGlobals || {};
  const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : (url => url);
  const loadJson = typeof loaderGlobals.fetchJson === 'function'
    ? loaderGlobals.fetchJson
    : async url => {
        const response = await fetch(url, {cache: 'no-store'});
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      };
  function versionedUrl(path, options = {}){
    const url = new URL(path, document.baseURI);
    const {range, team, params} = options || {};
    if (range && typeof range === 'object') {
      Object.entries(range).forEach(([key, value]) => {
        if (value != null) url.searchParams.set(key, value);
      });
    }
    if (team != null) {
      url.searchParams.set('team', team);
    }
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) url.searchParams.set(key, value);
      });
    }
    return applyVersion(url.toString());
  }

  function fetchData(path, options){
    return loadJson(versionedUrl(path, options));
  }
  console.info('Summary init');
  const TILE_COUNT = 4;
  const KPI_TOP_ID = 'kpi-top';

  const SUMMARY = window.SUMMARY = window.SUMMARY || {};
  const RANGE = window.RANGE = window.RANGE || {};
  const selectionState = SUMMARY.state = SUMMARY.state || {range: '7d', displayRange: '7d', start: null, end: null};

  const runtime = {
    loading: false,
    rangeStart: null,
    rangeEnd: null
  };

  const store = appStore;
  const DATA_PREVIEW_CARD_ID = 'demo-data-preview';
  const DATA_PREVIEW_JSON_ID = 'demo-data-json';
  let lastScenarioMode = null;

  SUMMARY.metricHints = METRIC_HINT_STRINGS;
  window.METRIC_HINTS = METRIC_HINT_STRINGS;
  SUMMARY.dataStore = store;
  SUMMARY.loadSamples = mode => store.loadSamples(mode);

  store.subscribe(updateDataPreview);

  let rendering = false;


  function ensureDate(value){
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) {
      return new Date(value.getTime());
    }
    const parsed = new Date(value);
    return isNaN(parsed) ? null : parsed;
  }

  const getToday = () => new Date();
  const getLang = () => window.I18N?.getLang?.() || 'en';
  const defaultDateOptions = lang => (lang === 'ru'
    ? {day: '2-digit', month: '2-digit', year: 'numeric'}
    : {day: 'numeric', month: 'short', year: 'numeric'});
  const formatLocaleDate = (date, opts) => {
    if (!(date instanceof Date) || Number.isNaN(date)) return '';
    const lang = getLang();
    const options = opts || defaultDateOptions(lang);
    try {
      return new Intl.DateTimeFormat(lang, options).format(date);
    } catch (err) {
      return date.toLocaleDateString();
    }
  };
  const fmt = (date, opts) => formatLocaleDate(date, opts);

  function canonicalPreset(value){
    const key = String(value || '').toLowerCase();
    if (key === 'today' || key === 'day') return '7d';
    if (key === 'mtd' || key === 'month') return 'month';
    if (key === 'qtd' || key === 'quarter') return 'month';
    if (key === 'ytd' || key === 'year') return 'year';
    if (key === '7d') return '7d';
    return null;
  }

  function displayPreset(value){
    const key = String(value || '').toLowerCase();
    if (key === 'today' || key === 'day') return 'today';
    if (key === 'mtd' || key === 'month') return 'mtd';
    if (key === 'qtd' || key === 'quarter') return 'qtd';
    if (key === 'ytd' || key === 'year') return 'ytd';
    if (key === '7d') return '7d';
    return null;
  }

  SUMMARY.computePeriodLabel = computePeriodLabel;
  SUMMARY.setPeriodAndAsOf = setPeriodAndAsOf;
  SUMMARY.setDemoState = setDemoState;
  SUMMARY.clearDemo = () => setScenario('live');

  document.addEventListener('DOMContentLoaded', () => {
    applyScenarioFromUrl();
    bindTileNavigation();
    bindScenarioControls();
    applyRangeSelection(readRange());

    const start = () => {
      updateLegendButtonLabel();
      updateOrgBadge();
      setPeriodAndAsOf(selectionState);
      renderSkeleton();
      initPage();
      ensureStoreMode();
      refreshSamples({force: true});
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
        initPage();
        if (evt.key === 'hr:scenario') {
          refreshSamples({force: true});
        }
      }
    });

    const onLangRefresh = () => {
      updateLegendButtonLabel();
      updateOrgBadge();
      updateScenarioButtons();
      setPeriodAndAsOf(selectionState);
      if (!runtime.loading) {
        initPage();
      }
    };

    document.addEventListener('i18n:change', onLangRefresh);
    document.addEventListener('language:changed', () => setPeriodAndAsOf(selectionState));

    window.addEventListener('site:ready', updateOrgBadge);
  });

  function bindTileNavigation(){
    document.getElementById(KPI_TOP_ID)?.addEventListener('click', evt => {
      const tile = evt.target.closest('.kpi--brand');
      if (!tile || tile.classList.contains('skeleton')) return;
      window.location.href = './Analytics.html';
    });
  }

  function bindScenarioControls(){
    const buttons = Array.from(document.querySelectorAll('.scenario-controls [data-scenario]'));
    const returnLink = document.getElementById('btn-return-live');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-scenario');
        if (mode === 'night' || mode === 'live') {
          setScenario(mode);
        }
      });
    });
    if (returnLink) {
      returnLink.addEventListener('click', evt => {
        evt.preventDefault();
        SUMMARY.clearDemo();
      });
    }
    updateScenarioButtons();
    refreshSamples();
  }

  function setScenario(mode){
    try {
      const prev = localStorage.getItem('hr:scenario') || 'live';
      const next = mode === 'night' ? 'night' : 'live';
      if (prev === next) return;
      localStorage.setItem('hr:scenario', next);
      dispatchEvent(new StorageEvent('storage', {key: 'hr:scenario'}));
    } catch (err) {
      devWarn('scenario set failed', err);
    }
    updateScenarioButtons();
    renderSkeleton();
    initPage();
    refreshSamples({force: true});
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
    const buttons = Array.from(document.querySelectorAll('.scenario-controls [data-scenario]'));
    buttons.forEach(btn => {
      const mode = btn.getAttribute('data-scenario');
      const isActive = (mode === 'night' && scenario === 'night') || (mode === 'live' && scenario !== 'night');
      btn.setAttribute('aria-pressed', String(isActive));
      btn.classList.toggle('is-active', isActive);
    });
    updateScenarioParam(scenario === 'night');
    setDemoState(scenario === 'night');
    ensureStoreMode();
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
    ensureStoreMode();
  }

  function ensureStoreMode(){
    const scenario = readScenario();
    const mode = scenarioToModeKey(scenario);
    store.setMode(mode);
    lastScenarioMode = mode;
    return mode;
  }

  function scenarioToModeKey(value){
    return value === 'night' ? 'DEMO' : 'LIVE';
  }

  async function refreshSamples(options = {}){
    const {force = false} = options || {};
    const scenario = readScenario();
    const mode = scenarioToModeKey(scenario);
    const state = store.getState();
    const shouldReload = force
      || mode !== lastScenarioMode
      || state.mode !== mode
      || (mode === 'DEMO' && !state.loading && !state.samples.length)
      || state.error;
    if (!shouldReload) {
      updateDataPreview(state);
      return state.samples;
    }
    lastScenarioMode = mode;
    try {
      await store.loadSamples(mode);
    } catch (err) {
      devError('[Summary] sample load failed', err);
    }
  }

  function updateDataPreview(state){
    const card = document.getElementById(DATA_PREVIEW_CARD_ID);
    const pre = document.getElementById(DATA_PREVIEW_JSON_ID);
    if (!card || !pre) return;
    if (state.mode !== 'DEMO') {
      card.hidden = true;
      pre.textContent = '';
      return;
    }
    card.hidden = false;
    if (state.loading) {
      pre.textContent = 'Loading night-shift demo data…';
      return;
    }
    if (state.error) {
      pre.textContent = `Error: ${state.error}`;
      return;
    }
    const preview = state.samples.slice(0, 5).map(sample => ({
      person_id: sample.person_id,
      ts: sample.ts,
      scores: sample.scores,
      status: {
        stress: mapToStatus('stress', sample.scores.stress),
        burnout: mapToStatus('burnout', sample.scores.burnout),
        fatigue: mapToStatus('fatigue', sample.scores.fatigue)
      },
      explain: sample.explain
    }));
    pre.textContent = JSON.stringify(preview, null, 2);
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
    const canonical = preset ? canonicalPreset(preset) : null;
    const display = preset ? displayPreset(preset) : null;
    const parseDate = value => {
      if (!value) return null;
      if (value instanceof Date) {
        return isNaN(value) ? null : value;
      }
      const parsed = new Date(value);
      return isNaN(parsed) ? null : parsed;
    };
    selectionState.range = canonical || (range?.start && range?.end ? 'custom' : '7d');
    selectionState.displayRange = display || (range?.start && range?.end ? 'custom' : '7d');
    selectionState.start = parseDate(range?.start);
    selectionState.end = parseDate(range?.end);
    setPeriodAndAsOf(selectionState);
  }

  function getRangeKey(range){
    if (range?.preset) {
      const preset = canonicalPreset(range.preset);
      if (preset) return preset;
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
    const host = document.getElementById(KPI_TOP_ID);
    if (!host) return;
    host.classList.add('is-skeleton');
    host.setAttribute('aria-busy', 'true');
    renderKpiSkeletons(host, TILE_COUNT);
  }

  async function initPage(){
    if (rendering) return;
    rendering = true;
    try {
      await render();
    } finally {
      rendering = false;
    }
  }

  async function render(){
    runtime.loading = true;
    if (document?.body) {
      document.body.classList.add('is-loading');
    }
    const range = readRange();
    RANGE.current = range;
    applyRangeSelection(range);
    const host = document.getElementById(KPI_TOP_ID);
    if (!host) {
      runtime.loading = false;
      if (document?.body) {
        document.body.classList.remove('is-loading');
      }
      return;
    }
    try {
      const key = getRangeKey(range);
      const [metrics, trend] = await Promise.all([
        fetchData(`./data/org/metrics_${key}.json`, {range}),
        fetchData('./data/org/metrics_7d.json')
      ]);
      updateRangeMetadata(metrics);
      renderTopKpis(host, metrics, trend);
    } catch (err) {
      devError('Summary metrics failed', err);
      host.replaceChildren();
      clearLoadingState(host);
      renderKpiEmpty(host);
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

  function clearLoadingState(node){
    if (!node) return;
    node.classList.remove('is-skeleton');
    node.removeAttribute('aria-busy');
  }

  function renderTopKpis(host, metrics, trend){
    if (!host) return;
    clearLoadingState(host);

    const nValue = Number(metrics?.n);
    if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, host)) {
      return;
    }
    if (!Number.isFinite(nValue)) {
      host.removeAttribute('data-guard');
    }

    if (!metrics) {
      renderKpiEmpty(host);
      return;
    }

    const items = buildTopKpiItems(metrics, trend);
    if (!items.length) {
      renderKpiEmpty(host);
      return;
    }

    host.replaceChildren();
    items.forEach((item, index) => {
      mountKpi(host, {...item, index});
    });
  }

  function buildTopKpiItems(metrics, trend){
    const kpi = metrics?.kpi || {};
    const updated = resolveUpdatedLabel(metrics, trend);
    const defs = [
      {key: 'wellbeing', metric: 'wellbeing_avg', unit: '/100', labels: ['kpi.orgWellbeing', 'kpi.wellbeing'], fallback: 'Org Wellbeing'},
      {key: 'stress', metric: 'high_stress_pct', unit: '%', labels: ['kpi.highStress', 'metric.highStress'], fallback: 'High Stress %'},
      {key: 'fatigue', metric: 'fatigue_elevated_pct', unit: '%', labels: ['kpi.elevatedFatigue', 'metric.elevatedFatigue'], fallback: 'Elevated Fatigue %'},
      {key: 'engagement', metric: 'engagement_active_pct', unit: '%', labels: ['kpi.activeEngagement', 'metric.activeEngagement'], fallback: 'Active Engagement %'}
    ];

    return defs.map(def => {
      const value = Number(kpi?.[def.metric]);
      const delta = resolveDelta(metrics, def.metric);
      const series = resolveSeries(metrics, trend, def.metric, value, delta);
      const ci = resolveConfidence(metrics, trend, def.metric);
      return {
        key: def.key,
        title: resolveLabel(def.labels, def.fallback),
        unit: def.unit,
        value,
        delta,
        series,
        ci,
        updated
      };
    });
  }

  function resolveLabel(keys, fallback){
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const label = window.I18N?.t?.(key);
      if (label && label !== key) return label;
    }
    return fallback;
  }

  function resolveDelta(metrics, key){
    const direct = Number(metrics?.delta?.[key]);
    if (Number.isFinite(direct)) return direct;
    const current = Number(metrics?.kpi?.[key]);
    const previous = Number(metrics?.previous?.[key]);
    if (Number.isFinite(current) && Number.isFinite(previous)) {
      return current - previous;
    }
    return 0;
  }

  function resolveSeries(metrics, trend, key, value, delta){
    const candidates = [
      metrics?.series?.[key],
      metrics?.kpi_trend?.[key],
      trend?.series?.[key],
      trend?.kpi_trend?.[key]
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.some(point => Number.isFinite(Number(point)))) {
        return candidate;
      }
    }
    if (key === 'wellbeing_avg') {
      const avg = buildSparkSeries(trend?.heatmap);
      if (avg.length) return avg;
    }
    return buildFallbackSeries(value, delta);
  }

  function resolveConfidence(metrics, trend, key){
    const candidates = [
      metrics?.ci?.[key],
      metrics?.confidence?.[key],
      trend?.ci?.[key],
      trend?.confidence?.[key]
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate;
      }
    }
    return [];
  }

  function buildFallbackSeries(value, delta){
    const current = Number(value);
    if (!Number.isFinite(current)) return [];
    const change = Number(delta);
    if (!Number.isFinite(change) || Math.abs(change) < 1e-9) {
      return [current];
    }
    const previous = current - change;
    return [previous, current];
  }

  function resolveUpdatedLabel(metrics, trend){
    const candidates = [
      metrics?.updated,
      trend?.updated,
      last(metrics?.timeline),
      last(trend?.timeline),
      last(metrics?.heatmap?.dates),
      last(trend?.heatmap?.dates)
    ];
    for (const candidate of candidates) {
      const date = ensureDate(candidate);
      if (date) {
        return fmt(date);
      }
    }
    return '—';
  }

  function last(arr){
    return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
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
    const btn = document.getElementById('legend-trigger') || document.getElementById('btn-legend');
    if (!btn) return;
    const label = window.I18N?.t('legend.title') || 'Legend';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  }

  function computePeriodLabel(stateLike){
    const target = stateLike || selectionState;
    const today = getToday();
    const datasetRange = target?.range || '7d';
    const displayRange = target?.displayRange
      || (datasetRange === 'custom' ? 'custom'
        : datasetRange === 'month' ? 'mtd'
        : datasetRange === 'year' ? 'ytd'
        : datasetRange);
    const selectedStart = ensureDate(target?.start);
    const selectedEnd = ensureDate(target?.end);
    const dataStart = ensureDate(runtime.rangeStart);
    const dataEnd = ensureDate(runtime.rangeEnd);

    const defaultStart = (() => {
      switch (displayRange) {
        case 'today':
          return new Date(today.getFullYear(), today.getMonth(), today.getDate());
        case '7d':
          return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
        case 'mtd':
          return new Date(today.getFullYear(), today.getMonth(), 1);
        case 'qtd': {
          const quarterStart = Math.floor(today.getMonth() / 3) * 3;
          return new Date(today.getFullYear(), quarterStart, 1);
        }
        case 'ytd':
          return new Date(today.getFullYear(), 0, 1);
        default:
          return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      }
    })();

    const defaultEnd = (() => {
      switch (displayRange) {
        case 'today':
        case '7d':
        case 'mtd':
        case 'qtd':
        case 'ytd':
          return new Date(today.getFullYear(), today.getMonth(), today.getDate());
        default:
          return new Date(today.getFullYear(), 11, 31);
      }
    })();

    const start = dataStart || selectedStart || defaultStart;
    const end = dataEnd || selectedEnd || defaultEnd;
    const startLabel = formatLocaleDate(start);
    const endLabel = formatLocaleDate(end);
    return start.getTime() === end.getTime()
      ? endLabel
      : `${startLabel} – ${endLabel}`;
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
      const stamp = formatLocaleDate(updatedDate);
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
