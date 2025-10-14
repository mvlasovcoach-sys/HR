document.addEventListener('DOMContentLoaded', () => {
  if (window.I18N?.onReady) {
    window.I18N.onReady(initCorporatePage);
  } else {
    initCorporatePage();
  }
});

function initCorporatePage(){
  const DATA_ROOT = './data/org';

  const els = {
    caption: document.getElementById('corp-caption'),
    kpiPanel: document.getElementById('corp-kpis'),
    kpiGrid: document.getElementById('corp-kpi-grid'),
    heatmapPanel: document.getElementById('corp-heatmap'),
    heatmapGrid: document.getElementById('heatmap-grid'),
    eventsPanel: document.getElementById('corp-events'),
    eventsList: document.getElementById('events-list'),
    eventTeam: document.getElementById('f-team'),
    eventSeverity: document.getElementById('f-sev'),
    eventType: document.getElementById('f-type'),
    activityPanel: document.getElementById('corp-activity'),
    activityTable: document.getElementById('activity-table'),
    exportBtn: document.getElementById('export-activity')
  };

  if (!els.kpiGrid || !els.heatmapGrid || !els.eventsList || !els.activityTable) {
    return;
  }

  const state = {
    teams: [],
    teamMap: new Map(),
    teamSelection: readTeamSelection(),
    rangeSelection: readRangeSelection(),
    rangeKey: null,
    rangeLabel: '',
    dataRangeKey: '7d',
    rangeWindow: null,
    metrics: null,
    events: [],
    eventFilterTeams: new Set(),
    eventFilterSeverity: '',
    eventFilterType: '',
    eventsDateFilter: null,
    heatmapCells: [],
    heatmapColumns: [],
    heatmapDates: [],
    selectedColumn: null,
    activityCsvRows: [],
    insufficient: false
  };

  boot().catch(err => console.error('Corporate init failed', err));

  async function boot(){
    await loadTeams();
    setupEventFilters();
    await loadEvents();
    await loadMetrics();
    bindEvents();
    updateCaption();
    renderAll();
  }

  function bindEvents(){
    els.eventTeam?.addEventListener('change', () => {
      const selected = Array.from(els.eventTeam.selectedOptions || []).map(opt => opt.value).filter(Boolean);
      state.eventFilterTeams = new Set(selected);
      renderEvents();
    });

    els.eventSeverity?.addEventListener('change', () => {
      state.eventFilterSeverity = els.eventSeverity.value || '';
      renderEvents();
    });

    els.eventType?.addEventListener('change', () => {
      state.eventFilterType = els.eventType.value || '';
      renderEvents();
    });

    els.exportBtn?.addEventListener('click', exportActivity);

    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('i18n:change', handleI18nChange);
  }

  async function loadTeams(){
    try {
      const data = await fetchJson(`${DATA_ROOT}/teams.json`);
      const list = Array.isArray(data?.depts) ? data.depts : [];
      state.teams = list;
      state.teamMap = new Map(list.map(item => [item.id, item.name || item.id]));
    } catch (err) {
      console.error('Teams load failed', err);
      state.teams = [];
      state.teamMap = new Map();
    }
  }

  function setupEventFilters(){
    if (els.eventTeam) {
      els.eventTeam.innerHTML = '';
      els.eventTeam.setAttribute('aria-label', 'Filter events by team');
      state.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name || team.id;
        if (state.teamSelection !== 'all' && team.id === state.teamSelection) {
          option.selected = true;
        }
        els.eventTeam.appendChild(option);
      });
      if (state.teamSelection !== 'all') {
        state.eventFilterTeams = new Set([state.teamSelection]);
      }
    }
    if (els.eventSeverity) {
      els.eventSeverity.value = '';
    }
    if (els.eventType) {
      els.eventType.innerHTML = '<option value="">All types</option>';
    }
  }

  async function loadEvents(){
    try {
      const data = await fetchJson(`${DATA_ROOT}/events.json`);
      state.events = Array.isArray(data) ? data.map(event => ({...event})) : [];
    } catch (err) {
      console.error('Events load failed', err);
      state.events = [];
    }
  }

  async function loadMetrics(){
    state.rangeSelection = readRangeSelection();
    const {dataKey, label, rangeKey} = resolveRangeConfig(state.rangeSelection);
    state.dataRangeKey = dataKey;
    state.rangeLabel = label;
    state.rangeKey = rangeKey;
    try {
      const metrics = await fetchJson(`${DATA_ROOT}/metrics_${dataKey}.json`);
      state.metrics = metrics;
      const nVal = Number(metrics?.n);
      state.insufficient = Number.isFinite(nVal) && nVal < 5;
      const heatmap = metrics?.heatmap || {};
      state.heatmapColumns = Array.isArray(heatmap.cols) ? heatmap.cols : [];
      state.heatmapDates = Array.isArray(heatmap.dates) ? heatmap.dates : [];
      if (state.selectedColumn && state.selectedColumn.index >= state.heatmapColumns.length) {
        state.selectedColumn = null;
        state.eventsDateFilter = null;
      }
      state.rangeWindow = resolveRangeWindow(metrics);
      mapEventsToColumns();
      buildEventTypeOptions();
    } catch (err) {
      console.error('Metrics load failed', err);
      state.metrics = null;
      state.insufficient = false;
      state.heatmapColumns = [];
      state.heatmapDates = [];
      state.rangeWindow = null;
      state.activityCsvRows = [];
      state.selectedColumn = null;
      state.eventsDateFilter = null;
    }
  }

  function resolveRangeWindow(metrics){
    const heatmapDates = Array.isArray(metrics?.heatmap?.dates) ? metrics.heatmap.dates : [];
    if (heatmapDates.length) {
      return {start: heatmapDates[0], end: heatmapDates[heatmapDates.length - 1]};
    }
    const activity = Array.isArray(metrics?.activity) ? metrics.activity : [];
    if (!activity.length) return null;
    const sorted = activity.map(row => row?.date).filter(Boolean).sort();
    if (!sorted.length) return null;
    return {start: sorted[0], end: sorted[sorted.length - 1]};
  }

  function mapEventsToColumns(){
    const columns = state.heatmapColumns;
    const dates = state.heatmapDates;
    state.events.forEach(evt => {
      const eventDate = toDateString(evt.ts);
      let colIndex = -1;
      if (eventDate && dates.length) {
        colIndex = dates.indexOf(eventDate);
      }
      if (colIndex < 0 && typeof evt.col === 'number' && evt.col >= 0 && evt.col < columns.length) {
        colIndex = evt.col;
      }
      evt._colIndex = colIndex >= 0 ? colIndex : null;
      evt._colLabel = colIndex >= 0 ? columns[colIndex] : null;
      evt._colDate = colIndex >= 0 ? (dates[colIndex] || null) : eventDate;
    });
  }

  function buildEventTypeOptions(){
    if (!els.eventType) return;
    const types = new Set();
    state.events.forEach(evt => {
      if (evt?.type) types.add(evt.type);
    });
    const current = els.eventType.value || '';
    els.eventType.innerHTML = '<option value="">All types</option>';
    Array.from(types).sort().forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (type === current) option.selected = true;
      els.eventType.appendChild(option);
    });
    state.eventFilterType = els.eventType.value || '';
  }

  function renderAll(){
    toggleInsufficientOverlays();
    try { renderKpis(state.metrics?.kpi, state.metrics?.delta); } catch (err) { console.error('KPI', err); }
    try { renderHeatmap(state.metrics?.heatmap); } catch (err) { console.error('Heatmap', err); }
    try { renderEvents(state.events); } catch (err) { console.error('Events', err); }
    try { renderActivity(state.metrics?.activity); } catch (err) { console.error('Activity', err); }
    updateCaption();
  }

  function toggleInsufficientOverlays(){
    const panels = [els.kpiPanel, els.heatmapPanel, els.eventsPanel, els.activityPanel];
    panels.forEach(panel => {
      if (!panel) return;
      if (state.insufficient) {
        panel.setAttribute('data-insufficient', 'true');
      } else {
        panel.removeAttribute('data-insufficient');
      }
    });
  }

  function renderHeatmap(heatmap){
    const grid = els.heatmapGrid;
    if (!grid) return;
    if (!heatmap || !Array.isArray(heatmap.rows) || !Array.isArray(heatmap.cols)) {
      grid.innerHTML = '<p class="caption">No heatmap data</p>';
      state.heatmapCells = [];
      return;
    }

    const rows = heatmap.rows;
    const cols = heatmap.cols;
    const values = heatmap.value || {};
    const dates = Array.isArray(heatmap.dates) ? heatmap.dates : [];
    state.heatmapColumns = cols;
    state.heatmapDates = dates;

    const totalCols = cols.length + 1;
    grid.style.setProperty('--heatmap-cols', totalCols);
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Wellbeing heatmap');
    const fragment = document.createDocumentFragment();

    const blank = document.createElement('div');
    blank.className = 'heatmap-cell';
    blank.setAttribute('role', 'columnheader');
    blank.textContent = '';
    fragment.appendChild(blank);

    cols.forEach((label, index) => {
      const header = document.createElement('div');
      header.className = 'heatmap-cell';
      header.setAttribute('role', 'columnheader');
      header.dataset.colIndex = String(index);
      header.dataset.colLabel = label;
      if (dates[index]) header.dataset.date = dates[index];
      header.textContent = label;
      fragment.appendChild(header);
    });

    rows.forEach(rowId => {
      const rowHeader = document.createElement('div');
      rowHeader.className = 'heatmap-cell';
      rowHeader.setAttribute('role', 'rowheader');
      rowHeader.textContent = state.teamMap.get(rowId) || rowId;
      fragment.appendChild(rowHeader);

      const rowValues = Array.isArray(values?.[rowId]) ? values[rowId] : [];
      cols.forEach((label, colIndex) => {
        const raw = rowValues[colIndex];
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.setAttribute('role', 'gridcell');
        cell.tabIndex = 0;
        cell.dataset.colIndex = String(colIndex);
        cell.dataset.colLabel = label;
        if (dates[colIndex]) cell.dataset.date = dates[colIndex];
        cell.dataset.rowId = rowId;
        if (Number.isFinite(raw)) {
          const rounded = Math.round(raw);
          cell.textContent = String(rounded);
          cell.dataset.value = String(raw);
          const level = heatmapLevel(rounded);
          cell.dataset.level = level;
          cell.setAttribute('aria-label', `${state.teamMap.get(rowId) || rowId} • ${label} • ${rounded}`);
        } else {
          cell.textContent = '—';
          cell.setAttribute('aria-label', `${state.teamMap.get(rowId) || rowId} • ${label} • no data`);
        }
        cell.addEventListener('click', () => {
          handleHeatmapSelection(colIndex);
        });
        cell.addEventListener('keydown', evt => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            handleHeatmapSelection(colIndex);
          }
        });
        fragment.appendChild(cell);
      });
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
    state.heatmapCells = Array.from(grid.querySelectorAll('.heatmap-cell[role="gridcell"]'));
    if (state.selectedColumn?.index != null) {
      updateHeatmapHighlight(state.selectedColumn.index);
    }
  }

  function heatmapLevel(value){
    if (!Number.isFinite(value)) return '';
    if (value <= 55) return 'low';
    if (value <= 69) return 'mid';
    return 'high';
  }

  function handleHeatmapSelection(index){
    const same = state.selectedColumn && state.selectedColumn.index === index;
    if (same) {
      setSelectedColumn(null, {updateFilter: true});
    } else {
      setSelectedColumn(index, {updateFilter: true});
      scrollIntoView('corp-events');
    }
  }

  function setSelectedColumn(index, options={}){
    const {updateFilter = true} = options;
    if (index == null || index < 0 || index >= state.heatmapColumns.length) {
      state.selectedColumn = null;
      updateHeatmapHighlight(null);
      if (updateFilter) {
        state.eventsDateFilter = null;
        renderEvents();
      }
      return;
    }
    state.selectedColumn = {
      index,
      label: state.heatmapColumns[index],
      date: state.heatmapDates[index] || null
    };
    updateHeatmapHighlight(index);
    if (updateFilter) {
      state.eventsDateFilter = {label: state.selectedColumn.label, date: state.selectedColumn.date};
      renderEvents();
    }
  }

  function updateHeatmapHighlight(index){
    state.heatmapCells.forEach(cell => {
      const col = Number(cell.dataset.colIndex);
      cell.classList.toggle('is-highlighted', index != null && col === index);
    });
    const headers = els.heatmapGrid?.querySelectorAll('.heatmap-cell[role="columnheader"]');
    headers?.forEach(header => {
      const col = Number(header.dataset.colIndex);
      header?.classList.toggle('is-highlighted', index != null && col === index);
    });
  }

  function renderEvents(events){
    const list = els.eventsList;
    if (!list) return;
    const items = Array.isArray(events) ? events.slice() : [];

    const filtered = items.filter(evt => {
      const eventDate = toDateString(evt.ts);
      if (state.rangeWindow) {
        if (state.rangeWindow.start && eventDate && eventDate < state.rangeWindow.start) return false;
        if (state.rangeWindow.end && eventDate && eventDate > state.rangeWindow.end) return false;
      }
      if (state.teamSelection !== 'all' && evt.team && evt.team !== state.teamSelection) {
        return false;
      }
      if (state.eventFilterTeams.size && evt.team && !state.eventFilterTeams.has(evt.team)) {
        return false;
      }
      if (state.eventFilterSeverity && evt.severity && evt.severity !== state.eventFilterSeverity) {
        return false;
      }
      if (state.eventFilterType && evt.type && evt.type !== state.eventFilterType) {
        return false;
      }
      if (state.eventsDateFilter) {
        if (state.eventsDateFilter.date) {
          if (!evt._colDate || evt._colDate !== state.eventsDateFilter.date) return false;
        } else if (state.eventsDateFilter.label) {
          if (!evt._colLabel || evt._colLabel !== state.eventsDateFilter.label) return false;
        }
      }
      return true;
    });

    list.innerHTML = '';

    if (state.eventsDateFilter) {
      const note = document.createElement('div');
      note.className = 'event-filter-note';
      const label = state.eventsDateFilter.label || formatDateLabel(state.eventsDateFilter.date);
      note.textContent = `Filtered by ${label}`;
      list.appendChild(note);
    }

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'caption';
      empty.textContent = 'No events in range';
      list.appendChild(empty);
      return;
    }

    filtered.sort((a, b) => {
      const da = a.ts ? new Date(a.ts).getTime() : 0;
      const db = b.ts ? new Date(b.ts).getTime() : 0;
      return db - da;
    });

    filtered.forEach(evt => {
      const item = document.createElement('div');
      item.className = 'event-item';
      item.tabIndex = 0;
      if (Number.isInteger(evt._colIndex)) {
        item.dataset.colIndex = String(evt._colIndex);
      }
      const timestamp = document.createElement('time');
      timestamp.dateTime = evt.ts || '';
      timestamp.textContent = formatDateTime(evt.ts);

      const body = document.createElement('div');
      const header = document.createElement('div');
      header.className = 'event-header';
      const severity = document.createElement('span');
      severity.className = severityClass(evt.severity);
      severity.textContent = (evt.severity || 'info').toUpperCase();

      const title = document.createElement('strong');
      title.textContent = evt.type || 'Event';
      header.appendChild(title);
      header.appendChild(severity);

      const detail = document.createElement('p');
      detail.className = 'event-detail';
      detail.textContent = evt.detail || '';

      const meta = document.createElement('div');
      meta.className = 'event-meta';
      const team = state.teamMap.get(evt.team) || evt.team;
      if (team) {
        const chip = document.createElement('span');
        chip.className = 'event-pill';
        chip.textContent = team;
        meta.appendChild(chip);
      }
      if (evt._colLabel) {
        const chip = document.createElement('span');
        chip.className = 'event-pill';
        chip.textContent = evt._colLabel;
        meta.appendChild(chip);
      }

      body.appendChild(header);
      body.appendChild(detail);
      body.appendChild(meta);

      item.appendChild(timestamp);
      item.appendChild(body);

      item.addEventListener('click', () => handleEventSelection(evt));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEventSelection(evt);
        }
      });

      list.appendChild(item);
    });
  }

  function severityClass(severity){
    switch (severity) {
      case 'critical':
        return 'event-pill event-pill--critical';
      case 'warning':
        return 'event-pill event-pill--warning';
      default:
        return 'event-pill event-pill--info';
    }
  }

  function handleEventSelection(evt){
    if (!Number.isInteger(evt?._colIndex)) return;
    setSelectedColumn(evt._colIndex, {updateFilter: false});
    scrollIntoView('corp-heatmap');
  }

  function renderActivity(activity){
    const table = els.activityTable;
    if (!table) return;
    const rows = Array.isArray(activity) ? activity : [];
    const filtered = rows.filter(row => {
      if (!row) return false;
      if (state.teamSelection !== 'all' && row.team && row.team !== state.teamSelection) return false;
      return true;
    });

    const headers = ['Date', 'Team', 'Hydration Logs', 'Caffeine Logs', 'Medications Logged', 'Active Steps %'];
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    let tbody = '';
    let csvRows = [];

    if (state.insufficient) {
      tbody = `<tbody><tr><td colspan="${headers.length}">—</td></tr></tbody>`;
    } else if (!filtered.length) {
      tbody = `<tbody><tr><td colspan="${headers.length}">No activity data</td></tr></tbody>`;
    } else {
      const lang = window.I18N?.getLang?.() || 'en';
      const dateFormatter = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit', year: 'numeric'});
      const bodyRows = filtered.map(row => {
        const dateLabel = formatDateLabel(row.date, {formatter: dateFormatter});
        const team = state.teamMap.get(row.team) || row.team || '—';
        const hydration = numericOrDash(row.hydration);
        const caffeine = numericOrDash(row.caffeine);
        const meds = numericOrDash(row.meds);
        const steps = numericOrDash(row.steps_active_pct);
        if (hydration !== '—' && caffeine !== '—' && meds !== '—' && steps !== '—') {
          csvRows.push([row.date, team, hydration, caffeine, meds, steps]);
        }
        return `<tr><td>${dateLabel}</td><td>${team}</td><td>${hydration}</td><td>${caffeine}</td><td>${meds}</td><td>${steps}</td></tr>`;
      });
      tbody = `<tbody>${bodyRows.join('')}</tbody>`;
    }

    table.innerHTML = `${thead}${tbody}`;
    state.activityCsvRows = state.insufficient ? [] : csvRows;
    if (els.exportBtn) {
      els.exportBtn.disabled = !state.activityCsvRows.length;
    }
  }

  function numericOrDash(value){
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return String(Math.round(num));
  }

  function exportActivity(){
    if (!state.activityCsvRows.length) return;
    const headers = ['Date', 'Team', 'Hydration Logs', 'Caffeine Logs', 'Medications Logged', 'Active Steps %'];
    const lines = [headers.join(',')].concat(state.activityCsvRows.map(row => row.map(csvEscape).join(',')));
    const csv = lines.join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const team = state.teamSelection === 'all' ? 'all' : state.teamSelection;
    const range = state.rangeKey || '7d';
    const stamp = formatFileDate(new Date());
    const filename = `activity_${team}_${range}_${stamp}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvEscape(value){
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function updateCaption(){
    if (!els.caption) return;
    const teamLabel = state.teamSelection === 'all'
      ? (window.I18N?.t('label.team.all') || 'All Teams')
      : (state.teamMap.get(state.teamSelection) || state.teamSelection);
    const rangeLabel = state.rangeLabel || 'Range';
    els.caption.textContent = `Org avg · ${rangeLabel} · ${teamLabel}`;
  }

  function handleStorageEvent(evt){
    if (!evt) return;
    if (evt.key === 'hr:team') {
      state.teamSelection = readTeamSelection();
      if (state.teamSelection !== 'all') {
        state.eventFilterTeams = new Set([state.teamSelection]);
      } else {
        state.eventFilterTeams = new Set();
      }
      syncEventTeamSelection();
      renderEvents();
      renderActivity(state.metrics?.activity);
      updateCaption();
    }
    if (evt.key === 'hr:range') {
      loadMetrics().then(() => {
        renderAll();
      });
    }
  }

  function syncEventTeamSelection(){
    if (!els.eventTeam) return;
    const values = state.eventFilterTeams.size ? Array.from(state.eventFilterTeams) : [];
    Array.from(els.eventTeam.options || []).forEach(option => {
      option.selected = values.includes(option.value);
    });
  }

  function handleI18nChange(){
    state.rangeLabel = resolveRangeConfig(state.rangeSelection).label;
    renderAll();
  }

  function readTeamSelection(){
    try {
      return localStorage.getItem('hr:team') || 'all';
    } catch (err) {
      return 'all';
    }
  }

  function readRangeSelection(){
    try {
      const raw = localStorage.getItem('hr:range');
      if (!raw) return {preset: '7d'};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      // ignore malformed
    }
    return {preset: '7d'};
  }

  function resolveRangeConfig(selection){
    const lang = window.I18N?.getLang?.() || 'en';
    const presets = {
      day: window.I18N?.t('range.day') || '1 Day',
      '7d': window.I18N?.t('range.7d') || '7 Days',
      month: window.I18N?.t('range.month') || '1 Month',
      year: window.I18N?.t('range.year') || '1 Year'
    };
    if (selection?.preset) {
      const preset = selection.preset;
      if (preset === 'day') {
        return {dataKey: '7d', label: presets.day, rangeKey: 'day'};
      }
      if (preset === '7d' || preset === 'month' || preset === 'year') {
        return {dataKey: preset, label: presets[preset], rangeKey: preset};
      }
    }
    if (selection?.start && selection?.end) {
      const startLabel = formatDateLabel(selection.start, {lang});
      const endLabel = formatDateLabel(selection.end, {lang});
      return {
        dataKey: 'month',
        label: `${startLabel} → ${endLabel}`,
        rangeKey: 'custom'
      };
    }
    return {dataKey: '7d', label: presets['7d'], rangeKey: '7d'};
  }

  function formatDateLabel(dateStr, options={}){
    if (!dateStr) return '';
    try {
      const lang = options.lang || window.I18N?.getLang?.() || 'en';
      const formatter = options.formatter || new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit', year: 'numeric'});
      const date = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(date.getTime())) return dateStr;
      return formatter.format(date);
    } catch (err) {
      return dateStr;
    }
  }

  function formatDateTime(iso){
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const lang = window.I18N?.getLang?.() || 'en';
    const datePart = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'}).format(date);
    const timePart = new Intl.DateTimeFormat(lang, {hour: '2-digit', minute: '2-digit'}).format(date);
    return `${datePart} · ${timePart}`;
  }

  function toDateString(iso){
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function scrollIntoView(id){
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  function formatFileDate(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '00000000';
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  async function fetchJson(path){
    const version = window.APP_VERSION || '';
    const url = new URL(path, document.baseURI);
    if (version) {
      url.searchParams.set('v', version);
    }
    const response = await fetch(url.toString(), {cache: 'no-store'});
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }
    return await response.json();
  }
}

function renderKpis(kpi, delta={}){
  const grid=document.getElementById('corp-kpi-grid');
  if(!grid) return;
  const defs=[
    {key:'wellbeing_avg',label:()=>window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',unit:'/100',fmt:v=>Math.round(v)},
    {key:'high_stress_pct',label:()=>window.I18N?.t('metric.highStress') || 'High Stress',unit:'%',fmt:v=>Math.round(v)},
    {key:'fatigue_elevated_pct',label:()=>window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue',unit:'%',fmt:v=>Math.round(v)},
    {key:'engagement_active_pct',label:()=>window.I18N?.t('metric.activeEngagement') || 'Active Engagement',unit:'%',fmt:v=>Math.round(v)},
  ];
  grid.innerHTML = defs.map(d=>{
    const raw = Number(kpi?.[d.key]);
    const val = Number.isFinite(raw)?d.fmt(raw):'—';
    const dRaw = Number(delta?.[d.key]);
    const dl = Number.isFinite(dRaw)?dRaw:null;
    const badge = dl!==null ? `<span class="pill ${dl>=0?'green':'red'}">${dl>=0?'▲':'▼'} ${Math.abs(Math.round(dl))}</span>` : '';
    return `<div class="tile kpi">
      <div class="tile__head">${d.label()}${badge}</div>
      <div class="tile__kpi">${val}<small>${d.unit}</small></div>
      <div class="spark"></div>
    </div>`;
  }).join('');
}
