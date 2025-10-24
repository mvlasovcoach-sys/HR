function initPage(){
    const grid = document.getElementById('eng-kpi-grid');
    if (!grid) return;
    const caption = document.getElementById('global-caption');
    const updatedEl = document.getElementById('engagement-updated');
    const panel = document.getElementById('engagement-panel');

    const KPI_KEYS = [
      {key: 'onboarding_pct', label: 'kpi.onboarding', targetKey: 'onboarding_pct', target: 80, unit: '%', decimals: 0},
      {key: 'weekly_active_pct', label: 'kpi.weeklyActive', targetKey: 'weekly_active_pct', target: 75, unit: '%', decimals: 0},
      {key: 'nps', label: 'kpi.nps', targetKey: 'nps', target: 25, unit: '', decimals: 0},
      {key: 'alert_count', label: 'kpi.alertCount', targetKey: null, target: 3, unit: '', decimals: 0}
    ];

    let npsData = null;
    let events = [];

    init();

    async function init(){
      await Promise.all([loadNps(), loadEvents()]);
      render();
      window.addEventListener('storage', evt => {
        if (!evt) return;
        if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
          render();
        }
      });
      document.addEventListener('i18n:change', render);
    }

    function t(key, vars){
      return window.I18N?.t(key, vars) || key.replace(/^label\.|^range\./, '');
    }

    const getLang = () => window.I18N?.getLang?.() || 'en';
    const defaultDateOptions = lang => (lang === 'ru'
      ? {day: '2-digit', month: '2-digit', year: 'numeric'}
      : {day: 'numeric', month: 'short', year: 'numeric'});

    function canonicalPreset(value){
      const key = String(value || '').toLowerCase();
      if (key === 'today' || key === 'day') return '7d';
      if (key === 'mtd' || key === 'month') return 'month';
      if (key === 'qtd' || key === 'quarter') return 'month';
      if (key === 'ytd' || key === 'year') return 'year';
      if (key === '7d') return '7d';
      return '7d';
    }

    function displayPreset(value){
      const key = String(value || '').toLowerCase();
      if (key === 'today' || key === 'day') return 'today';
      if (key === 'mtd' || key === 'month') return 'mtd';
      if (key === 'qtd' || key === 'quarter') return 'qtd';
      if (key === 'ytd' || key === 'year') return 'ytd';
      if (key === '7d') return '7d';
      return '7d';
    }

    function formatLocaleDate(value){
      const date = value instanceof Date ? value : new Date(value);
      if (!(date instanceof Date) || Number.isNaN(date)) return value;
      const lang = getLang();
      const options = defaultDateOptions(lang);
      try {
        return new Intl.DateTimeFormat(lang, options).format(date);
      } catch (err) {
        return date.toLocaleDateString();
      }
    }

    async function loadNps(){
      try {
        npsData = await window.dataLoader.fetch('./data/org/nps.json');
      } catch (e) {
        console.error('Failed to load NPS data', e);
        npsData = null;
      }
    }

    async function loadEvents(){
      try {
        const data = await window.dataLoader.fetch('./data/org/events.json');
        events = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
      } catch (e) {
        console.error('Failed to load events', e);
        events = [];
      }
    }

    function readRange(){
      try {
        const raw = localStorage.getItem('hr:range');
        if (!raw) return {preset: '7d'};
        const parsed = JSON.parse(raw);
        if (parsed && parsed.preset) return parsed;
        if (parsed && parsed.start && parsed.end) return parsed;
      } catch (e) {
        // ignore
      }
      return {preset: '7d'};
    }

    function readTeam(){
      try {
        return localStorage.getItem('hr:team') || 'all';
      } catch (e) {
        return 'all';
      }
    }

    function presetForRange(range){
      if (range.preset) {
        return canonicalPreset(range.preset);
      }
      if (range.start && range.end) {
        const start = new Date(range.start);
        const end = new Date(range.end);
        if (!isNaN(start) && !isNaN(end)) {
          const diff = (end - start) / (1000 * 60 * 60 * 24);
          if (diff > 120) return 'year';
          if (diff > 21) return 'month';
        }
      }
      return '7d';
    }

    async function render(){
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      const data = await loadEngagement(preset, range, team);
      const insufficient = Number(data?.n) > 0 && Number(data.n) < 5;
      toggleInsufficient(insufficient);
      if (!data) {
        grid.innerHTML = `<p role="status">${t('status.noData')}</p>`;
        applyCaption(range, team);
        if (updatedEl) updatedEl.textContent = '';
        return;
      }

      grid.innerHTML = '';
      const nValue = Number(data?.n);
      if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, grid)) {
        applyCaption(range, team);
        if (updatedEl) updatedEl.textContent = '';
        return;
      } else if (!Number.isFinite(nValue)) {
        grid.removeAttribute('data-guard');
      }

      const cards = KPI_KEYS.map(cfg => buildCard(cfg, data, preset, team, range)).join('');
      grid.innerHTML = cards;
      applyCaption(range, team);
      if (updatedEl) {
        updatedEl.textContent = data.updated ? `${t('ui.updated')} ${formatDate(data.updated)}` : '';
      }
    }

    async function loadEngagement(preset, range, team){
      try {
        const path = `./data/org/engagement_${preset}.json`;
        return await window.dataLoader.fetch(path, {range, team});
      } catch (e) {
        console.error('Failed to load engagement data', e);
        return null;
      }
    }

    function buildCard(cfg, data, preset, team, range){
      const metrics = resolveKpiMetrics(cfg, data, preset, team, range);
      const unit = cfg.unit || '';
      const formatted = formatKpiValue(cfg, metrics.value);
      const targetLabel = formatTargetLabel(cfg, metrics.target);
      const deltaClass = deltaClassName(metrics.delta);
      const targetMarkup = targetLabel ? `<div class="kpi-card__target">${targetLabel}</div>` : '<div class="kpi-card__target" aria-hidden="true"></div>';
      const badgeMarkup = cfg.key === 'alert_count' ? '' : `<span class="kpi-card__delta ${deltaClass}">${deltaBadge(metrics.delta)}</span>`;
      const status = metrics.status ? `<span class="status-chip ${metrics.status.className}">${metrics.status.label}</span>` : '';
      const sparkMeta = buildSparkMeta(metrics.delta);
      return `<article class="tile">
        <header class="tile__head">
          <span class="tile__title">${t(cfg.label)}</span>
          <span class="tile__status">${status}${badgeMarkup}</span>
        </header>
        <div class="tile__kpi">${formatted}<span>${unit}</span></div>
        <div class="spark kpi-card__spark">${sparkline(metrics.spark, sparkMeta)}</div>
        <footer class="tile__foot kpi-card__meta">
          ${targetMarkup}
          <strong>${t('status.value')}: ${formatted}${unit}</strong>
        </footer>
      </article>`;
    }

    function resolveKpiMetrics(cfg, data, preset, team, range){
      const target = cfg.target ?? data.targets?.[cfg.targetKey] ?? (cfg.key === 'alert_count' ? 3 : null);
      const value = resolveValue(cfg.key, data, preset, team, range);
      const previous = resolvePrevious(cfg.key, data, preset, team);
      const delta = previous != null && value != null ? value - previous : null;
      const spark = buildSpark(cfg.key, data, preset, team, range);
      const status = targetStatus(cfg.key, value, target);
      return {target, value, previous, delta, spark, status};
    }

    function formatKpiValue(cfg, value){
      if (value == null || isNaN(value)) return '–';
      if (cfg.key === 'nps') {
        const rounded = Math.round(value);
        return `${rounded > 0 ? '+' : ''}${rounded}`;
      }
      if (cfg.key === 'alert_count') {
        return String(Math.round(value));
      }
      return Number(value).toFixed(cfg.decimals ?? 0);
    }

    function formatTargetLabel(cfg, target){
      if (target == null) return '';
      const unit = cfg.unit || '';
      const rounded = Math.round(target);
      const sign = cfg.key === 'nps' && rounded > 0 ? `+${rounded}` : `${rounded}`;
      return `${t('status.target')}: ≥${sign}${unit}`;
    }

    function resolveValue(key, data, preset, team, range){
      if (key === 'nps') {
        const slice = npsSlice(preset);
        if (!slice) return null;
        if (team !== 'all' && slice.teams && slice.teams[team]) {
          return slice.teams[team].current;
        }
        return slice.current;
      }
      if (key === 'alert_count') {
        return countAlerts(range, team);
      }
      if (team !== 'all' && data.teams && data.teams[team] && key in data.teams[team]) {
        return data.teams[team][key];
      }
      return data.kpi?.[key] ?? null;
    }

    function resolvePrevious(key, data, preset, team){
      if (key === 'nps') {
        const slice = npsSlice(preset);
        if (!slice) return null;
        if (team !== 'all' && slice.teams && slice.teams[team]) {
          return slice.teams[team].previous;
        }
        return slice.previous;
      }
      if (key === 'alert_count') {
        return null;
      }
      if (team !== 'all' && data.teams && data.teams[team] && key in data.teams[team]) {
        return data.teams[team][key];
      }
      return data.previous?.[key] ?? null;
    }

    function buildSpark(key, data, preset, team, range){
      if (key === 'nps') {
        const slice = npsSlice(preset);
        return Array.isArray(slice?.values) ? slice.values.slice(-7) : [];
      }
      if (key === 'alert_count') {
        return alertSpark(range, data.timeline || [], team);
      }
      const series = Array.isArray(data.series?.[key]) ? data.series[key] : [];
      return series.slice(-7);
    }

    function npsSlice(preset){
      if (!npsData || !npsData.series) return null;
      return npsData.series[preset] || npsData.series['7d'];
    }

    function countAlerts(range, team){
      if (!Array.isArray(events) || events.length === 0) return 0;
      const {start, end} = resolveRangeWindow(range);
      return events.filter(ev => {
        if (team !== 'all' && ev.team !== team) return false;
        const ts = new Date(ev.ts || ev.timestamp);
        if (Number.isNaN(ts)) return false;
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        return true;
      }).length;
    }

    function alertSpark(range, timeline, team){
      if (!Array.isArray(timeline)) return [];
      const {start, end} = resolveRangeWindow(range);
      const windowTimeline = timeline.slice(-7);
      const buckets = windowTimeline.map(point => {
        const ts = new Date(point.date || point.timestamp);
        if (Number.isNaN(ts)) return 0;
        if (start && ts < start) return 0;
        if (end && ts > end) return 0;
        if (!Array.isArray(point.events)) return 0;
        return point.events.filter(ev => team === 'all' || ev.team === team).length;
      });
      return buckets;
    }

    function resolveRangeWindow(range){
      if (!range) return {start: null, end: null};
      if (range.start && range.end) {
        const start = new Date(range.start);
        const end = new Date(range.end);
        return {start: Number.isNaN(start) ? null : start, end: Number.isNaN(end) ? null : end};
      }
      const presetKey = displayPreset(range.preset);
      if (presetKey === 'today') {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return {start, end};
      }
      if (presetKey === 'mtd' || presetKey === 'qtd') {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {start, end};
      }
      if (presetKey === 'ytd') {
        const end = new Date();
        const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        return {start, end};
      }
      return {start: null, end: null};
    }

    function deltaBadge(delta){
      if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) {
        return t('delta.equal');
      }
      return delta > 0 ? t('delta.up') : t('delta.down');
    }

    function deltaClassName(delta){
      if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) return 'kpi-card__delta--neutral';
      return delta > 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down';
    }

    function targetStatus(key, value, target){
      if (target == null || value == null || isNaN(value)) return null;
      const met = Number(value) >= Number(target);
      return met
        ? {label: t('status.onTarget'), className: 'status-chip--green', met: true}
        : {label: t('status.belowTarget'), className: 'status-chip--amber', met: false};
    }

    function applyCaption(range, team){
      if (!caption) return;
      const insight = buildCaption(range, team);
      if (window.Caption?.renderCaption) {
        window.Caption.renderCaption(caption, {asOf: new Date(), insight});
      } else {
        caption.textContent = insight;
      }
    }

    function buildCaption(range, team){
      const rangeText = rangeLabel(range);
      const teamText = teamLabel(team);
      const prefix = t('caption.orgAvg') || t('caption.orgAverage') || 'Org average';
      const separator = t('caption.separator') || ' · ';
      return `${scenarioPrefix()}${prefix}${separator}${rangeText}${separator}${teamText}`;
    }

    function rangeLabel(range){
      if (!range) return t('caption.range', {range: '—'});
      if (range.preset) {
        const presetKey = displayPreset(range.preset);
        if (presetKey) {
          return t(`range.${presetKey}`) || {
            today: 'Today',
            '7d': '7 Days',
            mtd: 'Month to date',
            qtd: 'Quarter to date',
            ytd: 'Year to date'
          }[presetKey];
        }
        return t('range.7d');
      }
      if (range.start && range.end) {
        const start = formatLocaleDate(range.start);
        const end = formatLocaleDate(range.end);
        if (start && start === end) return start;
        return `${start} – ${end}`;
      }
      return t('caption.range', {range: '—'});
    }

    function teamLabel(team){
      if (!team || team === 'all') return t('caption.teamAll') || 'All teams';
      try {
        const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
        if (map && map[team]) return map[team];
      } catch (e) {}
      return team;
    }

    function readScenario(){
      try {
        return localStorage.getItem('hr:scenario') || 'live';
      } catch (err) {
        return 'live';
      }
    }

    function scenarioPrefix(){
      return readScenario() === 'night' ? (t('caption.scenarioPrefix') || 'Night scenario · ') : '';
    }

    function toggleInsufficient(active){
      if (!panel) return;
      if (active) {
        panel.setAttribute('data-insufficient', 'true');
        panel.setAttribute('data-guard-message', t('guard.insufficient'));
      } else {
        panel.removeAttribute('data-insufficient');
        panel.removeAttribute('data-guard-message');
      }
    }

    function sparkline(values, meta){
      if (!Array.isArray(values) || values.length === 0) {
        return '<div class="chart chart--spark" aria-hidden="true"></div>';
      }
      const sliced = values.slice(-7);
      const series = [];
      sliced.forEach((val, index) => {
        const num = Number(val);
        if (Number.isFinite(num)) {
          series.push(num);
        } else {
          series.push(index > 0 ? series[index - 1] : 0);
        }
      });
      if (!series.length) {
        return '<div class="chart chart--spark" aria-hidden="true"></div>';
      }
      const max = Math.max(...series);
      const min = Math.min(...series);
      const span = max - min || 1;
      const step = series.length > 1 ? 100 / (series.length - 1) : 100;
      const points = series.map((v, i) => {
        const x = (step * i).toFixed(2);
        const y = (100 - ((v - min) / span) * 100).toFixed(2);
        return `${x},${y}`;
      }).join(' ');
      const lastX = series.length > 1 ? (step * (series.length - 1)).toFixed(2) : '100';
      const lastY = series.length ? (100 - ((series[series.length - 1] - min) / span) * 100).toFixed(2) : '50';
      const aria = meta?.aria ? ` aria-label="${escapeHtml(meta.aria)}"` : ' aria-hidden="true"';
      const tabindex = meta?.aria ? ' tabindex="0"' : '';
      const title = meta?.tooltip ? ` title="${escapeHtml(meta.tooltip)}"` : '';
      const trendAttr = meta?.trend ? ` data-trend="${escapeHtml(meta.trend)}"` : '';
      const tooltip = meta?.tooltip ? `<span class="chart__tooltip">${escapeHtml(meta.tooltip)}</span>` : '';
      return `<div class="chart chart--spark"${aria}${tabindex}${title}${trendAttr}><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><polyline points="${points}" /></svg><span class="chart__marker" style="left:${lastX}%;top:${lastY}%"></span>${tooltip}</div>`;
    }

    function escapeHtml(input){
      return String(input ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char] || char);
    }

    function sparkTrend(delta){
      if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) return 'stable';
      return delta > 0 ? 'rising' : 'falling';
    }

    function sparkTrendLabel(key){
      return window.I18N?.t(`trend.${key}`) || ({
        rising: 'Rising',
        falling: 'Falling',
        stable: 'Stable'
      }[key] || 'Stable');
    }

    function formatSparkDelta(delta){
      if (!Number.isFinite(delta)) return '';
      const lang = getLang();
      const abs = Math.abs(delta);
      const decimals = abs >= 10 ? 0 : 1;
      const options = {maximumFractionDigits: decimals, minimumFractionDigits: decimals};
      try {
        if (Math.abs(delta) < 0.05) {
          return new Intl.NumberFormat(lang, options).format(0);
        }
        return new Intl.NumberFormat(lang, {...options, signDisplay: 'always'}).format(delta);
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
      const deltaLabel = window.I18N?.t('trend.delta', {delta: deltaText}) || `${deltaText} vs last`;
      const tooltip = `${trendLabel}; ${deltaLabel}`;
      return {trend, tooltip, aria: tooltip};
    }

    function formatDate(input){
      return formatLocaleDate(input);
    }
}

window.renderEngagementPage = function(){
  const boot = () => initPage();
  if (window.I18N?.onReady) {
    window.I18N.onReady(boot);
  } else {
    boot();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const lazyHost = document.querySelector('[data-mount="renderEngagementPage"]');
  if (!lazyHost) {
    window.renderEngagementPage();
  }
});
