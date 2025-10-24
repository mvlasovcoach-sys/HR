function initHrBoard(host){
    const mount = typeof host === 'string' ? document.querySelector(host) : host;
    if (!mount) return;

    const CAPTION = document.getElementById('global-caption');
    const KPI_CONFIG = [
      {key: 'wellbeing_avg', labelKey: 'kpi.wellbeing', unit: '/100', decimals: 0, positive: true},
      {key: 'high_stress_pct', labelKey: 'metric.highStress', unit: '%', decimals: 0, positive: false},
      {key: 'fatigue_elevated_pct', labelKey: 'metric.elevatedFatigue', unit: '%', decimals: 0, positive: false},
      {key: 'engagement_active_pct', labelKey: 'metric.activeEngagement', unit: '%', decimals: 0, positive: true}
    ];

    render();
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
        render();
      }
    });
    document.addEventListener('i18n:change', render);

    function t(key, vars){
      return window.I18N?.t(key, vars) || key.replace(/^label\.|^range\./, '');
    }

    const getLang = () => window.I18N?.getLang?.() || 'en';
    const defaultDateOptions = lang => (lang === 'ru'
      ? {day: '2-digit', month: '2-digit', year: 'numeric'}
      : {day: 'numeric', month: 'short', year: 'numeric'});

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

    function escapeHtml(input){
      return String(input ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char] || char);
    }

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
        return canonicalPreset(range.preset);
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

    function sparkline(values, meta){
      if (!Array.isArray(values) || !values.length) {
        return '<div class="chart chart--spark" aria-hidden="true"></div>';
      }
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
      const lastX = values.length > 1 ? (step * (values.length - 1)).toFixed(2) : '100';
      const lastY = values.length ? (100 - ((values[values.length - 1] - min) / span) * 100).toFixed(2) : '50';
      const aria = meta?.aria ? ` aria-label="${escapeHtml(meta.aria)}"` : ' aria-hidden="true"';
      const tabindex = meta?.aria ? ' tabindex="0"' : '';
      const title = meta?.tooltip ? ` title="${escapeHtml(meta.tooltip)}"` : '';
      const trendAttr = meta?.trend ? ` data-trend="${escapeHtml(meta.trend)}"` : '';
      const tooltip = meta?.tooltip ? `<span class="chart__tooltip">${escapeHtml(meta.tooltip)}</span>` : '';
      return `<div class="chart chart--spark"${aria}${tabindex}${title}${trendAttr}><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><polyline points="${points}" /></svg><span class="chart__marker" style="left:${lastX}%;top:${lastY}%"></span>${tooltip}</div>`;
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
      const trendKey = sparkTrend(delta);
      const trendLabel = sparkTrendLabel(trendKey);
      const deltaText = formatSparkDelta(delta);
      const deltaLabel = window.I18N?.t('trend.delta', {delta: deltaText}) || `${deltaText} vs last`;
      const tooltip = `${trendLabel}; ${deltaLabel}`;
      const aria = tooltip.trim();
      return {trendLabel, deltaText, tooltip, aria, trend: trendKey};
    }

    function formatValue(value, decimals){
      return (value ?? 0).toFixed(decimals ?? 0);
    }

    function rangeLabel(range){
      if (!range) return t('caption.range', {range: '—'});
      if (range.preset) {
        const presetKey = displayPreset(range.preset);
        const mapping = {
          today: t('range.today'),
          '7d': t('range.7d'),
          mtd: t('range.mtd'),
          qtd: t('range.qtd'),
          ytd: t('range.ytd')
        };
        return mapping[presetKey] || t('caption.range', {range: '—'});
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
      if (!team || team === 'all') {
        return t('caption.teamAll');
      }
      try {
        const teams = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
        if (teams && teams[team]) return teams[team];
      } catch (e) {
        // ignore
      }
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
      const insufficient = Number(data?.n) > 0 && Number(data.n) < 5;
      toggleInsufficient(insufficient);
      if (!data) {
        mount.innerHTML = `<p role="status">${t('status.noData')}</p>`;
        if (CAPTION && window.Caption?.renderCaption) {
          window.Caption.renderCaption(CAPTION, {asOf: new Date(), insight: `${scenarioPrefix()}${t('caption.orgAvg') || t('caption.orgAverage')} · ${rangeLabel(range)} · ${teamLabel(team)}`});
        } else if (CAPTION) {
          CAPTION.textContent = `${scenarioPrefix()}${t('caption.orgAvg') || t('caption.orgAverage')} · ${rangeLabel(range)} · ${teamLabel(team)}`;
        }
        toggleInsufficient(false);
        return;
      }

      const cards = KPI_CONFIG.map(cfg => {
        const value = resolveValue(data, cfg.key, team);
        const previous = resolvePrevious(data, cfg.key, team);
        const delta = value - previous;
        const series = resolveSeries(data, cfg.key, team);
        const badge = buildDelta(delta, cfg.positive);
        const sparkInfo = buildSparkMeta(delta);
        const sparkMarkup = `<div class="spark tile__spark">${sparkline(series, sparkInfo)}</div>`;
        return `<article class="tile">
          <header class="tile__head">
            <span class="tile__title">${labelFor(cfg.labelKey, cfg.key)}</span>
            <span class="tile__badge pill ${badge.className}">${escapeHtml(badge.label)}</span>
          </header>
          <div class="tile__kpi tile__value">${formatValue(value, cfg.decimals)}<span>${cfg.unit}</span></div>
          ${sparkMarkup}
          <footer class="tile__foot">
            <span>${t('ui.updated') || t('label.updated')} ${updatedText(data.updated)}</span>
            <span>${series.length || 0} pts</span>
          </footer>
        </article>`;
      }).join('');

      mount.innerHTML = `<div class="panel__grid">${cards}</div>`;
      if (CAPTION && window.Caption?.renderCaption) {
        window.Caption.renderCaption(CAPTION, {asOf: new Date(), insight: `${scenarioPrefix()}${t('caption.orgAvg') || t('caption.orgAverage')} · ${rangeLabel(range)} · ${teamLabel(team)}`});
      } else if (CAPTION) {
        CAPTION.textContent = `${scenarioPrefix()}${t('caption.orgAvg') || t('caption.orgAverage')} · ${rangeLabel(range)} · ${teamLabel(team)}`;
      }
    }

    function toggleInsufficient(active){
      if (!mount) return;
      if (active) {
        mount.setAttribute('data-insufficient', 'true');
      } else {
        mount.removeAttribute('data-insufficient');
      }
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
      if (team && team !== 'all' && data.seriesByTeam && data.seriesByTeam[key] && data.seriesByTeam[key][team]) {
        return data.seriesByTeam[key][team];
      }
      if (data.series && data.series[key]) return data.series[key];
      if (data.breakdown && data.breakdown[key]) {
        const entry = data.breakdown[key].find(item => item.team === team);
        if (entry && Array.isArray(entry.series)) return entry.series;
      }
      return [];
    }

    function buildDelta(delta, positive){
      if (isNaN(delta)) return {label: t('delta.equal'), className: 'pill--neutral'};
      if (Math.abs(delta) < 0.1) {
        return {label: t('delta.equal'), className: 'pill--neutral'};
      }
      const improved = positive ? delta >= 0 : delta <= 0;
      return improved
        ? {label: t('delta.up'), className: 'pill--strong'}
        : {label: t('delta.down'), className: 'pill--critical'};
    }

    function labelFor(key, fallback){
      const translation = t(key);
      if (translation && translation !== key) return translation;
      return fallback;
    }

    function updatedText(input){
      if (!input) return '';
      const date = new Date(input);
      if (isNaN(date)) return input;
      return formatLocaleDate(date);
    }
}

window.renderHrBoard = function(target){
  const boot = () => initHrBoard(target || document.getElementById('hr-board'));
  if (window.I18N?.onReady) {
    window.I18N.onReady(boot);
  } else {
    boot();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const lazyHost = document.querySelector('[data-mount="renderHrBoard"]');
  if (!lazyHost) {
    window.renderHrBoard('#hr-board');
  }
});
