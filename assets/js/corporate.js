
(function(){
  const page = document.querySelector('.main--corporate');
  if (!page) return;

  const DATA_ROOT = './data/org';
  const SCENARIO_ID = 'night_shift';
  const SCENARIO_ROOT = `./data/scenario/${SCENARIO_ID}`;

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
    typeFilter: document.getElementById('event-type-filter'),
    scenarioBtn: document.getElementById('scenario-trigger'),
    drawerOverlay: document.getElementById('event-drawer-overlay'),
    drawer: document.getElementById('event-drawer'),
    drawerClose: document.getElementById('event-drawer-close'),
    drawerSeverity: document.getElementById('event-drawer-severity'),
    drawerTeam: document.getElementById('event-drawer-team'),
    drawerTimestamp: document.getElementById('event-drawer-ts'),
    drawerDetail: document.getElementById('event-drawer-detail'),
    drawerRule: document.getElementById('event-drawer-rule'),
    drawerThresholds: document.getElementById('event-drawer-thresholds'),
    drawerHeatmapBtn: document.getElementById('drawer-link-heatmap'),
    drawerActivityBtn: document.getElementById('drawer-link-activity')
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
    activitySort: {key: 'date', direction: 'desc'},
    scenario: null,
    activeTeam: 'all',
    drawerOpen: false,
    selectedEvent: null,
    lastFocus: null
  };

  const KPI_CONFIG = [
    {key: 'wellbeing_avg', label: 'Org Wellbeing', unitLabel: '/100', suffix: '', description: 'Rolling average', format: v => Math.round(v)},
    {key: 'high_stress_pct', label: 'High Stress', unitLabel: '% of staff', suffix: '%', description: 'Stress ≥70', format: v => Math.round(v)},
    {key: 'fatigue_elevated_pct', label: 'Elevated Fatigue', unitLabel: '% of staff', suffix: '%', description: 'Fatigue ≥60', format: v => Math.round(v)},
    {key: 'engagement_active_pct', label: 'Active Engagement', unitLabel: '% of staff', suffix: '%', description: '≥1 daily log action', format: v => Math.round(v)}
  ];

  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  async function loadJson(path) {
    return await window.dataLoader.fetch(path, {range: state.rangeSelection, team: state.activeTeam});
  }

  function updateScenarioButton(){
    if (!els.scenarioBtn) return;
    const key = state.scenario ? 'btn.liveView' : 'btn.loadScenario';
    const label = typeof window.t === 'function' ? window.t(key) : (state.scenario ? 'Return to Live View' : 'Load Night-Shift Scenario');
    els.scenarioBtn.textContent = label;
  }

  function restoreScenarioFromStorage(){
    try {
      const stored = localStorage.getItem('hr:scenario');
      if (stored === SCENARIO_ID) {
        state.scenario = SCENARIO_ID;
      }
    } catch (e) {
      state.scenario = null;
    }
    updateScenarioButton();
  }

  function setupScenarioButton(){
    if (!els.scenarioBtn) return;
    els.scenarioBtn.addEventListener('click', async () => {
      state.scenario = state.scenario ? null : SCENARIO_ID;
      if (state.scenario) {
        localStorage.setItem('hr:scenario', state.scenario);
      } else {
        localStorage.removeItem('hr:scenario');
      }
      updateScenarioButton();
      closeDrawer();
      state.filters.team.clear();
      state.filters.severity.clear();
      state.filters.type.clear();
      await loadEvents();
      buildFilterControls();
      await loadMetricsForSelection(state.rangeSelection);
    });
  }

  function severityPillClass(severity){
    switch (severity) {
      case 'critical':
        return 'pill pill--critical';
      case 'warning':
        return 'pill pill--caution';
      default:
        return 'pill pill--neutral';
    }
  }

  init();

  async function init(){
    restoreScenarioFromStorage();
    state.activeTeam = readTeamSelection();
    await loadTeams();
    await loadEvents();
    buildFilterControls();
    setupScenarioButton();
    setupTabs();
    setupDrawer();
    els.exportBtn?.addEventListener('click', exportActivityToCsv);
    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('i18n:change', handleI18nChange);
    onRangeChange();
  }

  async function loadTeams(){
    try {
      const data = await loadJson(`${DATA_ROOT}/teams.json`);
      state.teams = Array.isArray(data.depts) ? data.depts : [];
      state.teamMap = new Map(state.teams.map(d => [d.id, d.name]));
    } catch (e) {
      console.error('Failed to load teams', e);
      state.teams = [];
      state.teamMap = new Map();
    }
  }

  async function loadEvents(){
    const path = state.scenario ? `${SCENARIO_ROOT}/events.json` : `${DATA_ROOT}/events.json`;
    try {
      const data = await loadJson(path);
      state.events = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
    } catch (e) {
      console.error('Failed to load events', e);
      state.events = [];
    }
  }

  function buildFilterControls(){
    buildFilterGroup(
      els.teamFilter,
      state.teams.map(t => ({value: t.id, label: state.teamMap.get(t.id) || t.id})),
      state.filters.team,
      typeof window.t === 'function' ? window.t('events.filter.teamAll') : 'All teams'
    );
    const severities = Array.from(new Set(state.events.map(ev => ev.severity)));
    buildFilterGroup(
      els.severityFilter,
      severities.map(v => ({value: v, label: capitalize(v)})),
      state.filters.severity,
      typeof window.t === 'function' ? window.t('events.filter.severityAll') : 'All severities'
    );
    const types = Array.from(new Set(state.events.map(ev => ev.type)));
    buildFilterGroup(
      els.typeFilter,
      types.map(v => ({value: v, label: splitCamel(v)})),
      state.filters.type,
      typeof window.t === 'function' ? window.t('events.filter.typeAll') : 'All types'
    );
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

  function handleI18nChange(){
    updateScenarioButton();
    buildFilterControls();
    if (els.drawerClose && typeof window.t === 'function') {
      els.drawerClose.setAttribute('aria-label', window.t('drawer.close'));
    }
    renderRangeCaption();
    renderKpis();
    renderHeatmap();
    renderEvents();
    renderActivity();
  }

  function setupDrawer(){
    if (!els.drawer || !els.drawerOverlay) return;
    els.drawer.setAttribute('aria-hidden', 'true');
    els.drawerOverlay.setAttribute('aria-hidden', 'true');
    if (els.drawerClose) {
      const label = typeof window.t === 'function' ? window.t('drawer.close') : 'Close drawer';
      els.drawerClose.setAttribute('aria-label', label);
    }
    els.drawerClose?.addEventListener('click', closeDrawer);
    els.drawerOverlay.addEventListener('click', closeDrawer);
    els.drawerHeatmapBtn?.addEventListener('click', () => {
      if (!state.selectedEvent) return;
      setActiveTab('heatmap');
      const iso = eventIso(state.selectedEvent);
      if (iso) highlightHeatmapColumn(iso);
    });
    els.drawerActivityBtn?.addEventListener('click', () => {
      if (!state.selectedEvent) return;
      setActiveTab('activity');
      scrollActivityToEvent(state.selectedEvent);
    });
    document.addEventListener('keydown', handleDrawerKeydown, true);
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

  function handleStorageEvent(evt){
    if (!evt || evt.key === 'hr:range') {
      onRangeChange();
    }
    if (!evt || evt.key === 'hr:team') {
      onTeamChange();
    }
  }

  function onRangeChange(){
    const selection = getRangeSelection();
    state.rangeSelection = selection;
    state.rangePreset = normalizePreset(selection);
    loadMetricsForSelection(selection);
  }

  function onTeamChange(){
    const selected = readTeamSelection();
    if (selected === state.activeTeam) return;
    state.activeTeam = selected;
    if (!state.rangeSelection) {
      state.rangeSelection = getRangeSelection();
      state.rangePreset = normalizePreset(state.rangeSelection);
    }
    loadMetricsForSelection(state.rangeSelection);
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

  function readTeamSelection(){
    try {
      return localStorage.getItem('hr:team') || 'all';
    } catch (e) {
      return 'all';
    }
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
    const path = metricsPathForSelection(selection, state.scenario);
    try {
      state.metrics = await loadJson(path);
    } catch (e) {
      if (state.scenario) {
        console.warn('Scenario metrics missing, falling back to baseline', e);
        try {
          state.metrics = await loadJson(metricsPathForSelection(selection, null));
        } catch (fallbackError) {
          console.error('Failed to load metrics', fallbackError);
          state.metrics = null;
          renderRangeCaption();
          renderKpis();
          renderHeatmap();
          renderActivity();
          renderEvents();
          return;
        }
      } else {
        console.error('Failed to load metrics', e);
        state.metrics = null;
        renderRangeCaption();
        renderKpis();
        renderHeatmap();
        renderActivity();
        renderEvents();
        return;
      }
    }
    updateRangeWindow();
    renderRangeCaption();
    renderKpis();
    renderHeatmap();
    renderActivity();
    renderEvents();
  }

  function metricsPathForSelection(selection, scenarioKey){
    const preset = normalizePreset(selection);
    const base = scenarioKey ? SCENARIO_ROOT : DATA_ROOT;
    switch (preset) {
      case 'day':
      case '7d':
        return `${base}/metrics_7d.json`;
      case 'year':
        return `${base}/metrics_year.json`;
      default:
        return `${base}/metrics_month.json`;
    }
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
    const scenarioPrefix = state.scenario ? ((typeof window.t === 'function' ? window.t('caption.scenarioPrefix') : 'Night-Shift Scenario · ') || 'Night-Shift Scenario · ') : '';
    const rangeText = captionRangeLabel();
    const teamText = teamLabel(state.activeTeam);
    const base = `${typeof window.t === 'function' ? window.t('caption.orgAverage') : 'Org avg'}${typeof window.t === 'function' ? window.t('caption.separator') : ' · '}${rangeText}${typeof window.t === 'function' ? window.t('caption.separator') : ' · '}${teamText}`;
    els.rangeCaption.textContent = `${scenarioPrefix}${base}`;
  }

  function captionRangeLabel(){
    if (state.rangeWindow) {
      const {start, end} = state.rangeWindow;
      const label = `${formatDateLabel(start)} – ${formatDateLabel(end)}`;
      if (typeof window.t === 'function') {
        return window.t('caption.range', {range: label});
      }
      return label;
    }
    const key = `range.${state.rangePreset}`;
    if (typeof window.t === 'function') {
      const translated = window.t(key);
      if (translated && translated !== key) return translated;
    }
    return rangePresetDescription();
  }

  function teamLabel(team){
    if (!team || team === 'all') {
      return typeof window.t === 'function' ? window.t('caption.teamAll') : 'All Teams';
    }
    return state.teamMap.get(team) || team;
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

    KPI_CONFIG.forEach(cfg => {
      const value = metricValue(cfg.key);
      if (value == null) return;
      const previous = metricPrevious(cfg.key);
      const formatted = typeof cfg.format === 'function' ? cfg.format(value) : value;
      const sparkValues = metricSeries(cfg.key);

      const tile = document.createElement('article');
      tile.className = 'tile tile--muted';
      tile.setAttribute('role', 'group');
      tile.setAttribute('aria-label', `${cfg.label} KPI`);

      const head = document.createElement('div');
      head.className = 'tile__head';
      const title = document.createElement('span');
      title.className = 'tile__title';
      title.textContent = cfg.label;
      head.appendChild(title);
      tile.appendChild(head);

      const metricRow = document.createElement('div');
      metricRow.className = 'kpi-metric';
      const ring = document.createElement('div');
      ring.className = 'ring kpi-ring';
      ring.setAttribute('aria-hidden', 'true');
      const ringValue = Math.max(0, Math.min(100, formatted));
      ring.style.setProperty('--value', `${ringValue}%`);
      metricRow.appendChild(ring);

      const metricValue = document.createElement('div');
      metricValue.className = 'tile__kpi';
      metricValue.innerHTML = `${formatted}${cfg.suffix || ''}<span>${cfg.unitLabel || ''}</span>`;
      metricRow.appendChild(metricValue);
      tile.appendChild(metricRow);

      const spark = document.createElement('div');
      spark.className = 'spark';
      spark.innerHTML = createSparklineSvg(sparkValues);
      tile.appendChild(spark);

      const foot = document.createElement('footer');
      foot.className = 'tile__foot';
      const deltaLabel = previous != null ? `${Math.round(value - previous)} Δ` : '';
      foot.innerHTML = `<span>${cfg.description}</span><span>${deltaLabel}</span>`;
      tile.appendChild(foot);

      els.kpis.appendChild(tile);
    });
  }

  function metricValue(key){
    if (!state.metrics) return null;
    if (state.activeTeam && state.activeTeam !== 'all') {
      const teamData = state.metrics.teams?.[state.activeTeam];
      if (teamData && key in teamData) return teamData[key];
      const breakdownEntry = Array.isArray(state.metrics.breakdown?.[key])
        ? state.metrics.breakdown[key].find(item => item.team === state.activeTeam)
        : null;
      if (breakdownEntry && breakdownEntry.value != null) return breakdownEntry.value;
    }
    return state.metrics.kpi?.[key] ?? null;
  }

  function metricPrevious(key){
    if (!state.metrics) return null;
    if (state.activeTeam && state.activeTeam !== 'all') {
      const breakdownEntry = Array.isArray(state.metrics.breakdown?.[key])
        ? state.metrics.breakdown[key].find(item => item.team === state.activeTeam)
        : null;
      if (breakdownEntry && breakdownEntry.previous != null) return breakdownEntry.previous;
    }
    return state.metrics.previous?.[key] ?? null;
  }

  function metricSeries(key){
    if (!state.metrics) return [];
    if (state.activeTeam && state.activeTeam !== 'all') {
      const breakdownEntry = Array.isArray(state.metrics.breakdown?.[key])
        ? state.metrics.breakdown[key].find(item => item.team === state.activeTeam)
        : null;
      if (breakdownEntry && Array.isArray(breakdownEntry.series)) return breakdownEntry.series;
    }
    if (Array.isArray(state.metrics.series?.[key])) return state.metrics.series[key];
    if (Array.isArray(state.metrics.kpi_trend?.[key])) return state.metrics.kpi_trend[key];
    return [];
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
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${areaPoints}" fill="rgba(39, 224, 255, 0.12)"></polygon><polyline points="${points}" fill="none" stroke="rgba(39, 224, 255, 0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
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
    const filteredRows = state.activeTeam && state.activeTeam !== 'all'
      ? rows.filter(rowId => rowId === state.activeTeam)
      : rows;
    const displayRows = filteredRows.length ? filteredRows : rows;
    if (!displayRows.length || !cols.length) {
      els.heatmap.innerHTML = `<p role="status">${typeof window.t === 'function' ? window.t('status.noData') : 'No data available'}</p>`;
      return;
    }
    els.heatmap.style.gridTemplateColumns = `repeat(${cols.length + 1}, minmax(0, 1fr))`;

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

    displayRows.forEach(rowId => {
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
          const teamName = state.teamMap.get(rowId) || rowId;
          const dayLabel = formatDateLabel(iso || col);
          btn.title = `${teamName} — ${dayLabel}: ${Math.round(val)}`;
          btn.setAttribute('aria-label', `${teamName} • ${dayLabel} • ${Math.round(val)}`);
          btn.dataset.level = getHeatmapLevel(val);
        } else {
          btn.textContent = '–';
        }
        btn.addEventListener('click', () => {
          const match = findEventForCell(rowId, iso);
          if (match) {
            openDrawer(match);
          } else if (iso) {
            setActiveTab('heatmap');
            highlightHeatmapColumn(iso);
          }
        });
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

  function findEventForCell(teamId, isoDate){
    if (!Array.isArray(state.events)) return null;
    return state.events.find(ev => {
      if (teamId && ev.team !== teamId) return false;
      if (isoDate) {
        if (ev.heatmapDate) return ev.heatmapDate === isoDate;
        if (ev.ts) return ev.ts.startsWith(isoDate);
      }
      return true;
    }) || null;
  }

  function handleDrawerKeydown(evt){
    if (!state.drawerOpen) return;
    if (evt.key === 'Escape') {
      evt.preventDefault();
      closeDrawer();
      return;
    }
    if (evt.key === 'Tab') {
      trapDrawerFocus(evt);
    }
  }

  function trapDrawerFocus(evt){
    if (!els.drawer) return;
    const focusable = Array.from(els.drawer.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => !el.hasAttribute('disabled') && (el.offsetParent !== null || el === document.activeElement));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (evt.shiftKey) {
      if (active === first || !els.drawer.contains(active)) {
        evt.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      evt.preventDefault();
      first.focus();
    }
  }

  function openDrawer(event){
    if (!els.drawer || !els.drawerOverlay || !event) return;
    state.selectedEvent = event;
    state.drawerOpen = true;
    state.lastFocus = document.activeElement;
    populateDrawer(event);
    els.drawer.classList.add('is-open');
    els.drawerOverlay.classList.add('is-open');
    els.drawer.setAttribute('aria-hidden', 'false');
    els.drawerOverlay.setAttribute('aria-hidden', 'false');
    const targetFocus = els.drawerClose || els.drawer;
    requestAnimationFrame(() => {
      targetFocus?.focus({preventScroll: false});
    });
    const iso = eventIso(event);
    if (iso) {
      if (state.activeTab === 'heatmap') {
        highlightHeatmapColumn(iso);
      } else {
        state.pendingHighlight = iso;
      }
    }
  }

  function closeDrawer(){
    if (!els.drawer || !els.drawerOverlay) return;
    state.drawerOpen = false;
    state.selectedEvent = null;
    els.drawer.classList.remove('is-open');
    els.drawerOverlay.classList.remove('is-open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.drawerOverlay.setAttribute('aria-hidden', 'true');
    const toFocus = state.lastFocus;
    state.lastFocus = null;
    if (toFocus && typeof toFocus.focus === 'function') {
      requestAnimationFrame(() => toFocus.focus({preventScroll: false}));
    }
  }

  function populateDrawer(event){
    if (!event) return;
    const teamName = teamLabel(event.team);
    const timestamp = new Date(event.ts);
    if (els.drawerSeverity) {
      els.drawerSeverity.className = `${severityPillClass(event.severity)} drawer__severity`;
      els.drawerSeverity.textContent = capitalize(event.severity || '');
    }
    if (els.drawerTeam) {
      els.drawerTeam.textContent = teamName;
    }
    if (els.drawerTimestamp) {
      els.drawerTimestamp.textContent = Number.isNaN(timestamp.getTime())
        ? ''
        : `${formatDateLabel(event.ts?.split('T')[0])} • ${formatTime(event.ts)}`;
    }
    if (els.drawerDetail) {
      els.drawerDetail.textContent = event.detail || event.rule || '';
    }
    if (els.drawerRule) {
      els.drawerRule.textContent = event.rule || event.detail || (typeof window.t === 'function' ? window.t('drawer.noThresholds') : 'No threshold details provided.');
    }
    if (els.drawerThresholds) {
      els.drawerThresholds.innerHTML = '';
      const thresholds = event.thresholds || {};
      const entries = Object.entries(thresholds);
      if (!entries.length) {
        const dd = document.createElement('dd');
        dd.textContent = typeof window.t === 'function' ? window.t('drawer.noThresholds') : 'No threshold details provided.';
        els.drawerThresholds.appendChild(dd);
      } else {
        entries.forEach(([key, value]) => {
          const dt = document.createElement('dt');
          dt.textContent = splitCamel(key);
          const dd = document.createElement('dd');
          dd.textContent = value;
          els.drawerThresholds.appendChild(dt);
          els.drawerThresholds.appendChild(dd);
        });
      }
    }
  }

  function eventIso(event){
    if (!event) return '';
    if (event.heatmapDate) return event.heatmapDate;
    if (event.ts) return event.ts.split('T')[0];
    return '';
  }

  function scrollActivityToEvent(event){
    if (!els.activity) return;
    const targetTeam = event.team;
    const targetDate = eventIso(event);
    const rows = Array.from(els.activity.querySelectorAll('tbody tr'));
    if (!rows.length) return;
    rows.forEach(row => row.classList.remove('is-highlighted'));
    const match = rows.find(row => {
      const rowTeam = row.dataset.team;
      const rowDate = row.dataset.date;
      const teamMatch = !targetTeam || rowTeam === targetTeam;
      const dateMatch = !targetDate || rowDate === targetDate;
      return teamMatch && dateMatch;
    });
    if (match) {
      match.classList.add('is-highlighted');
      match.scrollIntoView({behavior: 'smooth', block: 'center'});
      setTimeout(() => match.classList.remove('is-highlighted'), 3000);
    }
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
      empty.textContent = typeof window.t === 'function' ? window.t('events.empty') : 'No detection events in this range.';
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
      if (state.activeTeam && state.activeTeam !== 'all' && ev.team !== state.activeTeam) return false;
      if (state.filters.team.size && !state.filters.team.has(ev.team)) return false;
      if (state.filters.severity.size && !state.filters.severity.has(ev.severity)) return false;
      if (state.filters.type.size && !state.filters.type.has(ev.type)) return false;
      return true;
    }).sort((a, b) => new Date(b.ts) - new Date(a.ts));

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = typeof window.t === 'function' ? window.t('events.emptyFiltered') : 'Filters returned no events.';
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
        const teamName = state.teamMap.get(ev.team) || ev.team;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'timeline-event';
        btn.dataset.severity = ev.severity;
        btn.dataset.team = ev.team;
        if (ev.heatmapDate) btn.dataset.iso = ev.heatmapDate;
        const isoDate = ev.heatmapDate || (ev.ts ? ev.ts.split('T')[0] : '');
        btn.setAttribute('aria-label', `${splitCamel(ev.type)} for ${teamName} at ${formatTime(ev.ts)}`);

        const card = document.createElement('div');
        card.className = 'tile tile--compact tile--interactive';

        const head = document.createElement('div');
        head.className = 'tile__head';
        const severity = document.createElement('span');
        severity.className = severityPillClass(ev.severity);
        severity.textContent = capitalize(ev.severity);
        head.appendChild(severity);
        const time = document.createElement('time');
        time.dateTime = ev.ts;
        time.textContent = formatTime(ev.ts);
        head.appendChild(time);
        card.appendChild(head);

        const title = document.createElement('div');
        title.className = 'timeline-event__title';
        title.textContent = splitCamel(ev.type);
        card.appendChild(title);

        const foot = document.createElement('div');
        foot.className = 'tile__foot';
        const teamPill = document.createElement('span');
        teamPill.className = 'pill team-pill';
        teamPill.textContent = teamName;
        foot.appendChild(teamPill);
        const rulePill = document.createElement('span');
        rulePill.className = 'pill pill--neutral has-tooltip';
        rulePill.tabIndex = 0;
        rulePill.textContent = typeof window.t === 'function' ? window.t('events.trigger') : 'Trigger';
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = ev.rule || ev.detail || 'Threshold triggered';
        rulePill.appendChild(tooltip);
        rulePill.setAttribute('aria-label', tooltip.textContent);
        foot.appendChild(rulePill);
        card.appendChild(foot);

        btn.appendChild(card);

        btn.addEventListener('click', () => {
          openDrawer(ev);
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

    updateFilterVisuals(container, setRef);
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
    const filteredRows = state.metrics.activity.filter(row => !state.activeTeam || state.activeTeam === 'all' || row.team === state.activeTeam);
    if (!filteredRows.length) {
      els.activity.innerHTML = `<p role="status">${typeof window.t === 'function' ? window.t('status.noData') : 'No data available'}</p>`;
      return;
    }

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
    const sortedRows = [...filteredRows].sort((a, b) => compareActivityRows(a, b));
    sortedRows.forEach(row => {
      const tr = document.createElement('tr');
      tr.dataset.team = row.team;
      tr.dataset.date = row.date;
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
