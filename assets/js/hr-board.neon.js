(function(){
  const mount = document.getElementById('hr-board');
  if (!mount) return;

  const CAPTION = document.getElementById('global-caption');
  const KPI_CONFIG = [
    {key: 'wellbeing_avg', labelKey: 'kpi.wellbeing', unit: '/100', decimals: 0, positive: true},
    {key: 'high_stress_pct', labelKey: 'metric.highStress', unit: '%', decimals: 0, positive: false},
    {key: 'fatigue_elevated_pct', labelKey: 'metric.elevatedFatigue', unit: '%', decimals: 0, positive: false},
    {key: 'engagement_active_pct', labelKey: 'metric.activeEngagement', unit: '%', decimals: 0, positive: true}
  ];

  init();

  function init(){
    render();
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team') {
        render();
      }
    });
    document.addEventListener('i18n:change', render);
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
    if (range && range.preset) {
      if (range.preset === 'month' || range.preset === 'year') return range.preset;
      return '7d';
    }
    if (range && range.start && range.end) {
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

  async function loadMetrics(range){
    const preset = presetForRange(range);
    const path = `./data/org/metrics_${preset}.json`;
    try {
      return await window.dataLoader.fetch(path, {range, team: readTeam()});
    } catch (e) {
      console.error('Failed to load metrics', e);
      return null;
    }
  }

  function sparkline(values){
    if (!Array.isArray(values) || !values.length) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const step = values.length > 1 ? 100 / (values.length - 1) : 100;
    const points = values
      .map((v, i) => {
        const x = (step * i).toFixed(2);
        const y = (100 - ((v - min) / span) * 100).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="var(--cyan)" stroke-width="4" stroke-linecap="round" points="${points}" /></svg>`;
  }

  function formatValue(value, decimals){
    return (value ?? 0).toFixed(decimals ?? 0);
  }

  function buildCaption(range, team){
    const rangeText = rangeLabel(range);
    const teamText = teamLabel(team);
    return `${window.t('caption.orgAverage')}${window.t('caption.separator')}${rangeText}${window.t('caption.separator')}${teamText}`;
  }

  function rangeLabel(range){
    if (!range) return window.t('caption.range', {range: '—'});
    if (range.preset) {
      const mapping = {
        day: window.t('range.day'),
        '7d': window.t('range.7d'),
        month: window.t('range.month'),
        year: window.t('range.year')
      };
      return mapping[range.preset] || window.t('caption.range', {range: '—'});
    }
    if (range.start && range.end) {
      return `${range.start} → ${range.end}`;
    }
    return window.t('caption.range', {range: '—'});
  }

  function teamLabel(team){
    if (!team || team === 'all') {
      return window.t('caption.teamAll');
    }
    try {
      const teams = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
      if (teams && teams[team]) return teams[team];
    } catch (e) {
      // ignore
    }
    return team;
  }

  async function ensureTeamNames(){
    if (localStorage.getItem('hr:team:names')) return;
    try {
      const data = await window.dataLoader.fetch('./data/org/teams.json');
      const map = {};
      if (Array.isArray(data?.depts)) {
        data.depts.forEach(d => {
          map[d.id] = d.name || d.id;
        });
      }
      localStorage.setItem('hr:team:names', JSON.stringify(map));
    } catch (e) {
      // ignore
    }
  }

  async function render(){
    await ensureTeamNames();
    const range = readRange();
    const team = readTeam();
    const data = await loadMetrics(range);
    if (!data) {
      mount.innerHTML = '<p role="status">No data</p>';
      if (CAPTION) CAPTION.textContent = buildCaption(range, team);
      return;
    }

    const cards = KPI_CONFIG.map(cfg => {
      const value = resolveValue(data, cfg.key, team);
      const previous = resolvePrevious(data, cfg.key, team);
      const delta = value - previous;
      const spark = resolveSeries(data, cfg.key, team);
      const badge = buildDelta(delta, cfg.positive);
      return `<article class="tile">
        <header class="tile__head">
          <span class="tile__title">${labelFor(cfg.labelKey, cfg.key)}</span>
          <span class="tile__badge pill ${badge.className}">${badge.label}</span>
        </header>
        <div class="tile__kpi">${formatValue(value, cfg.decimals)}<span>${cfg.unit}</span></div>
        <div class="spark">${sparkline(spark)}</div>
        <footer class="tile__foot">
          <span>${window.t('label.updated')} ${updatedText(data.updated)}</span>
          <span>${spark.length || 0} pts</span>
        </footer>
      </article>`;
    }).join('');

    mount.innerHTML = `<div class="panel__grid">${cards}</div>`;
    if (CAPTION) CAPTION.textContent = buildCaption(range, team);
  }

  function resolveValue(data, key, team){
    if (team && team !== 'all' && data.teams && data.teams[team] && key in data.teams[team]) {
      return data.teams[team][key];
    }
    if (data.kpi && key in data.kpi) return data.kpi[key];
    return 0;
  }

  function resolvePrevious(data, key, team){
    if (team && team !== 'all' && data.breakdown && data.breakdown[key]) {
      const entry = data.breakdown[key].find(item => item.team === team);
      if (entry && typeof entry.previous === 'number') return entry.previous;
    }
    if (data.previous && key in data.previous) return data.previous[key];
    return resolveValue(data, key, team);
  }

  function resolveSeries(data, key, team){
    if (team && team !== 'all' && data.breakdown && data.breakdown[key]) {
      const entry = data.breakdown[key].find(item => item.team === team);
      if (entry && Array.isArray(entry.series)) return entry.series;
    }
    if (data.series && Array.isArray(data.series[key])) return data.series[key];
    return [];
  }

  function buildDelta(delta, positive){
    if (isNaN(delta)) return {label: window.t('delta.equal'), className: 'pill--neutral'};
    if (Math.abs(delta) < 0.1) {
      return {label: window.t('delta.equal'), className: 'pill--neutral'};
    }
    const improved = positive ? delta >= 0 : delta <= 0;
    return improved
      ? {label: window.t('delta.up'), className: 'pill--strong'}
      : {label: window.t('delta.down'), className: 'pill--critical'};
  }

  function updatedText(updated){
    if (!updated) return '';
    const dt = new Date(updated);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString();
  }

  function labelFor(key, fallback){
    const translation = window.t(key);
    if (translation && translation !== key) return translation;
    const map = {
      wellbeing_avg: 'Wellbeing',
      high_stress_pct: 'High stress %',
      fatigue_elevated_pct: 'Fatigue %',
      engagement_active_pct: 'Active %'
    };
    return map[fallback] || fallback;
  }
})();
