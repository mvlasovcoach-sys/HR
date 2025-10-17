function initPage(){
    const grid = document.getElementById('eng-kpi-grid');
    if (!grid) return;
    const caption = document.getElementById('engagement-caption');
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
        if (range.preset === 'month' || range.preset === 'year') return range.preset;
        return '7d';
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
        if (caption) caption.textContent = buildCaption(range, team);
        if (updatedEl) updatedEl.textContent = '';
        return;
      }

      grid.innerHTML = '';
      const nValue = Number(data?.n);
      if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, grid)) {
        if (caption) caption.textContent = buildCaption(range, team);
        if (updatedEl) updatedEl.textContent = '';
        return;
      } else if (!Number.isFinite(nValue)) {
        grid.removeAttribute('data-guard');
      }

      const cards = KPI_KEYS.map(cfg => buildCard(cfg, data, preset, team, range)).join('');
      grid.innerHTML = cards;
      if (caption) caption.textContent = buildCaption(range, team);
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
      return `<article class="tile">
        <header class="tile__head">
          <span class="tile__title">${t(cfg.label)}</span>
          <span class="tile__status">${status}${badgeMarkup}</span>
        </header>
        <div class="tile__kpi">${formatted}<span>${unit}</span></div>
        <div class="spark kpi-card__spark">${sparkline(metrics.spark)}</div>
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
        return slice?.values || [];
      }
      if (key === 'alert_count') {
        return alertSpark(range, data.timeline || [], team);
      }
      return Array.isArray(data.series?.[key]) ? data.series[key] : [];
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
      const buckets = timeline.map(point => {
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
      if (range.preset === 'day') {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return {start, end};
      }
      if (range.preset === 'month') {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {start, end};
      }
      if (range.preset === 'year') {
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

    function buildCaption(range, team){
      const rangeText = rangeLabel(range);
      const teamText = teamLabel(team);
      const prefix = t('caption.orgAvg') || t('caption.orgAverage');
      return `${scenarioPrefix()}${prefix} · ${rangeText} · ${teamText}`;
    }

    function rangeLabel(range){
      if (!range) return t('caption.range', {range: '—'});
      if (range.preset) {
        const map = {
          day: t('range.day'),
          '7d': t('range.7d'),
          month: t('range.month'),
          year: t('range.year')
        };
        return map[range.preset] || t('range.7d');
      }
      if (range.start && range.end) {
        return `${range.start} → ${range.end}`;
      }
      return t('caption.range', {range: '—'});
    }

    function teamLabel(team){
      if (!team || team === 'all') return t('caption.teamAll');
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
      return readScenario() === 'night' ? t('caption.scenarioPrefix') : '';
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

    function sparkline(values){
      if (!Array.isArray(values) || values.length === 0) return '';
      const max = Math.max(...values);
      const min = Math.min(...values);
      const span = max - min || 1;
      const step = values.length > 1 ? 100 / (values.length - 1) : 100;
      const points = values.map((v, i) => {
        const x = (step * i).toFixed(2);
        const y = (100 - ((v - min) / span) * 100).toFixed(2);
        return `${x},${y}`;
      }).join(' ');
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="rgba(39,224,255,0.9)" stroke-width="3" stroke-linecap="round" points="${points}" /></svg>`;
    }

    function formatDate(input){
      const date = new Date(input);
      if (Number.isNaN(date)) return input;
      return date.toLocaleDateString();
    }
}

document.addEventListener('DOMContentLoaded', () => {
  window.I18N.onReady(initPage);
});
