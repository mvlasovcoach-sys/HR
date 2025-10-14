(function(){
  const grid = document.getElementById('engagement-kpis');
  if (!grid) return;
  const caption = document.getElementById('engagement-caption');
  const updatedEl = document.getElementById('engagement-updated');

  const KPI_KEYS = [
    {key: 'onboarding_pct', label: 'kpi.onboarding', targetKey: 'onboarding_pct', unit: '%', decimals: 0},
    {key: 'weekly_active_pct', label: 'kpi.weeklyActive', targetKey: 'weekly_active_pct', unit: '%', decimals: 0},
    {key: 'nps', label: 'kpi.nps', targetKey: 'nps', unit: '', decimals: 0},
    {key: 'alert_count', label: 'kpi.alertCount', targetKey: null, unit: '', decimals: 0}
  ];

  let npsData = null;
  let events = [];

  init();

  async function init(){
    await Promise.all([loadNps(), loadEvents()]);
    render();
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team') {
        render();
      }
    });
    document.addEventListener('i18n:change', render);
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
    if (!data) {
      grid.innerHTML = '<p role="status">No data</p>';
      if (caption) caption.textContent = buildCaption(range, team);
      return;
    }

    const cards = KPI_KEYS.map(cfg => buildCard(cfg, data, preset, team, range)).join('');
    grid.innerHTML = cards;
    if (caption) caption.textContent = buildCaption(range, team);
    if (updatedEl) {
      updatedEl.textContent = data.updated ? `${window.t('label.updatedAt', {date: formatDate(data.updated)})}` : '';
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
    const target = data.targets?.[cfg.targetKey] ?? (cfg.key === 'alert_count' ? 0 : null);
    const value = resolveValue(cfg.key, data, preset, team, range);
    const previous = resolvePrevious(cfg.key, data, preset, team);
    const delta = previous != null ? value - previous : 0;
    const spark = buildSpark(cfg.key, data, preset, team, range);
    const badge = deltaBadge(delta);
    const unit = cfg.unit || '';
    const formatted = value != null ? value.toFixed(cfg.decimals ?? 0) : '–';
    const targetLabel = target != null ? `${window.t('status.target')}: ${target}${unit}` : '';
    const deltaClass = deltaClassName(delta);
    const targetMarkup = targetLabel ? `<div class="kpi-card__target">${targetLabel}</div>` : '<div class="kpi-card__target" aria-hidden="true"></div>';
    const badgeMarkup = cfg.key === 'alert_count' ? '' : `<span class="kpi-card__delta ${deltaClass}">${badge}</span>`;
    return `<article class="tile">
      <header class="tile__head">
        <span class="tile__title">${window.t(cfg.label)}</span>
        ${badgeMarkup}
      </header>
      <div class="tile__kpi">${formatted}<span>${unit}</span></div>
      <div class="spark kpi-card__spark">${sparkline(spark)}</div>
      <footer class="tile__foot kpi-card__meta">
        ${targetMarkup}
        <strong>${window.t('status.value')}: ${formatted}${unit}</strong>
      </footer>
    </article>`;
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
      const ts = new Date(ev.ts);
      if (start && ts < start) return false;
      if (end && ts > end) return false;
      return true;
    }).length;
  }

  function alertSpark(range, timeline, team){
    const {start, end} = resolveRangeWindow(range);
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return [];
    }
    return timeline.map(dateStr => {
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);
      let count = 0;
      events.forEach(ev => {
        if (team && team !== 'all' && ev.team !== team) return;
        const ts = new Date(ev.ts);
        if (start && ts < start) return;
        if (end && ts > end) return;
        if (ts >= dayStart && ts <= dayEnd) count += 1;
      });
      return count;
    });
  }

  function resolveRangeWindow(range){
    if (range.start && range.end) {
      const start = new Date(range.start);
      const end = new Date(range.end);
      end.setHours(23, 59, 59, 999);
      return {start, end};
    }
    const preset = presetForRange(range);
    const now = new Date();
    if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      return {start, end: now};
    }
    if (preset === 'month') {
      const start = new Date(now);
      start.setDate(start.getDate() - 27);
      return {start, end: now};
    }
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return {start, end: now};
  }

  function deltaBadge(delta){
    if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) {
      return window.t('delta.equal');
    }
    return delta > 0 ? window.t('delta.up') : window.t('delta.down');
  }

  function deltaClassName(delta){
    if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) return 'kpi-card__delta--neutral';
    return delta > 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down';
  }

  function sparkline(values){
    if (!Array.isArray(values) || values.length === 0) return '';
    const clean = values.map(Number).filter(v => !Number.isNaN(v));
    if (!clean.length) return '';
    const max = Math.max(...clean);
    const min = Math.min(...clean);
    const span = max - min || 1;
    const step = clean.length > 1 ? 100 / (clean.length - 1) : 100;
    const points = clean.map((v, i) => {
      const x = (step * i).toFixed(2);
      const y = (100 - ((v - min) / span) * 100).toFixed(2);
      return `${x},${y}`;
    }).join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="rgba(39,224,255,0.9)" stroke-width="4" stroke-linecap="round" points="${points}" /></svg>`;
  }

  function buildCaption(range, team){
    const rangeText = rangeLabel(range);
    const teamText = teamLabel(team);
    return `${window.t('caption.orgAverage')}${window.t('caption.separator')}${rangeText}${window.t('caption.separator')}${teamText}`;
  }

  function rangeLabel(range){
    if (!range) return window.t('caption.range', {range: '—'});
    if (range.preset) {
      const map = {
        day: window.t('range.day'),
        '7d': window.t('range.7d'),
        month: window.t('range.month'),
        year: window.t('range.year')
      };
      return map[range.preset] || window.t('range.7d');
    }
    if (range.start && range.end) {
      return `${range.start} → ${range.end}`;
    }
    return window.t('range.7d');
  }

  function teamLabel(team){
    if (!team || team === 'all') return window.t('caption.teamAll');
    try {
      const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
      if (map && map[team]) return map[team];
    } catch (e) {
      // ignore
    }
    return team;
  }

  function formatDate(value){
    const dt = new Date(value);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString();
  }
})();
