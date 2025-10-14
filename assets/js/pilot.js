(function(){
  function initPage(){
    const kpiSection = document.getElementById('pilot-kpis');
    if (!kpiSection) return;
    const heatmapSection = document.getElementById('pilot-heatmap');
    const eventsSection = document.getElementById('pilot-events');
    const captionEl = document.getElementById('pilot-caption');
    const exportBtn = document.getElementById('pilot-export');

    let events = [];
    const state = {
      engagement: null,
      metrics: null,
      range: {preset: '7d'},
      team: 'all',
      preset: '7d',
      eventCounts: {critical: 0, warning: 0, info: 0},
      kpiSummary: []
    };

    exportBtn?.addEventListener('click', handleExport);
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team') {
        render();
      }
    });
    document.addEventListener('i18n:change', render);

    loadEvents().then(render);

    async function loadEvents(){
      try {
        const data = await window.dataLoader.fetch('./data/org/events.json');
        events = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
      } catch (e) {
        console.error('Pilot events failed', e);
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

    async function render(){
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      await ensureNps();
      const [engagement, metrics] = await Promise.all([
        loadEngagement(preset, range, team),
        loadMetrics(preset, range, team)
      ]);
      state.range = range;
      state.team = team;
      state.preset = preset;
      state.engagement = engagement;
      state.metrics = metrics;
      renderKpis(engagement, preset, team, range);
      renderHeatmap(metrics);
      renderEvents(range, team);
      if (captionEl) captionEl.textContent = buildCaption(range, team);
    }

    async function loadEngagement(preset, range, team){
      try {
        const path = `./data/org/engagement_${preset}.json`;
        return await window.dataLoader.fetch(path, {range, team});
      } catch (e) {
        console.error('Pilot engagement failed', e);
        return null;
      }
    }

    async function loadMetrics(preset, range, team){
      try {
        const path = `./data/org/metrics_${preset}.json`;
        return await window.dataLoader.fetch(path, {range, team});
      } catch (e) {
        console.error('Pilot metrics failed', e);
        return null;
      }
    }

    function renderKpis(data, preset, team, range){
      if (!data) {
        kpiSection.innerHTML = '<p role="status">No KPI data</p>';
        state.kpiSummary = [];
        return;
      }
      const npsSlice = getNpsSlice(preset);
      const onboardingVal = data.kpi?.onboarding_pct;
      const onboardingPrev = data.previous?.onboarding_pct;
      const weeklyVal = data.kpi?.weekly_active_pct;
      const weeklyPrev = data.previous?.weekly_active_pct;
      const npsCurrent = teamNpsCurrent(npsSlice, team);
      const npsPrevious = teamNpsPrevious(npsSlice, team);
      const alertsValue = alertCount(range, team);
      const cards = [
        buildKpiCard('kpi.onboarding', onboardingVal, onboardingPrev, data.targets?.onboarding_pct, data.series?.onboarding_pct || []),
        buildKpiCard('kpi.weeklyActive', weeklyVal, weeklyPrev, data.targets?.weekly_active_pct, data.series?.weekly_active_pct || []),
        buildKpiCard('kpi.nps', npsCurrent, npsPrevious, data.targets?.nps, npsSlice?.values || []),
        buildKpiCard('kpi.alertCount', alertsValue, null, 3, alertSpark(data.timeline || [], range, team))
      ];
      kpiSection.innerHTML = cards.join('');
      state.kpiSummary = [
        buildSummaryEntry('kpi.onboarding', onboardingVal, onboardingPrev, data.targets?.onboarding_pct, '%'),
        buildSummaryEntry('kpi.weeklyActive', weeklyVal, weeklyPrev, data.targets?.weekly_active_pct, '%'),
        buildSummaryEntry('kpi.nps', npsCurrent, npsPrevious, data.targets?.nps, 'nps'),
        buildSummaryEntry('kpi.alertCount', alertsValue, null, 3, 'count', {skipDelta: true})
      ];
    }

    function buildKpiCard(labelKey, value, previous, target, series){
      const val = value != null ? Math.round(value) : 0;
      const trend = previous != null ? val - previous : 0;
      const targetPercent = target ? Math.min(100, Math.max(0, (val / target) * 100)) : null;
      return `<article class="tile">
        <header class="tile__head">
          <span class="tile__title">${window.t(labelKey)}</span>
          <span class="kpi-card__delta ${deltaClass(trend)}">${deltaLabel(trend)}</span>
        </header>
        <div class="tile__kpi">${val}<span>${labelKey === 'kpi.nps' || labelKey === 'kpi.alertCount' ? '' : '%'}</span></div>
        <div class="pilot-trend">
          <div class="pilot-trend__bar"><div class="pilot-trend__fill" style="width:${targetPercent != null ? targetPercent : 0}%"></div></div>
          <span>${target != null ? `${window.t('status.target')} ${Math.round(target)}` : ''}</span>
        </div>
        <div class="spark kpi-card__spark">${sparkline(series)}</div>
      </article>`;
    }

    function renderHeatmap(metrics){
      if (!metrics || !metrics.heatmap) {
        heatmapSection.innerHTML = '<p role="status">No heatmap data</p>';
        return;
      }
      const hm = metrics.heatmap;
      const rows = Array.isArray(hm.rows) ? hm.rows : [];
      const cols = Array.isArray(hm.cols) ? hm.cols : [];
      const colDates = Array.isArray(hm.colDates) ? hm.colDates : cols;
      const teamNames = teamMap();
      const grid = [`<div class="heatmap-grid" style="grid-template-columns:repeat(${cols.length + 1}, minmax(0,1fr))">`];
      grid.push(`<div class="heatmap-header"></div>`);
      cols.forEach((col, idx) => {
        grid.push(`<div class="heatmap-header">${formatDate(colDates[idx] || col)}</div>`);
      });
      rows.forEach(row => {
        grid.push(`<div class="heatmap-header">${teamNames[row] || row}</div>`);
        const values = hm.value?.[row] || [];
        cols.forEach((col, idx) => {
          const val = values[idx];
          grid.push(`<div>${val != null ? Math.round(val) : '–'}</div>`);
        });
      });
      grid.push('</div>');
      heatmapSection.innerHTML = `<div class="panel__meta" data-i18n="section.pilotHeatmap">Heatmap snapshot</div>${grid.join('')}`;
      window.I18N?.translate?.();
    }

    function renderEvents(range, team){
      const {start, end} = resolveRangeWindow(range);
      const counts = events.reduce((acc, ev) => {
        if (team !== 'all' && ev.team !== team) return acc;
        const ts = new Date(ev.ts);
        if (start && ts < start) return acc;
        if (end && ts > end) return acc;
        acc[ev.severity] = (acc[ev.severity] || 0) + 1;
        return acc;
      }, {});
      const severities = ['critical', 'warning', 'info'];
      const list = severities.map(sev => `<li><strong>${tSeverity(sev)}</strong><br>${counts[sev] || 0} ${window.t('kpi.alertCount')}</li>`).join('');
      eventsSection.innerHTML = `<div class="panel__meta" data-i18n="section.pilotEvents">Events summary</div><ul>${list}</ul>`;
      state.eventCounts = {
        critical: counts.critical || 0,
        warning: counts.warning || 0,
        info: counts.info || 0
      };
      window.I18N?.translate?.();
    }

    function alertCount(range, team){
      const {start, end} = resolveRangeWindow(range);
      return events.filter(ev => {
        if (team !== 'all' && ev.team !== team) return false;
        const ts = new Date(ev.ts);
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        return true;
      }).length;
    }

    function alertSpark(timeline, range, team){
      if (!Array.isArray(timeline) || !timeline.length) return [];
      const windowRange = resolveRangeWindow(range);
      return timeline.map(dateStr => {
        const start = new Date(dateStr);
        const end = new Date(dateStr);
        end.setHours(23, 59, 59, 999);
        return events.filter(ev => {
          if (team && team !== 'all' && ev.team !== team) return false;
          const ts = new Date(ev.ts);
          if (windowRange.start && ts < windowRange.start) return false;
          if (windowRange.end && ts > windowRange.end) return false;
          return ts >= start && ts <= end;
        }).length;
      });
    }

    function getNpsSlice(preset){
      return window.npsCache?.[preset];
    }

    function teamNpsCurrent(slice, team){
      if (!slice) return null;
      if (team !== 'all' && slice.teams && slice.teams[team]) return slice.teams[team].current;
      return slice.current;
    }

    function teamNpsPrevious(slice, team){
      if (!slice) return null;
      if (team !== 'all' && slice.teams && slice.teams[team]) return slice.teams[team].previous;
      return slice.previous;
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
        return {start: new Date(now.getFullYear(), 0, 1), end: now};
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

    function deltaLabel(delta){
      if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) return window.t('delta.equal');
      return delta > 0 ? window.t('delta.up') : window.t('delta.down');
    }

    function deltaClass(delta){
      if (delta == null || isNaN(delta) || Math.abs(delta) < 0.1) return 'kpi-card__delta--neutral';
      return delta > 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down';
    }

    function buildSummaryEntry(labelKey, value, previous, target, unit, options={}){
      const val = Number.isFinite(value) ? Math.round(value) : null;
      const prev = Number.isFinite(previous) ? Math.round(previous) : null;
      const delta = !options.skipDelta && val != null && prev != null ? val - prev : null;
      const valueText = formatSummaryValue(val, unit);
      const targetText = target != null ? formatSummaryTarget(unit, target) : '';
      const statusText = target != null && val != null
        ? (val >= target ? window.t('status.onTarget') : window.t('status.belowTarget'))
        : '';
      const deltaText = options.skipDelta
        ? ''
        : delta != null
          ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}${deltaUnitSuffix(unit)} (${deltaLabel(delta)})`
          : window.t('delta.equal');
      return {
        label: window.t(labelKey),
        valueText,
        targetText,
        statusText,
        deltaText
      };
    }

    function formatSummaryValue(value, unit){
      if (value == null) return '—';
      if (unit === '%') return `${value}%`;
      if (unit === 'nps') return `${value > 0 ? '+' : ''}${value}`;
      return String(value);
    }

    function formatSummaryTarget(unit, target){
      const rounded = Math.round(target);
      if (unit === '%') return `≥${rounded}%`;
      if (unit === 'nps') return `≥${rounded > 0 ? '+' : ''}${rounded}`;
      return `≥${rounded}`;
    }

    function deltaUnitSuffix(unit){
      if (unit === '%') return '%';
      return '';
    }

    function sparkline(values){
      if (!Array.isArray(values) || !values.length) return '';
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

    function formatDate(value){
      const dt = new Date(value);
      return isNaN(dt) ? value : dt.toLocaleDateString();
    }

    function capitalize(str){
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    function tSeverity(key){
      const translations = {
        critical: window.t('events.severity.critical') || 'Critical',
        warning: window.t('events.severity.warning') || 'Warning',
        info: window.t('events.severity.info') || 'Info'
      };
      return translations[key] || capitalize(key);
    }

    function teamMap(){
      try {
        return JSON.parse(localStorage.getItem('hr:team:names') || 'null') || {};
      } catch (e) {
        return {};
      }
    }

    function teamLabel(team){
      if (!team || team === 'all') return window.t('caption.teamAll') || 'All Teams';
      return teamMap()[team] || team;
    }

    function buildCaption(range, team){
      const rangeText = rangeLabel(range);
      const teamText = team === 'all' ? window.t('caption.teamAll') : teamMap()[team] || team;
      return `${window.t('caption.orgAverage')}${window.t('caption.separator')}${rangeText}${window.t('caption.separator')}${teamText}`;
    }

    function rangeLabel(range){
      if (!range) return window.t('range.7d');
      if (range.preset) {
        const map = {
          day: window.t('range.day'),
          '7d': window.t('range.7d'),
          month: window.t('range.month'),
          year: window.t('range.year')
        };
        return map[range.preset] || window.t('range.7d');
      }
      if (range.start && range.end) return `${range.start} → ${range.end}`;
      return window.t('range.7d');
    }

    async function handleExport(){
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      try {
        const teamSlug = team === 'all' ? 'all-teams' : team;
        const gdprHeading = (() => {
          const text = window.t('pilot.gdpr') || '';
          return text.includes(':') ? text.split(':')[0] : text;
        })();
        const payload = {
          filename: `pilot_${teamSlug}_${preset}.pdf`,
          meta: {
            title: window.t('header.pilot') || 'Pilot Dashboard',
            team: `${window.t('label.teamFilter') || 'Team'}: ${teamLabel(team)}`,
            range: `${window.t('label.range') || 'Range'}: ${rangeLabel(range)}`,
            generated: window.t('label.generatedAt', {date: new Date().toLocaleString()}),
            kpiTitle: window.t('section.engagementOverview') || 'Engagement KPIs',
            heatmapTitle: window.t('section.pilotHeatmap') || 'Heatmap snapshot',
            eventsTitle: window.t('section.pilotEvents') || 'Events summary',
            noteTitle: gdprHeading
          },
          kpis: state.kpiSummary.map(entry => ({
            label: entry.label,
            valueText: entry.valueText,
            targetText: entry.targetText,
            statusText: entry.statusText,
            deltaText: entry.deltaText
          })),
          heatmapEl: heatmapSection,
          events: ['critical', 'warning', 'info'].map(sev => ({
            label: tSeverity(sev),
            count: state.eventCounts[sev] || 0
          })),
          note: document.querySelector('.pilot-note')?.textContent?.trim() || ''
        };
        await window.exporter.exportPilotSummary(payload);
      } catch (e) {
        console.error('Pilot export failed', e);
        alert('Export failed. Please try again.');
      }
    }

    async function ensureNps(){
      if (window.npsCache) return;
      window.npsCache = {};
      try {
        const data = await window.dataLoader.fetch('./data/org/nps.json');
        if (data && data.series) {
          Object.keys(data.series).forEach(key => {
            window.npsCache[key] = data.series[key];
          });
        }
      } catch (e) {
        console.error('Failed to load NPS cache', e);
      }
    }

  }

  function boot(){
    Promise.resolve().then(() => {
      if (window.I18N?.onReady) {
        window.I18N.onReady(initPage);
      } else {
        initPage();
      }
    });
  }

  if (document.readyState !== 'loading') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }
})();
