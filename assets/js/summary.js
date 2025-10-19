(function(){
  console.info('Summary init');
  const TILE_COUNT = 4;

  const SUMMARY = window.SUMMARY = window.SUMMARY || {};
  const RANGE = window.RANGE = window.RANGE || {};

  const state = {
    loading: false,
    rangeStart: null,
    rangeEnd: null,
    asOfIso: null
  };

  SUMMARY.computePeriodLabel = computePeriodLabel;
  SUMMARY.getAsOfIso = () => state.asOfIso;
  SUMMARY.fmtAsOf = fmtAsOf;

  document.addEventListener('DOMContentLoaded', () => {
    applyScenarioFromUrl();
    bindTileNavigation();
    bindScenarioControls();

    const start = () => {
      updateLegendButtonLabel();
      updateOrgBadge();
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
        renderSkeleton();
        if (evt.key === 'hr:scenario') updateScenarioButtons();
        loadAndRender();
      }
    });

    document.addEventListener('i18n:change', () => {
      updateLegendButtonLabel();
      updateOrgBadge();
      updateScenarioButtons();
      refreshHeaderMeta();
      if (!state.loading) {
        loadAndRender();
      }
    });

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
    syncScenarioBanner(scenario);
  }

  function syncScenarioBanner(scenario){
    const banner = document.getElementById('demo-banner');
    if (!banner) return;
    if (scenario === 'night') {
      const message = window.I18N?.t('summary.demoActive') || 'Demo scenario active — simulated night-shift data';
      const action = window.I18N?.t('summary.returnAction') || 'Return to live';
      banner.innerHTML = `<span>${message}</span><button type="button" class="close">${action}</button>`;
      banner.hidden = false;
      banner.querySelector('.close')?.addEventListener('click', () => setScenario('live'), {once: true});
      updateScenarioParam(true);
    } else {
      banner.hidden = true;
      banner.textContent = '';
      updateScenarioParam(false);
    }
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
      skeleton.push(`<div class="tile tile--skeleton skeleton tile--compact" aria-hidden="true">
        <div class="tile__head"><span class="skeleton skeleton--text"></span></div>
        <div class="tile__meta"><span class="skeleton skeleton--pill"></span></div>
        <div class="tile__kpi"><span class="skeleton skeleton--value"></span></div>
        <div class="spark"><span class="skeleton skeleton--spark"></span></div>
      </div>`);
    }
    grid.innerHTML = skeleton.join('');
  }

  async function loadAndRender(){
    state.loading = true;
    const range = readRange();
    RANGE.current = range;
    refreshHeaderMeta();
    const grid = document.getElementById('sum-kpi-grid');
    if (!grid) {
      state.loading = false;
      return;
    }
    try{
      const key = getRangeKey(range);
      const [metrics, trend] = await Promise.all([
        window.dataLoader.fetch(`./data/org/metrics_${key}.json`, {range}),
        window.dataLoader.fetch('./data/org/metrics_7d.json')
      ]);
      updateRangeMetadata(metrics);
      refreshHeaderMeta();
      renderKpis(metrics, trend);
    }catch(err){
      console.error('Summary metrics failed', err);
      grid.innerHTML = '';
      state.rangeStart = state.rangeEnd = null;
      state.asOfIso = null;
      refreshHeaderMeta();
      toast(window.I18N?.t('toast.summaryError') || window.I18N?.t('status.noData') || 'Unable to load data');
    } finally {
      state.loading = false;
    }
  }

  function updateRangeMetadata(metrics){
    const dates = Array.isArray(metrics?.heatmap?.dates) ? metrics.heatmap.dates.filter(Boolean) : [];
    state.rangeStart = dates.length ? dates[0] : null;
    state.rangeEnd = dates.length ? dates[dates.length - 1] : null;
    let asOf = metrics?.meta?.as_of || metrics?.meta?.updated || metrics?.meta?.generated_at || metrics?.updated_at || metrics?.updated;
    if (!asOf && state.rangeEnd) {
      asOf = state.rangeEnd;
    }
    state.asOfIso = asOf || null;
  }

  function refreshHeaderMeta(){
    const periodEl = document.getElementById('period-label');
    const asofEl = document.getElementById('asof-label');
    const range = RANGE.current || readRange();
    if (periodEl) {
      const period = computePeriodLabel(range);
      const label = window.I18N?.t('summary.period', {period}) || `Period: ${period}`;
      periodEl.textContent = label;
    }
    if (asofEl) {
      const iso = SUMMARY.getAsOfIso() || new Date().toISOString();
      const ts = fmtAsOf(iso);
      asofEl.textContent = window.I18N?.t('summary.asof', {ts}) || `updated ${ts}`;
    }
  }

  function renderKpis(metrics, trend){
    const grid = document.getElementById('sum-kpi-grid');
    if(!grid) return;
    const kpi = metrics?.kpi || {};
    const delta = metrics?.delta || {};
    const nValue = Number(metrics?.n);
    grid.innerHTML = '';
    if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, grid)) {
      return;
    }
    if (!Number.isFinite(nValue)) {
      grid.removeAttribute('data-guard');
    }

    const updatedDate = lastDate(metrics?.heatmap?.dates);
    const updatedLabel = updatedDate ? `${window.I18N?.t('ui.updated') || window.I18N?.t('label.updated') || 'Updated'} ${formatDate(updatedDate)}` : '';
    const sparkSeries = buildSparkSeries(trend?.heatmap);

    const defs = [
      { key:'wellbeing_avg',         label:()=>window.I18N?.t('kpi.orgWellbeing') || window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',     unit:'/100', fmt:v=>Math.round(v) },
      { key:'high_stress_pct',       label:()=>window.I18N?.t('kpi.highStress') || window.I18N?.t('metric.highStress') || 'High Stress %',   unit:'%',    fmt:v=>Math.round(v) },
      { key:'fatigue_elevated_pct',  label:()=>window.I18N?.t('kpi.elevatedFatigue') || window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue %',  unit:'%',    fmt:v=>Math.round(v) },
      { key:'engagement_active_pct', label:()=>window.I18N?.t('kpi.activeEngagement') || window.I18N?.t('metric.activeEngagement') || 'Active Engagement %', unit:'%',    fmt:v=>Math.round(v) }
    ];

    grid.innerHTML = defs.map((d, index)=>{
      const raw = Number(kpi?.[d.key]);
      const val = Number.isFinite(raw) ? d.fmt(raw) : '—';
      const dRaw = Number(delta?.[d.key]);
      const del  = Number.isFinite(dRaw) ? dRaw : null;
      const badge = del!==null ? `<span class="tile__badge pill ${del>=0?'pill--strong':'pill--critical'}">${del>=0?'▲':'▼'} ${Math.abs(Math.round(del))}</span>`:'';
      const spark = sparkline(sparkSeries);
      return `<div class="tile tile--interactive tile--compact kpi" data-index="${index}">
        <div class="tile__head">${d.label()} ${badge}</div>
        <div class="tile__meta">${updatedLabel}</div>
        <div class="tile__kpi">${val}<small>${d.unit}</small></div>
        <div class="spark">${spark}</div>
      </div>`;
    }).join('');
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

  function formatDate(dateStr){
    try {
      const lang = window.I18N?.getLang?.() || navigator.language || 'en';
      const formatter = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'});
      return formatter.format(new Date(dateStr));
    } catch (err) {
      return dateStr;
    }
  }

  function lastDate(dates){
    if (!Array.isArray(dates) || !dates.length) return null;
    return dates[dates.length - 1];
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
    const name = window.SITE.name || 'Org';
    const headcount = Number(window.SITE.totals?.headcount) || 0;
    const staffLabel = window.I18N?.t('summary.staff') || 'staff';
    const equipped = headcount ? (window.I18N?.t('summary.equipped', {count: headcount}) || '') : '';
    const parts = [`${name}`, `${headcount} ${staffLabel}`];
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

  function computePeriodLabel(range){
    const lang = window.I18N?.getLang?.() || navigator.language || 'en';
    const fallback = (key, def) => window.I18N?.t(key) || def;
    if (!range) {
      return fallback('range.7d', '7 Days');
    }
    let startIso = range.start || state.rangeStart;
    let endIso = range.end || state.rangeEnd;
    if (range.preset === 'day') {
      const target = endIso || startIso;
      if (!target) {
        return fallback('range.day', 'Day');
      }
      return formatSingleDate(target, lang);
    }
    if (!startIso && !endIso) {
      if (range.preset) {
        return fallback(`range.${range.preset}`, range.preset);
      }
      return fallback('range.7d', '7 Days');
    }
    if (startIso && !endIso) endIso = startIso;
    if (endIso && !startIso) startIso = endIso;
    if (startIso && endIso) {
      return formatRange(startIso, endIso, lang);
    }
    if (range.preset) {
      return fallback(`range.${range.preset}`, range.preset);
    }
    return fallback('range.7d', '7 Days');
  }

  function formatSingleDate(iso, lang){
    try {
      const formatter = new Intl.DateTimeFormat(lang, {month: 'short', day: 'numeric', year: 'numeric'});
      return formatter.format(new Date(iso));
    } catch (err) {
      return iso;
    }
  }

  function formatRange(startIso, endIso, lang){
    try {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (isNaN(start) || isNaN(end)) throw new Error('Invalid dates');
      const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
      if (sameDay) {
        return formatSingleDate(endIso, lang);
      }
      const sameYear = start.getFullYear() === end.getFullYear();
      const sameMonth = sameYear && start.getMonth() === end.getMonth();
      const monthDay = new Intl.DateTimeFormat(lang, {month: 'short', day: 'numeric'});
      const dayFmt = new Intl.DateTimeFormat(lang, {day: 'numeric'});
      const yearFmt = new Intl.DateTimeFormat(lang, {year: 'numeric'});
      const fullFmt = new Intl.DateTimeFormat(lang, {month: 'short', day: 'numeric', year: 'numeric'});
      if (sameMonth) {
        return `${monthDay.format(start)}\u2013${dayFmt.format(end)}, ${yearFmt.format(end)}`;
      }
      if (sameYear) {
        return `${monthDay.format(start)} – ${monthDay.format(end)}, ${yearFmt.format(end)}`;
      }
      return `${fullFmt.format(start)} – ${fullFmt.format(end)}`;
    } catch (err) {
      return `${startIso} – ${endIso}`;
    }
  }

  function fmtAsOf(iso){
    if (!iso) return '';
    const lang = window.I18N?.getLang?.() || navigator.language || 'en';
    try {
      const hasTime = typeof iso === 'string' && iso.includes('T');
      const date = new Date(iso);
      if (isNaN(date)) return iso;
      if (!hasTime) {
        return new Intl.DateTimeFormat(lang, {month: 'short', day: 'numeric', year: 'numeric'}).format(date);
      }
      const now = new Date();
      const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      const timeFmt = new Intl.DateTimeFormat(lang, {hour: '2-digit', minute: '2-digit'});
      if (sameDay) {
        return timeFmt.format(date);
      }
      const dateFmt = new Intl.DateTimeFormat(lang, {month: 'short', day: 'numeric', year: 'numeric'});
      return `${dateFmt.format(date)} ${timeFmt.format(date)}`;
    } catch (err) {
      return iso;
    }
  }
})();
