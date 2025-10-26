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
  const KPI_PRIMARY_ID = 'kpi-grid';

  const SUMMARY = window.SUMMARY = window.SUMMARY || {};
  const RANGE = window.RANGE = window.RANGE || {};
  const selectionState = SUMMARY.state = SUMMARY.state || {range: '7d', displayRange: '7d', start: null, end: null};

  const runtime = {
    loading: false,
    rangeStart: null,
    rangeEnd: null
  };

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
    document.getElementById(KPI_PRIMARY_ID)?.addEventListener('click', evt => {
      const tile = evt.target.closest('.tile');
      if (!tile) return;
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
  }

  function setScenario(mode){
    try {
      const prev = localStorage.getItem('hr:scenario') || 'live';
      const next = mode === 'night' ? 'night' : 'live';
      if (prev === next) return;
      localStorage.setItem('hr:scenario', next);
      dispatchEvent(new StorageEvent('storage', {key: 'hr:scenario'}));
    } catch (err) {
      console.warn('scenario set failed', err);
    }
    updateScenarioButtons();
    renderSkeleton();
    initPage();
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
    const host = document.getElementById(KPI_PRIMARY_ID);
    if (!host) return;
    host.classList.add('is-skeleton');
    host.setAttribute('aria-busy', 'true');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile tile--skeleton tile--compact kpi kpi--brand';
      tile.setAttribute('aria-hidden', 'true');
      tile.innerHTML = `
        <div class="tile__head"><span class="skeleton skeleton--text"></span></div>
        <div class="tile__kpi tile__value tile__value--skeleton num"><span class="skeleton skeleton--value"></span></div>
        <div class="tile__spark tile__spark--skeleton"><span class="skeleton skeleton--spark"></span></div>
      `;
      fragment.appendChild(tile);
    }
    host.replaceChildren(fragment);
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
    const host = document.getElementById(KPI_PRIMARY_ID);
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
      renderKpis(host, metrics, trend);
    } catch (err) {
      console.error('Summary metrics failed', err);
      host.replaceChildren();
      clearLoadingState(host);
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

  function renderKpis(host, metrics, trend){
    if (!host) return;
    clearLoadingState(host);
    host.replaceChildren();

    const kpi = metrics?.kpi || {};
    const delta = metrics?.delta || {};
    const nValue = Number(metrics?.n);
    const lang = window.I18N?.getLang?.() || 'en';
    const numberFmt = new Intl.NumberFormat(lang, {maximumFractionDigits: 0});

    if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, host)) {
      return;
    }
    if (!Number.isFinite(nValue)) {
      host.removeAttribute('data-guard');
    }

    const sparkSeries = buildSparkSeries(trend?.heatmap);
    const defs = [
      { key: 'wellbeing_avg',         label: () => window.I18N?.t('kpi.orgWellbeing') || window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',        unit: '/100', fmt: v => Math.round(v) },
      { key: 'high_stress_pct',       label: () => window.I18N?.t('kpi.highStress') || window.I18N?.t('metric.highStress') || 'High Stress %',      unit: '%',    fmt: v => Math.round(v) },
      { key: 'fatigue_elevated_pct',  label: () => window.I18N?.t('kpi.elevatedFatigue') || window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue %', unit: '%',    fmt: v => Math.round(v) },
      { key: 'engagement_active_pct', label: () => window.I18N?.t('kpi.activeEngagement') || window.I18N?.t('metric.activeEngagement') || 'Active Engagement %', unit: '%',    fmt: v => Math.round(v) }
    ];

    const fragment = document.createDocumentFragment();
    defs.forEach((definition, index) => {
      const raw = Number(kpi?.[definition.key]);
      const formattedValue = Number.isFinite(raw) ? definition.fmt(raw) : null;
      const valueText = formattedValue != null ? numberFmt.format(formattedValue) : '—';
      const deltaRaw = Number(delta?.[definition.key]);
      const deltaValue = Number.isFinite(deltaRaw) ? deltaRaw : null;
      const badgeValue = deltaValue !== null ? Math.abs(Math.round(deltaValue)) : null;
      const badgeLabel = badgeValue !== null ? numberFmt.format(badgeValue) : '';
      const sparkInfo = buildSparkMeta(deltaValue);
      const sparkGraphic = sparkline(sparkSeries);

      const tile = document.createElement('div');
      tile.className = 'tile tile--interactive tile--compact kpi kpi--brand';
      tile.dataset.index = String(index);

      const head = document.createElement('div');
      head.className = 'tile__head';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = definition.label();
      head.appendChild(labelSpan);

      if (badgeValue !== null) {
        const badge = document.createElement('span');
        badge.className = `tile__badge pill ${deltaValue >= 0 ? 'pill--strong' : 'pill--critical'}`;
        badge.textContent = `${deltaValue >= 0 ? '▲' : '▼'} ${badgeLabel}`.trimEnd();
        head.appendChild(badge);
      }

      tile.appendChild(head);

      const value = document.createElement('div');
      value.className = 'tile__kpi tile__value num';
      value.appendChild(document.createTextNode(valueText));
      const unit = document.createElement('small');
      unit.textContent = definition.unit;
      value.appendChild(unit);
      tile.appendChild(value);

      const spark = document.createElement('div');
      spark.className = 'tile__spark spark';
      if (sparkInfo) {
        if (sparkInfo.aria) {
          spark.setAttribute('aria-label', sparkInfo.aria);
        }
        if (sparkInfo.tooltip) {
          spark.title = sparkInfo.tooltip;
          spark.dataset.tooltip = sparkInfo.tooltip;
        }
        spark.setAttribute('role', 'img');
        spark.tabIndex = 0;
      } else {
        spark.setAttribute('aria-hidden', 'true');
      }

      const graphicNode = createNodeFromMarkup(sparkGraphic);
      if (graphicNode) {
        spark.appendChild(graphicNode);
      }
      if (sparkInfo?.tooltip) {
        const tooltip = document.createElement('div');
        tooltip.className = 'spark-tooltip';
        tooltip.textContent = sparkInfo.tooltip;
        spark.appendChild(tooltip);
      }

      tile.appendChild(spark);
      fragment.appendChild(tile);
    });

    host.appendChild(fragment);
  }

  function createNodeFromMarkup(markup){
    if (typeof markup !== 'string') return null;
    const trimmed = markup.trim();
    if (!trimmed) return null;
    const template = document.createElement('template');
    template.innerHTML = trimmed;
    return template.content.firstElementChild;
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

  function sparkTrend(delta){
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) return 'stable';
    return delta > 0 ? 'up' : 'down';
  }

  function sparkTrendLabel(key){
    switch (key) {
      case 'up':
        return window.I18N?.t('spark.rising') || 'Rising';
      case 'down':
        return window.I18N?.t('spark.falling') || 'Falling';
      default:
        return window.I18N?.t('spark.stable') || 'Stable';
    }
  }

  function formatSparkDelta(delta){
    if (!Number.isFinite(delta)) return '';
    const lang = getLang();
    const abs = Math.abs(delta);
    const decimals = abs >= 10 ? 0 : 1;
    const baseOptions = {maximumFractionDigits: decimals, minimumFractionDigits: decimals};
    try {
      if (Math.abs(delta) < 0.05) {
        return new Intl.NumberFormat(lang, baseOptions).format(0);
      }
      return new Intl.NumberFormat(lang, {...baseOptions, signDisplay: 'always'}).format(delta);
    } catch (err) {
      if (Math.abs(delta) < 0.05) return abs.toFixed(decimals);
      const sign = delta >= 0 ? '+' : '−';
      return `${sign}${abs.toFixed(decimals)}`;
    }
  }

  function buildSparkMeta(delta){
    if (!Number.isFinite(delta)) return null;
    const trend = sparkTrend(delta);
    const trendLabel = sparkTrendLabel(trend);
    const deltaText = formatSparkDelta(delta);
    const tooltip = window.I18N?.t('spark.delta', {delta: deltaText}) || `${deltaText} vs last period`;
    const aria = `${trendLabel}. ${tooltip}`.trim();
    return {trendLabel, deltaText, tooltip, aria};
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
