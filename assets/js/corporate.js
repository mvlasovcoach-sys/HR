(function(){
  const page = document.querySelector('.main--corporate');
  if (!page) return;

  const els = {
    kpis: document.getElementById('corporate-kpis'),
    heatmap: document.getElementById('corporate-heatmap'),
    events: document.getElementById('corporate-events'),
    rangeCaption: document.getElementById('corporate-range-caption'),
    activity: document.getElementById('corporate-activity'),
    exportBtn: document.getElementById('activity-export'),
    tabButtons: Array.from(document.querySelectorAll('.corp-tab')),
    panels: Array.from(document.querySelectorAll('.corp-panel')),
    teamFilter: document.getElementById('event-team-filter'),
    severityFilter: document.getElementById('event-severity-filter'),
    typeFilter: document.getElementById('event-type-filter')
  };

  const state = {
    teams: [],
    teamMap: new Map(),
    metrics: null,
    rangeSelection: null,
    rangePreset: '7d',
    rangeWindow: null,
    events: [],
    filters: {
      team: new Set(),
      severity: new Set(),
      type: new Set()
    },
    activeTab: 'overview',
    heatmapCells: [],
    pendingHighlight: null,
    highlightTimer: null,
    activitySort: {key: 'date', direction: 'desc'}
  };

  const KPI_CONFIG = [
    {key: 'wellbeing_avg', label: 'Wellbeing', suffix: '', format: (v)=>Math.round(v)},
    {key: 'high_stress_pct', label: 'High Stress', suffix: '%', format: (v)=>Math.round(v)},
    {key: 'fatigue_elevated_pct', label: 'Elevated Fatigue', suffix: '%', format: (v)=>Math.round(v)},
    {key: 'engagement_active_pct', label: 'Active Engagement', suffix: '%', format: (v)=>Math.round(v)}
  ];

  init();

  async function init(){
    await loadTeams();
    await loadEvents();
    buildFilterControls();
    setupTabs();
    els.exportBtn?.addEventListener('click', exportActivityToCsv);
    window.addEventListener('storage', onRangeChange);
    onRangeChange({key: 'hr:range'});
  }

  async function loadTeams(){
    try {
      const resp = await fetch('./data/org/teams.json', {cache: 'no-store'});
      const data = await resp.json();
      state.teams = Array.isArray(data.depts) ? data.depts : [];
      state.teamMap = new Map(state.teams.map(d => [d.id, d.name]));
    } catch (e) {
      console.error('Failed to load teams', e);
      state.teams = [];
      state.teamMap = new Map();
    }
  }

  async function loadEvents(){
    try {
      const resp = await fetch('./data/org/events.json', {cache: 'no-store'});
      state.events = await resp.json();
    } catch (e) {
      console.error('Failed to load events', e);
      state.events = [];
    }
  }

  function buildFilterControls(){
    buildFilterGroup(els.teamFilter, state.teams.map(t => ({value: t.id, label: state.teamMap.get(t.id) || t.id})), state.filters.team, 'All teams');
    const severities = Array.from(new Set(state.events.map(ev => ev.severity)));
    buildFilterGroup(els.severityFilter, severities.map(v => ({value: v, label: capitalize(v)})), state.filters.severity, 'All severities');
    const types = Array.from(new Set(state.events.map(ev => ev.type)));
    buildFilterGroup(els.typeFilter, types.map(v => ({value: v, label: splitCamel(v)})), state.filters.type, 'All types');
  }

  function setupTabs(){
    els.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        const target = btn.dataset.tab;
        setActiveTab(target);
      });
    });
    setActiveTab(state.activeTab);
  }

  function setActiveTab(tab){
    state.activeTab = tab;
    els.tabButtons.forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    els.panels.forEach(panel => {
      const isActive = panel.id === `corp-${tab}`;
      panel.classList.toggle('is-active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
    if (tab === 'heatmap' && state.pendingHighlight) {
      highlightHeatmapColumn(state.pendingHighlight);
      state.pendingHighlight = null;
    }
  }

  function onRangeChange(evt){
    if (evt && evt.key && evt.key !== 'hr:range') return;
    const selection = getRangeSelection();
    state.rangeSelection = selection;
    state.rangePreset = normalizePreset(selection);
    loadMetricsForSelection(selection);
  }

  function getRangeSelection(){
    const stored = localStorage.getItem('hr:range');
    if (!stored) return {preset: '7d'};
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.preset) return parsed;
      if (parsed && parsed.start && parsed.end) return parsed;
    } catch (e) {
      console.warn('Invalid range selection, using default');
    }
    return {preset: '7d'};
  }

  function normalizePreset(selection){
    if (selection && selection.preset) {
      const preset = selection.preset;
      if (preset === 'day') return '7d';
      if (['7d', 'month', 'year'].includes(preset)) return preset;
    }
    if (selection && selection.start && selection.end) {
      return 'custom';
    }
    return '7d';
  }

  async function loadMetricsForSelection(selection){
    const path = metricsPathForSelection(selection);
    try {
      const resp = await fetch(path, {cache: 'no-store'});
      state.metrics = await resp.json();
    } catch (e) {
      console.error('Failed to load metrics', e);
      state.metrics = null;
      return;
    }
    updateRangeWindow();
    renderRangeCaption();
    renderKpis();
    renderHeatmap();
    renderActivity();
    renderEvents();
  }

  function metricsPathForSelection(selection){
    if (selection && selection.preset) {
      switch (selection.preset) {
        case 'day':
        case '7d':
          return './data/org/metrics_7d.json';
        case 'month':
          return './data/org/metrics_month.json';
        case 'year':
          return './data/org/metrics_year.json';
        default:
          return './data/org/metrics_month.json';
      }
    }
    return './data/org/metrics_month.json';
  }

  function updateRangeWindow(){
    if (!state.metrics || !state.metrics.heatmap) {
      state.rangeWindow = null;
      return;
    }
    const dates = Array.isArray(state.metrics.heatmap.colDates) ? state.metrics.heatmap.colDates : [];
    const parse = iso => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const firstDate = parse(dates[0]);
    const lastDate = parse(dates[dates.length - 1] || dates[0]);
    if (!firstDate || !lastDate) {
      state.rangeWindow = null;
      return;
    }
    const startIso = toIso(firstDate);
    let endDate = new Date(lastDate.getTime());
    if (state.rangePreset === 'year') {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    } else if (state.rangePreset === 'month' || state.rangePreset === 'custom') {
      endDate.setDate(endDate.getDate() + 6);
    }
    const endIso = toIso(endDate);
    state.rangeWindow = {start: startIso, end: endIso};
  }

  function renderRangeCaption(){
    if (!els.rangeCaption) return;
    if (!state.rangeWindow) {
      els.rangeCaption.textContent = '';
      return;
    }
    const {start, end} = state.rangeWindow;
    const startLabel = formatDateLabel(start);
    const endLabel = formatDateLabel(end);
    const presetLabel = rangePresetDescription();
    els.rangeCaption.textContent = `${presetLabel} · ${startLabel} – ${endLabel}`;
  }

  function rangePresetDescription(){
    switch (state.rangePreset) {
      case '7d':
        return 'Rolling 7-day aggregate';
      case 'month':
        return 'Rolling 4-week aggregate';
      case 'year':
        return 'Year-to-date monthly aggregate';
      default:
        return 'Custom aggregate';
    }
  }

  function renderKpis(){
    if (!els.kpis) return;
    els.kpis.innerHTML = '';
    if (!state.metrics || !state.metrics.kpi) return;
    const trend = state.metrics.kpi_trend || {};

    KPI_CONFIG.forEach(cfg => {
      const value = state.metrics.kpi[cfg.key];
      if (value == null) return;
      const card = document.createElement('article');
      card.className = 'kpi-card';
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${cfg.label} KPI`);

      const label = document.createElement('span');
      label.className = 'kpi-card__label';
      label.textContent = cfg.label;

      const val = document.createElement('div');
      val.className = 'kpi-card__value';
      const formatted = typeof cfg.format === 'function' ? cfg.format(value) : value;
      val.textContent = `${formatted}${cfg.suffix}`;
      val.setAttribute('aria-label', `${cfg.label} ${formatted}${cfg.suffix}`);

      const spark = document.createElement('div');
      spark.className = 'kpi-card__spark';
      const sparkValues = Array.isArray(trend[cfg.key]) ? trend[cfg.key] : [Number(value)];
      spark.innerHTML = createSparklineSvg(sparkValues);

      card.appendChild(label);
      card.appendChild(val);
      card.appendChild(spark);
      els.kpis.appendChild(card);
    });
  }

  function createSparklineSvg(values){
    const clean = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
    if (clean.length === 0) return '';
    const width = 100;
    const height = 30;
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const range = max - min || 1;
    const points = clean.map((v, idx) => {
      const x = (idx / (clean.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${areaPoints}" fill="rgba(94, 123, 255, 0.18)"></polygon><polyline points="${points}" fill="none" stroke="rgba(126, 169, 255, 0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
  }

  function renderHeatmap(){
    if (!els.heatmap) return;
    els.heatmap.innerHTML = '';
    clearHighlightTimer();
    state.heatmapCells = [];
    if (!state.metrics || !state.metrics.heatmap) return;
    const hm = state.metrics.heatmap;
    const rows = Array.isArray(hm.rows) ? hm.rows : [];
    const cols = Array.isArray(hm.cols) ? hm.cols : [];
    const colDates = Array.isArray(hm.colDates) ? hm.colDates : cols.map(() => null);
    els.heatmap.style.gridTemplateColumns = `repeat(${cols.length + 1}, minmax(72px, 1fr))`;

    // Header row
    const headerCorner = document.createElement('div');
    headerCorner.className = 'heatmap-cell heatmap-header';
    headerCorner.setAttribute('role', 'columnheader');
    headerCorner.textContent = '';
    els.heatmap.appendChild(headerCorner);

    cols.forEach((col, idx) => {
      const header = document.createElement('div');
      header.className = 'heatmap-cell heatmap-header';
      header.setAttribute('role', 'columnheader');
      const label = formatColumnLabel(colDates[idx] || col);
      header.textContent = label;
      header.title = label;
      els.heatmap.appendChild(header);
    });

    rows.forEach(rowId => {
      const rowLabel = document.createElement('div');
      rowLabel.className = 'heatmap-cell heatmap-header';
      rowLabel.setAttribute('role', 'rowheader');
      rowLabel.textContent = state.teamMap.get(rowId) || rowId;
      els.heatmap.appendChild(rowLabel);

      const values = Array.isArray(hm.value?.[rowId]) ? hm.value[rowId] : [];
      cols.forEach((col, idx) => {
        const val = values[idx];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'heatmap-cell';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.team = rowId;
        btn.dataset.column = col;
        const iso = colDates[idx] || '';
        if (iso) btn.dataset.iso = iso;
        if (typeof val === 'number') {
          btn.textContent = String(Math.round(val));
          btn.title = `${state.teamMap.get(rowId) || rowId} — ${formatDateLabel(iso || col)}: ${Math.round(val)}`;
          btn.dataset.level = getHeatmapLevel(val);
        } else {
          btn.textContent = '–';
        }
        els.heatmap.appendChild(btn);
        state.heatmapCells.push(btn);
      });
    });
  }

  function getHeatmapLevel(value){
    if (value <= 55) return 'low';
    if (value >= 70) return 'high';
    return 'mid';
  }

  function highlightHeatmapColumn(dateStr){
    if (!dateStr) return;
    clearHighlightTimer();
    let found = false;
    state.heatmapCells.forEach(cell => {
      if (cell.dataset.iso === dateStr) {
        cell.classList.add('is-highlighted');
        if (!found) {
          cell.focus({preventScroll: false});
          found = true;
        }
      } else {
        cell.classList.remove('is-highlighted');
      }
    });
    if (found) {
      state.highlightTimer = setTimeout(() => {
        state.heatmapCells.forEach(cell => cell.classList.remove('is-highlighted'));
        state.highlightTimer = null;
      }, 4000);
    }
  }

  function clearHighlightTimer(){
    if (state.highlightTimer) {
      clearTimeout(state.highlightTimer);
      state.highlightTimer = null;
    }
  }

  function renderEvents(){
    if (!els.events) return;
    els.events.innerHTML = '';
    if (!Array.isArray(state.events) || state.events.length === 0 || !state.rangeWindow) {
      const empty = document.createElement('p');
      empty.textContent = 'No detection events in this range.';
      els.events.appendChild(empty);
      return;
    }
    const start = state.rangeWindow.start ? new Date(state.rangeWindow.start) : null;
    const end = state.rangeWindow.end ? new Date(state.rangeWindow.end) : null;
    const filtered = state.events.filter(ev => {
      const ts = new Date(ev.ts);
      if (start && ts < start) return false;
      if (end) {
        const endPlus = new Date(end);
        endPlus.setHours(23, 59, 59, 999);
        if (ts > endPlus) return false;
      }
      if (state.filters.team.size && !state.filters.team.has(ev.team)) return false;
      if (state.filters.severity.size && !state.filters.severity.has(ev.severity)) return false;
      if (state.filters.type.size && !state.filters.type.has(ev.type)) return false;
      return true;
    }).sort((a, b) => new Date(b.ts) - new Date(a.ts));

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Filters returned no events.';
      els.events.appendChild(empty);
      return;
    }

    const grouped = new Map();
    filtered.forEach(ev => {
      const dayKey = formatDateLabel(ev.ts.split('T')[0]);
      if (!grouped.has(dayKey)) grouped.set(dayKey, []);
      grouped.get(dayKey).push(ev);
    });

    grouped.forEach((events, dayLabel) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'timeline-day';

      const heading = document.createElement('h3');
      heading.className = 'timeline-day__header';
      heading.textContent = dayLabel;
      wrapper.appendChild(heading);

      events.forEach(ev => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'timeline-event';
        btn.dataset.severity = ev.severity;
        btn.dataset.team = ev.team;
        if (ev.heatmapDate) btn.dataset.iso = ev.heatmapDate;
        btn.title = ev.detail || ev.rule || '';

        const title = document.createElement('div');
        title.className = 'timeline-event__title';
        const teamName = state.teamMap.get(ev.team) || ev.team;
        title.textContent = `${splitCamel(ev.type)} · ${teamName}`;

        const meta = document.createElement('div');
        meta.className = 'timeline-event__meta';
        const severity = document.createElement('span');
        severity.textContent = capitalize(ev.severity);
        const time = document.createElement('span');
        time.textContent = formatTime(ev.ts);
        meta.appendChild(severity);
        meta.appendChild(time);

        const rule = document.createElement('div');
        rule.className = 'timeline-event__rule';
        rule.textContent = ev.rule || ev.detail || '';

        btn.appendChild(title);
        btn.appendChild(meta);
        btn.appendChild(rule);

        btn.addEventListener('click', () => {
          if (state.activeTab === 'heatmap') {
            highlightHeatmapColumn(ev.heatmapDate || (ev.ts ? ev.ts.split('T')[0] : ''));
          } else {
            state.pendingHighlight = ev.heatmapDate || (ev.ts ? ev.ts.split('T')[0] : '');
          }
        });

        wrapper.appendChild(btn);
      });

      els.events.appendChild(wrapper);
    });
  }

  function buildFilterGroup(container, options, setRef, allLabel){
    if (!container) return;
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'filter-chip is-active';
    allBtn.dataset.value = '__all';
    allBtn.textContent = allLabel;
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.addEventListener('click', () => {
      setRef.clear();
      updateFilterVisuals(container, setRef);
      renderEvents();
    });
    container.appendChild(allBtn);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-chip';
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        if (setRef.has(opt.value)) {
          setRef.delete(opt.value);
        } else {
          setRef.add(opt.value);
        }
        updateFilterVisuals(container, setRef);
        renderEvents();
      });
      container.appendChild(btn);
    });
  }

  function updateFilterVisuals(container, setRef){
    const chips = Array.from(container.querySelectorAll('.filter-chip'));
    chips.forEach(chip => {
      const val = chip.dataset.value;
      if (val === '__all') {
        const isActive = setRef.size === 0;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', String(isActive));
      } else {
        const isActive = setRef.has(val);
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', String(isActive));
      }
    });
  }

  function renderActivity(){
    if (!els.activity) return;
    els.activity.innerHTML = '';
    if (!state.metrics || !Array.isArray(state.metrics.activity)) return;
    const granularity = activityGranularity();
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const columns = [
      {key: 'date', label: 'Date'},
      {key: 'team', label: 'Team'},
      {key: 'hydration_logs', label: 'Hydration logs'},
      {key: 'caffeine_logs', label: 'Caffeine logs'},
      {key: 'meds_logs', label: 'Meds logs'},
      {key: 'steps_active_pct', label: 'Steps active %'}
    ];

    columns.forEach(col => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = col.label;
      th.dataset.key = col.key;
      th.tabIndex = 0;
      if (state.activitySort.key === col.key) {
        th.classList.add(state.activitySort.direction === 'asc' ? 'is-sorted-asc' : 'is-sorted-desc');
      }
      const onSort = () => {
        toggleSort(col.key);
        renderActivity();
      };
      th.addEventListener('click', onSort);
      th.addEventListener('keypress', evt => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSort();
        }
      });
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    const sortedRows = [...state.metrics.activity].sort((a, b) => compareActivityRows(a, b));
    sortedRows.forEach(row => {
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        let value = row[col.key];
        if (col.key === 'team') {
          value = state.teamMap.get(row.team) || row.team;
        } else if (col.key === 'date') {
          value = formatActivityDate(row.date, granularity);
        } else if (col.key === 'steps_active_pct') {
          value = `${Math.round(row.steps_active_pct)}%`;
        }
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    els.activity.appendChild(table);
  }

  function activityGranularity(){
    switch (state.rangePreset) {
      case '7d':
        return 'day';
      case 'year':
        return 'month';
      default:
        return 'week';
    }
  }

  function toggleSort(key){
    if (state.activitySort.key === key) {
      state.activitySort.direction = state.activitySort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      state.activitySort.key = key;
      state.activitySort.direction = key === 'date' ? 'desc' : 'asc';
    }
  }

  function compareActivityRows(a, b){
    const {key, direction} = state.activitySort;
    const order = direction === 'asc' ? 1 : -1;
    if (key === 'date') {
      return (new Date(a.date) - new Date(b.date)) * order;
    }
    if (key === 'team') {
      const nameA = state.teamMap.get(a.team) || a.team;
      const nameB = state.teamMap.get(b.team) || b.team;
      return nameA.localeCompare(nameB) * order;
    }
    const valA = Number(a[key]) || 0;
    const valB = Number(b[key]) || 0;
    if (valA === valB) return 0;
    return valA > valB ? order : -order;
  }

  function exportActivityToCsv(){
    if (!state.metrics || !Array.isArray(state.metrics.activity) || state.metrics.activity.length === 0) return;
    const granularity = activityGranularity();
    const headers = ['Date', 'Team', 'Hydration logs', 'Caffeine logs', 'Meds logs', 'Steps active %'];
    const rows = state.metrics.activity.map(entry => [
      formatActivityDate(entry.date, granularity),
      state.teamMap.get(entry.team) || entry.team,
      entry.hydration_logs,
      entry.caffeine_logs,
      entry.meds_logs,
      Math.round(entry.steps_active_pct)
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate-activity-${state.rangePreset}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatDateLabel(iso){
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
  }

  function formatColumnLabel(iso){
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const options = state.rangePreset === 'year'
      ? {month: 'short', year: '2-digit'}
      : {month: 'short', day: 'numeric'};
    return date.toLocaleDateString(undefined, options);
  }

  function formatActivityDate(iso, granularity){
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    if (granularity === 'week') {
      return `Week of ${date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}`;
    }
    if (granularity === 'month') {
      return date.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
    }
    return date.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'});
  }

  function formatTime(ts){
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
  }

  function capitalize(str){
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function splitCamel(str){
    if (!str) return '';
    return str.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  function toIso(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
})();
