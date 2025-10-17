function initPage(){
    const chartEl = document.getElementById('wlb-chart');
    if (!chartEl) return;
    const legendEl = document.getElementById('wellbeing-legend');
    const breakdownEl = document.getElementById('analytics-breakdown');
    const captionEl = document.getElementById('analytics-caption');
    const maToggle = document.getElementById('maToggle');
    const deltaBadgeEl = document.getElementById('wellbeing-delta');
    const miniGrid = document.getElementById('analytics-mini-kpis');
    const trackerPanel = document.getElementById('analytics-tracker-panel');
    const breakdownPanel = document.querySelector('.analytics-breakdown');

    const BREAKDOWN_KEYS = [
      {key: 'high_stress_pct', label: 'kpi.highStress', inverse: true, unit: '%'},
      {key: 'fatigue_elevated_pct', label: 'kpi.elevatedFatigue', inverse: true, unit: '%'},
      {key: 'engagement_active_pct', label: 'kpi.activeEngagement', inverse: false, unit: '%'}
    ];

    const MA_KEY = 'hr:analytics:ma';
    let useMA = readStoredMA();
    let currentSeries = null;
    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        if (currentSeries) {
          renderWellbeingChart(currentSeries);
        }
      });
      resizeObserver.observe(chartEl);
    } else {
      window.addEventListener('resize', () => {
        if (currentSeries) {
          renderWellbeingChart(currentSeries);
        }
      });
    }
    if (maToggle) {
      maToggle.checked = useMA;
      maToggle.addEventListener('change', () => {
        useMA = maToggle.checked;
        storeMA(useMA);
        render();
      });
    }

    render();
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
        render();
      }
      if (evt.key === MA_KEY && maToggle) {
        useMA = readStoredMA();
        maToggle.checked = useMA;
        render();
      }
    });
    document.addEventListener('i18n:change', render);

    function t(key, vars){
      return window.I18N?.t(key, vars) || key.replace(/^label\.|^range\./, '');
    }

    function readRange(){
      try {
        const raw = localStorage.getItem('hr:range');
        if (!raw) return {preset: '7d'};
        const parsed = JSON.parse(raw);
        if (parsed && parsed.preset) return parsed;
        if (parsed && parsed.start && parsed.end) return parsed;
      } catch (e) {}
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

    function readStoredMA(){
      try {
        return localStorage.getItem(MA_KEY) === '1';
      } catch (e) {
        return false;
      }
    }

    function storeMA(value){
      try {
        localStorage.setItem(MA_KEY, value ? '1' : '0');
        dispatchEvent(new StorageEvent('storage', {key: MA_KEY}));
      } catch (e) {}
    }

    async function render(){
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      const metrics = await loadMetrics(preset, range, team);
      const insufficient = Number(metrics?.n) > 0 && Number(metrics.n) < 5;
      toggleInsufficient(insufficient);
      if (!metrics) {
        currentSeries = [];
        renderWellbeingChart(currentSeries);
        if (legendEl) legendEl.innerHTML = `<span>${t('status.noData')}</span>`;
        if (breakdownEl) breakdownEl.innerHTML = '';
        if (miniGrid) miniGrid.innerHTML = '';
        if (deltaBadgeEl) {
          deltaBadgeEl.textContent = '';
          deltaBadgeEl.className = 'delta-badge';
        }
        if (captionEl) captionEl.textContent = buildCaption(range, team);
        return;
      }

      renderTracker(metrics, team);
      renderBreakdown(metrics, team);
      renderMiniKpis(metrics, team);
      if (captionEl) captionEl.textContent = buildCaption(range, team);
    }

    async function loadMetrics(preset, range, team){
      try {
        const path = `./data/org/metrics_${preset}.json`;
        return await window.dataLoader.fetch(path, {range, team});
      } catch (e) {
        console.error('Analytics metrics failed', e);
        return null;
      }
    }

    function renderTracker(metrics, team){
      const info = metricDeltaInfo(metrics, 'wellbeing_avg', team);
      const values = Array.isArray(info.series) && info.series.length ? info.series : (metrics.series?.wellbeing_avg || []);
      const maValues = useMA ? movingAverage(values, 3) : values;
      const current = info.current;
      const fallbackPrevious = current != null && info.delta != null ? current - info.delta : null;
      const previous = info.previous != null ? info.previous : fallbackPrevious;
      const delta = info.delta != null ? info.delta : (current != null && previous != null ? current - previous : 0);
      const badge = deltaBadge(delta, true);
      const modeLabel = useMA ? t('label.movingAverage') : t('label.actual');

      if (legendEl) {
        legendEl.innerHTML = [
          `<span>${t('kpi.wellbeing')} (${modeLabel})</span>`,
          `<span>${t('status.value')}: ${current != null ? Math.round(current) : '–'}/100</span>`,
          `<span class="delta-badge ${badge.className}">${badge.label}</span>`
        ].join('');
      }

      if (deltaBadgeEl) {
        const baseSeries = Array.isArray(info.series)
          ? info.series.map(val => Number(val)).filter(Number.isFinite)
          : [];
        const trendDelta = baseSeries.length ? deltaVsPrior(baseSeries) : 0;
        const label = trendDelta > 0
          ? (window.I18N?.t('analytics.deltaImproved') || 'Improved')
          : trendDelta < 0
            ? (window.I18N?.t('analytics.deltaDeclined') || 'Declined')
            : (window.I18N?.t('analytics.deltaNoChange') || 'No change');
        const symbol = trendDelta > 0 ? '+' : trendDelta < 0 ? '−' : '±';
        const magnitude = Math.abs(Math.round(trendDelta));
        const text = `${label} ${symbol}${magnitude}`;
        const className = trendDelta > 0
          ? 'delta-badge--up'
          : trendDelta < 0
            ? 'delta-badge--down'
            : 'delta-badge--neutral';
        deltaBadgeEl.textContent = text;
        deltaBadgeEl.className = `delta-badge ${className}`.trim();
        deltaBadgeEl.setAttribute('aria-label', `${t('delta.header')}: ${text}`);
      }

      chartEl.setAttribute('aria-label', `${t('kpi.wellbeing')} (${modeLabel})`);

      currentSeries = maValues.length ? maValues.reduce((acc, value, index) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
          acc.push(num);
        } else {
          const fallback = index > 0 ? acc[index - 1] : 0;
          acc.push(fallback ?? 0);
        }
        return acc;
      }, []) : [];

      renderWellbeingChart(currentSeries);
    }

    function renderWellbeingChart(series){
      const host = document.getElementById('wlb-chart');
      if (!host) return;

      if (!Array.isArray(series) || series.length === 0) {
        host.setAttribute('aria-label', t('status.noData'));
        host.innerHTML = `<p role="status">${t('status.noData')}</p>`;
        return;
      }

      const { width } = host.getBoundingClientRect();
      const height = host.clientHeight;
      const pad = 28;
      const W = Math.max(320, Math.floor(width));
      const H = Math.max(200, Math.floor(height));

      host.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('role', 'presentation');
      svg.setAttribute('aria-hidden', 'true');
      host.appendChild(svg);

      const xs = (i) => pad + i * ((W - 2 * pad) / Math.max(1, series.length - 1));
      const min = Math.min(...series);
      const max = Math.max(...series);
      const ys = (v) => {
        if (max === min) return H / 2;
        return pad + (H - 2 * pad) * (1 - (v - min) / (max - min));
      };

      let d = `M ${xs(0)} ${ys(series[0])}`;
      if (series.length === 1) {
        d += ` L ${xs(0)} ${ys(series[0])}`;
      } else {
        for (let i = 1; i < series.length; i += 1) {
          d += ` L ${xs(i)} ${ys(series[i])}`;
        }
      }
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'var(--cyan, #27E0FF)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }

    function renderBreakdown(metrics, team){
      if (!breakdownEl) return;
      if (!metrics.breakdown) {
        breakdownEl.innerHTML = '';
        return;
      }
      const cards = BREAKDOWN_KEYS.map(cfg => {
        const list = metrics.breakdown[cfg.key] || [];
        const entry = team !== 'all' ? list.find(item => item.team === team) : aggregateEntry(list);
        const info = breakdownInfo(metrics, cfg.key, team, entry);
        const value = info.value ?? 0;
        const previous = info.previous ?? value;
        const series = info.series || [];
        const delta = info.delta != null ? info.delta : value - previous;
        const badge = deltaBadge(delta, !cfg.inverse);
        return `<article class="tile breakdown-card">
          <header class="tile__head">
            <span class="tile__title">${t(cfg.label)}</span>
            <span class="delta-badge ${badge.className}">${badge.label}</span>
          </header>
          <div class="tile__kpi">${Math.round(value)}<span>${cfg.unit}</span></div>
          <div class="spark">${sparkline(series)}</div>
          <footer class="breakdown-meta">
            <span>${t('status.value')} ${Math.round(value)}${cfg.unit}</span>
            <span>${t('status.target')}: ${Math.round(previous)}${cfg.unit}</span>
          </footer>
        </article>`;
      }).join('');
      breakdownEl.innerHTML = cards;
    }

    function renderMiniKpis(metrics, team){
      if (!miniGrid) return;
      miniGrid.innerHTML = '';
      const nValue = Number(metrics?.n);
      if (Number.isFinite(nValue) && window.guardSmallN) {
        if (window.guardSmallN(nValue, miniGrid)) {
          return;
        }
      } else {
        miniGrid.removeAttribute('data-guard');
      }
      const items = BREAKDOWN_KEYS.map(cfg => {
        const info = metricDeltaInfo(metrics, cfg.key, team);
        const rawValue = teamValue(metrics?.kpi, cfg.key, team);
        const value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : (info.current ?? 0);
        const teamDelta = team !== 'all' && metrics?.delta?.teams?.[team] && cfg.key in metrics.delta.teams[team]
          ? metrics.delta.teams[team][cfg.key]
          : metrics?.delta?.[cfg.key];
        const delta = Number.isFinite(Number(teamDelta))
          ? Number(teamDelta)
          : info.delta != null
            ? info.delta
            : (info.previous != null ? value - info.previous : 0);
        const badge = deltaBadge(delta, !cfg.inverse);
        const magnitude = Number.isFinite(delta) ? `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta))}` : '0';
        const summary = Number.isFinite(delta) ? `${badge.label} ${magnitude}` : badge.label;
        return `<div class="mini-kpis__item">
          <span class="mini-kpis__label">${t(cfg.label)}</span>
          <strong class="mini-kpis__value">${Math.round(value)}${cfg.unit}</strong>
          <span class="mini-kpis__delta ${badge.className}" aria-label="${summary}">${summary}</span>
        </div>`;
      }).join('');
      miniGrid.innerHTML = items;
    }

    function aggregateEntry(list){
      if (!Array.isArray(list) || list.length === 0) return null;
      const total = list.reduce((acc, item) => acc + (item.value || 0), 0);
      const prev = list.reduce((acc, item) => acc + (item.previous || 0), 0);
      const avgSeries = averageSeries(list.map(item => item.series));
      return {value: total / list.length, previous: prev / list.length, series: avgSeries};
    }

    function averageSeries(seriesList){
      const length = Math.max(...seriesList.map(arr => arr?.length || 0));
      if (!length) return [];
      const result = [];
      for (let i = 0; i < length; i += 1) {
        let sum = 0;
        let count = 0;
        seriesList.forEach(arr => {
          if (Array.isArray(arr) && typeof arr[i] === 'number') {
            sum += arr[i];
            count += 1;
          }
        });
        result.push(count ? sum / count : 0);
      }
      return result;
    }

    function teamValue(source, key, team){
      if (!source) return null;
      if (team !== 'all' && source.teams && source.teams[team] && key in source.teams[team]) {
        return source.teams[team][key];
      }
      if (key in source) return source[key];
      return null;
    }

    function metricDeltaInfo(metrics, key, team){
      if (!metrics) return {current: null, previous: null, delta: null, series: []};
      const preset = metrics?.range || presetForRange(readRange());
      const series = seriesForMetric(metrics, key, team);
      const windowStats = computeWindowStats(series, preset);

      let current = windowStats && Number.isFinite(windowStats.current)
        ? windowStats.current
        : (teamValue(metrics.kpi, key, team) ?? metrics.kpi?.[key] ?? null);

      let previous = windowStats && Number.isFinite(windowStats.previous)
        ? windowStats.previous
        : null;

      let delta = windowStats && Number.isFinite(windowStats.delta)
        ? windowStats.delta
        : null;

      if (delta == null) {
        if (team !== 'all' && metrics?.delta?.teams?.[team] && key in metrics.delta.teams[team]) {
          const raw = metrics.delta.teams[team][key];
          delta = Number.isFinite(raw) ? raw : null;
        } else if (metrics?.delta && key in metrics.delta) {
          const raw = metrics.delta[key];
          delta = Number.isFinite(raw) ? raw : null;
        }
      }

      if (previous == null) {
        if (windowStats && Number.isFinite(windowStats.previous)) {
          previous = windowStats.previous;
        } else if (delta != null && current != null) {
          previous = current - delta;
        } else {
          const candidate = teamValue(metrics.previous, key, team) ?? metrics.previous?.[key];
          if (Number.isFinite(candidate)) {
            previous = candidate;
            if (delta == null && current != null) {
              delta = current - previous;
            }
          }
        }
      }

      return {current, previous, delta, series};
    }

    function breakdownInfo(metrics, key, team, entry){
      const base = metricDeltaInfo(metrics, key, team);
      const value = entry?.value ?? base.current;
      let delta = entry && Number.isFinite(entry.delta) ? entry.delta : base.delta;
      let previous = entry && Number.isFinite(entry.previous) ? entry.previous : base.previous;
      if (previous == null && value != null && delta != null) {
        previous = value - delta;
      }
      if (delta == null && previous != null && value != null) {
        delta = value - previous;
      }
      const series = Array.isArray(entry?.series) && entry.series.length ? entry.series : base.series;
      return {value, previous, delta, series};
    }

    function toggleInsufficient(active){
      [trackerPanel, breakdownPanel].forEach(panel => {
        if (!panel) return;
        if (active) {
          panel.setAttribute('data-insufficient', 'true');
          panel.setAttribute('data-guard-message', t('guard.insufficient'));
        } else {
          panel.removeAttribute('data-insufficient');
          panel.removeAttribute('data-guard-message');
        }
      });
    }

    function movingAverage(values, window){
      if (!Array.isArray(values) || values.length === 0) return [];
      const result = [];
      for (let i = 0; i < values.length; i += 1) {
        let sum = 0;
        let count = 0;
        for (let j = i - window + 1; j <= i; j += 1) {
          if (j >= 0 && typeof values[j] === 'number') {
            sum += values[j];
            count += 1;
          }
        }
        result.push(count ? sum / count : values[i]);
      }
      return result;
    }

    function deltaVsPrior(series){
      const n=series.length, half=Math.floor(n/2);
      if(!half) return 0;
      const avg=a=>Math.round(a.reduce((s,v)=>s+v,0)/a.length);
      return avg(series.slice(half)) - avg(series.slice(0,half));
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
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="rgba(39,224,255,0.9)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${points}" /></svg>`;
    }

    function seriesForMetric(metrics, key, team){
      if (!metrics) return [];
      if (team && team !== 'all') {
        const breakdownList = metrics?.breakdown?.[key];
        if (Array.isArray(breakdownList)) {
          const entry = breakdownList.find(item => item?.team === team);
          if (entry && Array.isArray(entry.series) && entry.series.length) {
            return entry.series;
          }
        }
        const teamSeries = metrics?.series?.teams?.[team]?.[key];
        if (Array.isArray(teamSeries) && teamSeries.length) {
          return teamSeries;
        }
      }
      const direct = metrics?.series?.[key];
      if (Array.isArray(direct) && direct.length) return direct;
      const trend = metrics?.kpi_trend?.[key];
      if (Array.isArray(trend) && trend.length) return trend;
      if (key === 'wellbeing_avg' && metrics?.heatmap) {
        const hmSeries = heatmapSeries(metrics.heatmap, team);
        if (hmSeries.length) return hmSeries;
      }
      return [];
    }

    function heatmapSeries(heatmap, team){
      if (!heatmap) return [];
      if (team && team !== 'all') {
        const slice = heatmap.value?.[team];
        if (Array.isArray(slice)) {
          return slice.map(val => Number(val));
        }
      }
      const cols = Array.isArray(heatmap.cols) ? heatmap.cols.length : 0;
      if (!cols) return [];
      const sums = new Array(cols).fill(0);
      const counts = new Array(cols).fill(0);
      Object.values(heatmap.value || {}).forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach((val, idx) => {
          const num = Number(val);
          if (Number.isFinite(num)) {
            sums[idx] += num;
            counts[idx] += 1;
          }
        });
      });
      return sums.map((sum, idx) => counts[idx] ? sum / counts[idx] : NaN);
    }

    function computeWindowStats(series, rangeKey){
      if (!Array.isArray(series) || series.length === 0) return null;
      const windowSize = windowSizeForRange(rangeKey, series.length);
      if (!windowSize) return null;
      const numeric = series.map(value => Number(value));
      const currentSlice = numeric.slice(-windowSize).filter(Number.isFinite);
      const previousSlice = numeric.slice(-windowSize * 2, -windowSize).filter(Number.isFinite);
      if (!previousSlice.length || !currentSlice.length) return null;
      const currentAvg = average(currentSlice);
      const previousAvg = average(previousSlice);
      if (!Number.isFinite(currentAvg) || !Number.isFinite(previousAvg)) return null;
      return {current: currentAvg, previous: previousAvg, delta: currentAvg - previousAvg};
    }

    function windowSizeForRange(rangeKey, length){
      const defaults = { '7d': 7, month: 4, year: 12 };
      const key = rangeKey || '7d';
      let size = defaults[key] || Math.max(1, Math.floor(length / 2));
      if (!length || length < 2) return null;
      if (length < size * 2) {
        size = Math.floor(length / 2);
      }
      if (size < 1) return null;
      return size;
    }

    function average(values){
      if (!Array.isArray(values) || !values.length) return NaN;
      const total = values.reduce((acc, val) => acc + Number(val || 0), 0);
      return total / values.length;
    }

    function deltaBadge(delta, positive){
      if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) {
        return {label: t('delta.equal'), className: 'delta-badge--neutral'};
      }
      const improved = positive ? delta >= 0 : delta <= 0;
      return improved
        ? {label: t('delta.up'), className: 'delta-badge--up'}
        : {label: t('delta.down'), className: 'delta-badge--down'};
    }

    function buildCaption(range, team){
      const rangeText = rangeLabel(range);
      const teamText = teamLabel(team);
      const prefix = t('caption.orgAvg') || t('caption.orgAverage');
      return `${scenarioPrefix()}${prefix} · ${rangeText} · ${teamText}`;
    }

    function rangeLabel(range){
      if (!range) return t('range.7d');
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
      return t('range.7d');
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
  }

document.addEventListener('DOMContentLoaded', () => {
  window.I18N.onReady(initPage);
});
