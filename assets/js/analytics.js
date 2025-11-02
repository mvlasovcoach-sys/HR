document.addEventListener('click', event => {
    const trigger = event.target;
    if (!(trigger instanceof Element)) return;
    if (!trigger.classList.contains('x-expand')) return;
    const card = trigger.closest('.chart-card');
    if (!card) return;
    const expanded = card.classList.toggle('expanded');
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    setExpandLabel(trigger, expanded);
});

document.addEventListener('i18n:change', () => {
    document.querySelectorAll('.x-expand').forEach(btn => {
        const card = btn.closest('.chart-card');
        const expanded = card?.classList.contains('expanded');
        setExpandLabel(btn, expanded);
    });
});

function setExpandLabel(button, expanded){
    if (!button) return;
    const key = expanded ? 'analytics.collapse' : 'analytics.expand';
    const fallback = expanded ? 'Collapse' : 'Expand';
    const label = window.I18N?.t?.(key) || fallback;
    button.textContent = label;
    button.setAttribute('aria-label', label);
}

function initPage(){
    const loaderGlobals = window.loaderGlobals || {};
    const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : (url => url);
    const loadJson = typeof loaderGlobals.fetchJson === 'function'
      ? loaderGlobals.fetchJson
      : async url => {
          const response = await fetch(url, {cache: 'no-store'});
          if (response.status === 404) return null;
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
          return response.json();
        };

    const canonicalScenario = typeof loaderGlobals.canonicalScenarioKey === 'function'
      ? loaderGlobals.canonicalScenarioKey
      : value => {
          const key = String(value || '').toLowerCase().trim();
          if (key === 'night' || key === 'night-shift' || key === 'night_shift' || key === 'nightshift') return 'night';
          if (key === 'demo' || key === 'sandbox' || key === 'preview') return 'demo';
          return 'live';
        };

    const loadScenarioManifestFn = typeof loaderGlobals.loadScenarioManifest === 'function'
      ? loaderGlobals.loadScenarioManifest
      : async key => ({
          key: canonicalScenario(key),
          meta: {requested: canonicalScenario(key), resolved: canonicalScenario(key), fallback: false}
        });

    function versionedUrl(path, options = {}){
      const url = new URL(path, document.baseURI);
      const {range, team, params} = options || {};
      if (range && typeof range === 'object') {
        Object.entries(range).forEach(([key, value]) => {
          if (value != null) url.searchParams.set(key, value);
        });
      }
      if (team != null) {
        url.searchParams.set('team', team);
      }
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([key, value]) => {
          if (value != null) url.searchParams.set(key, value);
        });
      }
      return applyVersion(url.toString());
    }

    function fetchData(path, options){
      return loadJson(versionedUrl(path, options));
    }

    const chartEl = document.getElementById('wlb-chart');
    if (!chartEl) return;
    const legendEl = document.getElementById('wellbeing-legend');
    const breakdownEl = document.getElementById('analytics-breakdown');
    const captionEl = document.getElementById('global-caption');
    const maToggle = document.getElementById('maToggle');
    const deltaBadgeEl = document.getElementById('trk-delta');
    const miniGrid = document.getElementById('analytics-mini-kpis');
    const trackerPanel = document.getElementById('analytics-tracker-panel');
    const trackerMeta = document.getElementById('trk-meta');
    const breakdownPanel = document.querySelector('.analytics-breakdown');
    const toastEl = document.getElementById('analytics-toast');

    const BREAKDOWN_KEYS = [
      {key: 'high_stress_pct', label: 'kpi.highStress', fallback: 'High stress', inverse: true, unit: '%'},
      {key: 'fatigue_elevated_pct', label: 'kpi.elevatedFatigue', fallback: 'Elevated fatigue', inverse: true, unit: '%'},
      {key: 'engagement_active_pct', label: 'kpi.activeEngagement', fallback: 'Active engagement', inverse: false, unit: '%'}
    ];

    const LOW_SAMPLE_THRESHOLD = 20;
    const miniKpiRegistry = new Map();
    let hoverHandlerAttached = false;
    let toastTimer = null;

    const MA_KEY = 'hr:analytics:ma';
    let useMA = readStoredMA();
    let currentChartState = null;
    let compareEnabled = readCompare();
    let scenarioState = { manifest: null, requested: null, resolved: canonicalScenario('live') };
    let resolvedScenarioKey = canonicalScenario('live');
    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        if (currentChartState) {
          renderWellbeingChart(currentChartState);
        }
      });
      resizeObserver.observe(chartEl);
    } else {
      window.addEventListener('resize', () => {
        if (currentChartState) {
          renderWellbeingChart(currentChartState);
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
        if (evt.key === 'hr:scenario') {
          scenarioState = { manifest: null, requested: null, resolved: canonicalScenario('live') };
          resolvedScenarioKey = canonicalScenario('live');
        }
        render();
      }
      if (evt.key === MA_KEY && maToggle) {
        useMA = readStoredMA();
        maToggle.checked = useMA;
        render();
      }
      if (evt.key === 'hr:compare') {
        compareEnabled = readCompare();
        render();
      }
    });
    document.addEventListener('i18n:change', render);
    const expandBtn = document.querySelector('.chart-card .x-expand');
    setExpandLabel(expandBtn, expandBtn?.closest('.chart-card')?.classList.contains('expanded'));

    function t(key, vars, fallback){
      let tplVars = vars;
      let alt = fallback;
      if (typeof vars === 'string' && typeof fallback === 'undefined') {
        alt = vars;
        tplVars = undefined;
      }
      try {
        const value = window.I18N?.t?.(key, tplVars);
        if (value != null) return value;
      } catch (err) {
        /* ignore */
      }
      if (typeof alt === 'string') return alt;
      return key.replace(/^label\.|^range\./, '');
    }

    function showToast(message){
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.hidden = false;
      toastEl.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => hideToast(), 5000);
    }

    function hideToast(){
      if (!toastEl) return;
      toastEl.classList.remove('is-visible');
      toastEl.hidden = true;
    }

    window.addEventListener('scenario:fallback', event => {
      const detail = event?.detail || {};
      if (!detail || !detail.from) return;
      const message = t('toast.scenarioFallback', 'Scenario data unavailable — switched to demo');
      showToast(message);
    });

    const getLang = () => window.I18N?.getLang?.() || 'en';

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

    function readCompare(){
      if (typeof window.DateControls?.readCompare === 'function') {
        try {
          return Boolean(window.DateControls.readCompare());
        } catch (err) {
          /* ignore */
        }
      }
      try {
        const raw = localStorage.getItem('hr:compare');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed?.enabled);
      } catch (err) {
        return false;
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

    function setLoading(active){
      [trackerPanel, breakdownPanel].forEach(panel => {
        if (!panel) return;
        panel.classList.toggle('is-loading', !!active);
        if (active) {
          panel.setAttribute('aria-busy', 'true');
        } else {
          panel.removeAttribute('aria-busy');
        }
      });
    }

    function applyLowSampleState(metrics, team){
      const size = sampleSize(metrics, team);
      const message = lowSampleMessage(size);
      [trackerPanel, breakdownPanel].forEach(panel => {
        if (!panel) return;
        if (message) {
          panel.setAttribute('data-low-sample', 'true');
          panel.setAttribute('data-low-sample-label', message);
          panel.setAttribute('title', message);
        } else {
          panel.removeAttribute('data-low-sample');
          panel.removeAttribute('data-low-sample-label');
          panel.removeAttribute('title');
        }
      });
    }

    function lowSampleMessage(n){
      if (!Number.isFinite(n) || n >= LOW_SAMPLE_THRESHOLD) return '';
      const label = t('stats.lowSample', 'Low sample size');
      return `${label} (n=${Math.round(n)})`;
    }

    function updateCaption(insight){
      if (window.Caption?.render) {
        window.Caption.render('#global-caption', {asOf: new Date(), insight});
      } else if (captionEl) {
        captionEl.textContent = insight;
      }
    }

    async function ensureScenario(forceKey){
      const requested = canonicalScenario(forceKey || readScenario());
      if (scenarioState.manifest && scenarioState.requested === requested && !forceKey) {
        return scenarioState;
      }
      try {
        const manifest = await loadScenarioManifestFn(requested);
        const resolved = canonicalScenario(manifest?.meta?.resolved || manifest?.key || requested);
        scenarioState = { manifest, requested, resolved };
        resolvedScenarioKey = resolved;
        return scenarioState;
      } catch (err) {
        scenarioState = { manifest: null, requested, resolved: requested };
        resolvedScenarioKey = requested;
        throw err;
      }
    }

    async function render(){
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      compareEnabled = readCompare();
      setLoading(true);
      let metrics = null;
      const insight = buildCaption(range, team);
      try {
        const scenario = await ensureScenario();
        metrics = await loadMetrics(preset, range, team, scenario.manifest);
        if (!metrics) {
          renderNoData(insight);
          return;
        }
        const insufficient = Number(metrics?.n) > 0 && Number(metrics.n) < 5;
        toggleInsufficient(insufficient);
        applyLowSampleState(metrics, team);

        renderTracker(metrics, team, {compare: compareEnabled, preset});
        renderBreakdown(metrics, team);
        renderMiniKpis(metrics, team);
        updateCaption(insight);

        if (trackerPanel) {
          trackerPanel.dataset.sourcePeriod = periodLabel(range);
          trackerPanel.dataset.sourceThreshold = 'Wellbeing ≥ 60';
        }
        if (typeof window.renderSourceNote === 'function' && trackerMeta) {
          window.renderSourceNote(trackerMeta, {
            sourceId: 'demo-synth-2025',
            threshold: 'Wellbeing ≥ 60',
            period: periodLabel(range)
          });
        }
      } catch (err) {
        console.error('Analytics render failed', err);
        renderNoData(insight, { message: t('toast.scenarioUnavailable', 'Scenario data unavailable. Please reload.'), reload: true });
        return;
      } finally {
        setLoading(false);
      }
    }

    async function loadMetrics(preset, range, team, manifest){
      try {
        const map = manifest?.metrics || {};
        const canonical = canonicalPreset(preset);
        const path = map[canonical] || map.default || `./data/org/metrics_${canonical}.json`;
        return await fetchData(path, {range, team});
      } catch (e) {
        console.error('Analytics metrics failed', e);
        return null;
      }
    }

    function renderNoData(insight, options = {}){
      const message = options.message || t('status.noData', 'No data');
      currentChartState = null;
      renderWellbeingChart(null);
      if (legendEl) legendEl.innerHTML = `<span>${escapeHtml(message)}</span>`;
      if (breakdownEl) breakdownEl.innerHTML = '';
      if (miniGrid) miniGrid.innerHTML = '';
      miniKpiRegistry.clear();
      if (deltaBadgeEl) {
        deltaBadgeEl.textContent = '';
        deltaBadgeEl.className = 'delta-badge';
        deltaBadgeEl.removeAttribute('aria-label');
      }
      if (trackerMeta) trackerMeta.innerHTML = '';
      if (trackerPanel) {
        delete trackerPanel.dataset.sourcePeriod;
        delete trackerPanel.dataset.sourceThreshold;
      }
      updateCaption(insight);
      window.dispatchEvent(new CustomEvent('analytics:hoverIndex', {detail: {index: null}}));

      if (options.reload && chartEl) {
        chartEl.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'empty-state';
        const paragraph = document.createElement('p');
        paragraph.textContent = message;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'brand-btn--primary';
        button.textContent = t('ui.reload', 'Reload');
        button.addEventListener('click', () => window.location.reload());
        container.appendChild(paragraph);
        container.appendChild(button);
        chartEl.appendChild(container);
      }
    }

    function renderTracker(metrics, team, options={}){
      const info = metricDeltaInfo(metrics, 'wellbeing_avg', team);
      const seriesSource = Array.isArray(info.series) && info.series.length
        ? info.series
        : (metrics.series?.wellbeing_avg || []);
      const normalizedSeries = normalizeSeries(seriesSource);
      const displaySeries = useMA ? movingAverage(normalizedSeries, 3) : normalizedSeries.slice();
      const current = Number.isFinite(info.current)
        ? info.current
        : (normalizedSeries.length ? normalizedSeries[normalizedSeries.length - 1] : null);
      const fallbackPrevious = current != null && Number.isFinite(info.delta) ? current - info.delta : null;
      const previous = Number.isFinite(info.previous) ? info.previous : fallbackPrevious;
      const delta = Number.isFinite(info.delta)
        ? info.delta
        : (current != null && previous != null ? current - previous : 0);
      const badge = deltaBadge(delta, true);
      const modeLabel = useMA ? t('label.movingAverage', 'Moving average') : t('label.actual', 'Actual');
      const sampleN = sampleSize(metrics, team);
      const rangeKey = options?.preset || presetForRange(readRange());
      const windowSize = windowSizeForRange(rangeKey, displaySeries.length);
      const compareActive = Boolean(options?.compare);
      const compareSeries = compareActive && windowSize ? shiftSeries(normalizedSeries, windowSize) : null;
      const seSeries = computeStandardErrors(displaySeries, sampleN);
      const bandTop = buildBandSeries(displaySeries, seSeries, 1);
      const bandBottom = buildBandSeries(displaySeries, seSeries, -1);
      const labels = buildTrackerLabels(metrics, displaySeries.length);

      if (legendEl) {
        const legendItems = [
          `<span class="legend-line">${t('kpi.wellbeing', 'Wellbeing score')} (${modeLabel})</span>`,
          `<span>${t('status.value', 'Value')}: ${current != null ? Math.round(current) : '–'}/100</span>`
        ];
        if (Number.isFinite(sampleN)) {
          legendItems.push(`<span>${t('stats.sample', 'Sample')}: n=${Math.round(sampleN)}</span>`);
        }
        legendItems.push(`<span class="legend-band">${t('analytics.ciBand', 'CI band (±SE)')}</span>`);
        if (compareActive && compareSeries && compareSeries.some(Number.isFinite)) {
          legendItems.push(`<span class="legend-prev">${t('analytics.prevWindow', 'Prev window (dashed)')}</span>`);
        }
        legendItems.push(`<span class="${badge.className}">${badge.label}</span>`);
        legendEl.innerHTML = legendItems.filter(Boolean).join('');
      }

      updateTrackerDelta(deltaBadgeEl, current, previous);

      chartEl.setAttribute('aria-label', `${t('kpi.wellbeing', 'Wellbeing score')} (${modeLabel}) trend`);

      currentChartState = {
        series: displaySeries,
        labels,
        previous: compareSeries,
        bandTop,
        bandBottom,
        se: seSeries,
        sample: sampleN,
        compare: compareActive
      };

      renderWellbeingChart(currentChartState);
    }

    function renderWellbeingChart(state){
      const host = document.getElementById('wlb-chart');
      if (!host) return;

      if (host._trackerHandlers) {
        const prev = host._trackerHandlers;
        host.removeEventListener('pointermove', prev.move);
        host.removeEventListener('pointerleave', prev.leave);
        host.removeEventListener('pointerup', prev.leave);
        host.removeEventListener('touchstart', prev.touchMove);
        host.removeEventListener('touchmove', prev.touchMove);
        host.removeEventListener('touchend', prev.leave);
        host.removeEventListener('touchcancel', prev.leave);
        host._trackerHandlers = null;
      }

      host.classList.add('tracker-chart');

      if (!state || !Array.isArray(state.series) || state.series.length === 0) {
        host.classList.remove('is-hovering');
        host.setAttribute('aria-label', t('status.noData', 'No data'));
        host.innerHTML = `<p role="status">${t('status.noData', 'No data')}</p>`;
        window.dispatchEvent(new CustomEvent('analytics:hoverIndex', {detail: {index: null}}));
        return;
      }

      const series = state.series;
      const labels = Array.isArray(state.labels) ? state.labels : [];
      const previousSeries = Array.isArray(state.previous) ? state.previous : null;
      const bandTop = Array.isArray(state.bandTop) ? state.bandTop : [];
      const bandBottom = Array.isArray(state.bandBottom) ? state.bandBottom : [];
      const seSeries = Array.isArray(state.se) ? state.se : [];
      const sample = Number.isFinite(state.sample) ? state.sample : null;
      const compareActive = Boolean(state.compare);

      const rect = host.getBoundingClientRect();
      const widthPx = rect.width || host.clientWidth || 360;
      const heightPx = rect.height || host.clientHeight || 240;
      const W = Math.max(360, Math.round(widthPx || 360));
      const H = Math.max(220, Math.round(heightPx || 220));
      const padLeft = 40;
      const padRight = 24;
      const padTop = 28;
      const padBottom = 36;

      host.innerHTML = '';
      host.classList.remove('is-hovering');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.classList.add('tracker-chart__svg');
      svg.setAttribute('role', 'presentation');
      svg.setAttribute('aria-hidden', 'true');
      host.appendChild(svg);

      const xScale = index => padLeft + index * ((W - padLeft - padRight) / Math.max(1, series.length - 1));
      const extent = [];
      const pushExtent = value => { if (Number.isFinite(value)) extent.push(value); };
      series.forEach(pushExtent);
      bandTop.forEach(pushExtent);
      bandBottom.forEach(pushExtent);
      if (compareActive && previousSeries) previousSeries.forEach(pushExtent);
      if (!extent.length) {
        extent.push(0);
        extent.push(100);
      }
      const minVal = Math.min(...extent);
      const maxVal = Math.max(...extent);
      const span = maxVal - minVal || 1;
      const yScale = value => {
        if (!Number.isFinite(value)) return padTop + (H - padTop - padBottom) / 2;
        return padTop + (H - padTop - padBottom) * (1 - (value - minVal) / span);
      };

      const bandPath = buildBandPath(bandTop, bandBottom, xScale, yScale);
      if (bandPath) {
        const area = document.createElementNS(svg.namespaceURI, 'path');
        area.setAttribute('d', bandPath);
        area.setAttribute('fill', 'rgba(39, 224, 255, 0.18)');
        area.setAttribute('stroke', 'none');
        svg.appendChild(area);
      }

      const linePath = buildLinePath(series, xScale, yScale);
      if (linePath) {
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('d', linePath);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--cyan, #27E0FF)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      }

      if (compareActive && previousSeries) {
        const comparePath = buildLinePath(previousSeries, xScale, yScale);
        if (comparePath) {
          const prev = document.createElementNS(svg.namespaceURI, 'path');
          prev.setAttribute('d', comparePath);
          prev.setAttribute('fill', 'none');
          prev.setAttribute('stroke', 'rgba(159, 213, 235, 0.65)');
          prev.setAttribute('stroke-width', '2');
          prev.setAttribute('stroke-dasharray', '6 6');
          prev.setAttribute('vector-effect', 'non-scaling-stroke');
          prev.setAttribute('stroke-linecap', 'round');
          svg.appendChild(prev);
        }
      }

      const scaleX = (widthPx || W) / W;
      const scaleY = (heightPx || H) / H;

      const cursor = document.createElement('div');
      cursor.className = 'tracker-chart__cursor';
      host.appendChild(cursor);

      const focus = document.createElement('div');
      focus.className = 'tracker-chart__focus';
      host.appendChild(focus);

      const tooltip = document.createElement('div');
      tooltip.className = 'tracker-tooltip';
      host.appendChild(tooltip);

      const points = series.map((value, index) => {
        const numeric = Number(value);
        const labelEntry = labels[index];
        const label = formatLabel(labelEntry, index);
        const seValue = Number(seSeries[index]);
        const previous = previousSeries && Number.isFinite(previousSeries[index]) ? Number(previousSeries[index]) : null;
        return {
          index,
          value: Number.isFinite(numeric) ? numeric : null,
          x: xScale(index),
          y: Number.isFinite(numeric) ? yScale(numeric) : null,
          label,
          se: Number.isFinite(seValue) ? seValue : null,
          previous
        };
      });

      let lastIndex = null;

      const handlePointerMove = event => {
        const clientX = getClientX(event);
        if (clientX == null) return;
        const index = indexForClientX(clientX);
        updateHover(index);
      };

      const handleLeave = () => {
        if (!host.classList.contains('is-hovering')) return;
        host.classList.remove('is-hovering');
        lastIndex = null;
        window.dispatchEvent(new CustomEvent('analytics:hoverIndex', {detail: {index: null}}));
      };

      const handlers = {
        move: handlePointerMove,
        leave: handleLeave,
        touchMove: event => handlePointerMove(event)
      };
      host._trackerHandlers = handlers;

      host.addEventListener('pointermove', handlePointerMove);
      host.addEventListener('pointerleave', handleLeave);
      host.addEventListener('pointerup', handleLeave);
      host.addEventListener('touchstart', handlers.touchMove, {passive: true});
      host.addEventListener('touchmove', handlers.touchMove, {passive: true});
      host.addEventListener('touchend', handleLeave);
      host.addEventListener('touchcancel', handleLeave);

      function updateHover(targetIndex){
        let point = points[targetIndex];
        if (!point || point.value == null || point.y == null) {
          point = findNearestValid(targetIndex);
          if (!point) {
            handleLeave();
            return;
          }
        }
        lastIndex = point.index;
        const left = point.x * scaleX;
        const top = point.y * scaleY;
        cursor.style.left = `${left}px`;
        focus.style.left = `${left}px`;
        focus.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.innerHTML = buildTooltip(point);
        host.classList.add('is-hovering');
        const detail = {
          index: point.index,
          label: point.label,
          value: point.value,
          se: point.se,
          sample
        };
        if (compareActive && Number.isFinite(point.previous)) {
          detail.previous = point.previous;
        }
        window.dispatchEvent(new CustomEvent('analytics:hoverIndex', {detail}));
      }

      function buildTooltip(point){
        const labelText = escapeHtml(point.label ?? `#${point.index + 1}`);
        const valueText = formatValue(point.value);
        const seText = Number.isFinite(point.se) ? formatSe(point.se) : null;
        let summary = valueText;
        if (seText) summary += ` ±${seText}`;
        if (Number.isFinite(sample)) summary += ` (n=${Math.round(sample)})`;
        const lines = [`<strong>${labelText}</strong>`, `<div>${escapeHtml(summary)}</div>`];
        if (compareActive && Number.isFinite(point.previous)) {
          const prevLabel = escapeHtml(t('analytics.prevValue', 'Prev'));
          lines.push(`<div>${prevLabel}: ${escapeHtml(formatValue(point.previous))}</div>`);
        }
        return lines.join('');
      }

      function indexForClientX(clientX){
        const bounds = host.getBoundingClientRect();
        const width = bounds.width || 1;
        const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / width));
        return Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1))));
      }

      function findNearestValid(index){
        let left = index;
        let right = index;
        while (left >= 0 || right < points.length) {
          if (left >= 0) {
            const candidate = points[left];
            if (candidate && candidate.value != null && candidate.y != null) return candidate;
            left -= 1;
          }
          if (right < points.length) {
            const candidate = points[right];
            if (candidate && candidate.value != null && candidate.y != null) return candidate;
            right += 1;
          }
        }
        return null;
      }

      function formatLabel(entry, index){
        if (entry && typeof entry === 'object') {
          return entry.display || entry.raw || `#${index + 1}`;
        }
        if (entry != null) return String(entry);
        return `#${index + 1}`;
      }

      function formatValue(value){
        try {
          return new Intl.NumberFormat(getLang(), {maximumFractionDigits: 0}).format(value);
        } catch (err) {
          return Math.round(value).toString();
        }
      }

      function formatSe(value){
        const digits = Math.abs(value) >= 1 ? 1 : 2;
        try {
          return new Intl.NumberFormat(getLang(), {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
          }).format(value);
        } catch (err) {
          return value.toFixed(digits);
        }
      }

      function getClientX(evt){
        if (evt.touches && evt.touches.length) return evt.touches[0].clientX;
        if (evt.changedTouches && evt.changedTouches.length) return evt.changedTouches[0].clientX;
        if (typeof evt.clientX === 'number') return evt.clientX;
        return null;
      }

      function buildBandPath(topSeriesValues, bottomSeriesValues, xFn, yFn){
        const topPoints = [];
        const bottomPoints = [];
        for (let i = 0; i < series.length; i += 1) {
          const topVal = Number(topSeriesValues[i]);
          const bottomVal = Number(bottomSeriesValues[i]);
          if (!Number.isFinite(topVal) || !Number.isFinite(bottomVal)) continue;
          topPoints.push({x: xFn(i), y: yFn(topVal)});
          bottomPoints.push({x: xFn(i), y: yFn(bottomVal)});
        }
        if (topPoints.length < 2) return '';
        let path = `M ${topPoints[0].x} ${topPoints[0].y}`;
        for (let i = 1; i < topPoints.length; i += 1) {
          path += ` L ${topPoints[i].x} ${topPoints[i].y}`;
        }
        for (let i = bottomPoints.length - 1; i >= 0; i -= 1) {
          path += ` L ${bottomPoints[i].x} ${bottomPoints[i].y}`;
        }
        path += ' Z';
        return path;
      }

      function buildLinePath(values, xFn, yFn){
        let path = '';
        let started = false;
        for (let i = 0; i < values.length; i += 1) {
          const val = Number(values[i]);
          if (!Number.isFinite(val)) {
            started = false;
            continue;
          }
          const x = xFn(i);
          const y = yFn(val);
          if (!started) {
            path += `M ${x} ${y}`;
            started = true;
          } else {
            path += ` L ${x} ${y}`;
          }
        }
        return started ? path : '';
      }
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
        const sparkMeta = buildSparkMeta(delta);
        return `<article class="tile breakdown-card">
          <header class="tile__head">
            <span class="tile__title">${t(cfg.label, cfg.fallback)}</span>
            <span class="${badge.className}">${badge.label}</span>
          </header>
          <div class="tile__kpi">${Math.round(value)}<span>${cfg.unit}</span></div>
          <div class="spark">${sparkline(series, sparkMeta)}</div>
          <footer class="breakdown-meta">
            <span>${t('status.value', 'Value')} ${Math.round(value)}${cfg.unit}</span>
            <span>${t('status.target', 'Target')}: ${Math.round(previous)}${cfg.unit}</span>
          </footer>
        </article>`;
      }).join('');
      breakdownEl.innerHTML = cards;
    }

    function renderMiniKpis(metrics, team){
      if (!miniGrid) return;
      miniGrid.innerHTML = '';
      miniKpiRegistry.clear();
      const nValue = Number(metrics?.n);
      if (Number.isFinite(nValue) && window.guardSmallN) {
        if (window.guardSmallN(nValue, miniGrid)) {
          return;
        }
      } else {
        miniGrid.removeAttribute('data-guard');
      }

      const fragment = document.createDocumentFragment();

      BREAKDOWN_KEYS.forEach(cfg => {
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

        const item = document.createElement('div');
        item.className = 'mini-kpis__item';

        const labelEl = document.createElement('span');
        labelEl.className = 'mini-kpis__label';
        labelEl.textContent = t(cfg.label, cfg.fallback);
        item.appendChild(labelEl);

        const valueEl = document.createElement('strong');
        valueEl.className = 'mini-kpis__value';
        const valueNode = document.createTextNode(Math.round(value));
        valueEl.appendChild(valueNode);
        const unitEl = document.createElement('span');
        unitEl.textContent = cfg.unit;
        valueEl.appendChild(unitEl);
        item.appendChild(valueEl);

        const deltaEl = document.createElement('span');
        deltaEl.className = `mini-kpis__delta ${badge.className}`;
        deltaEl.setAttribute('aria-label', summary);
        deltaEl.textContent = summary;
        item.appendChild(deltaEl);

        fragment.appendChild(item);

        miniKpiRegistry.set(cfg.key, {
          element: item,
          valueNode,
          unitNode: unitEl,
          defaultValue: Math.round(value),
          unit: cfg.unit,
          series: normalizeSeries(info.series || [])
        });
      });

      miniGrid.appendChild(fragment);
      attachHoverSync();
      updateMiniHover(null);
    }

    function attachHoverSync(){
      if (hoverHandlerAttached) return;
      hoverHandlerAttached = true;
      window.addEventListener('analytics:hoverIndex', event => {
        const detail = event?.detail;
        const index = Number.isInteger(detail?.index) ? detail.index : null;
        updateMiniHover(index);
      });
    }

    function updateMiniHover(index){
      miniKpiRegistry.forEach(entry => {
        const {element, valueNode, defaultValue, series} = entry;
        if (index == null || !Array.isArray(series) || !Number.isFinite(series[index])) {
          valueNode.nodeValue = String(defaultValue);
          element.classList.remove('is-hovered');
          return;
        }
        valueNode.nodeValue = String(Math.round(series[index]));
        element.classList.add('is-hovered');
      });
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
          if (Array.isArray(arr) && Number.isFinite(arr[i])) {
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
      const preset = metrics?.range ? canonicalPreset(metrics.range) : presetForRange(readRange());
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
          panel.setAttribute('data-guard-message', t('guard.insufficient', 'Access restricted'));
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
          if (j >= 0 && Number.isFinite(values[j])) {
            sum += values[j];
            count += 1;
          }
        }
        result.push(count ? sum / count : values[i]);
      }
      return result;
    }

    function normalizeSeries(values){
      if (!Array.isArray(values)) return [];
      const result = [];
      for (let i = 0; i < values.length; i += 1) {
        const num = Number(values[i]);
        if (Number.isFinite(num)) {
          result.push(num);
        } else {
          const fallback = i > 0 ? result[i - 1] : null;
          result.push(Number.isFinite(fallback) ? fallback : NaN);
        }
      }
      return result;
    }

    function shiftSeries(series, windowSize){
      if (!Array.isArray(series) || !windowSize) return null;
      const result = new Array(series.length).fill(null);
      for (let i = 0; i < series.length; i += 1) {
        const sourceIndex = i - windowSize;
        if (sourceIndex >= 0 && Number.isFinite(series[sourceIndex])) {
          result[i] = series[sourceIndex];
        }
      }
      return result;
    }

    function computeStandardErrors(series, sampleN){
      if (!Array.isArray(series)) return [];
      if (!Number.isFinite(sampleN) || sampleN <= 0) {
        return series.map(() => null);
      }
      return series.map(value => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        const proportion = Math.max(0, Math.min(1, numeric / 100));
        const se = Math.sqrt((proportion * (1 - proportion)) / sampleN) * 100;
        return Number.isFinite(se) ? se : null;
      });
    }

    function buildBandSeries(series, seSeries, direction){
      if (!Array.isArray(series) || !Array.isArray(seSeries)) return [];
      return series.map((value, index) => {
        const base = Number(value);
        const se = Number(seSeries[index]);
        if (!Number.isFinite(base) || !Number.isFinite(se)) return null;
        const adjusted = direction >= 0 ? base + se : base - se;
        return Math.max(0, Math.min(100, adjusted));
      });
    }

    function buildTrackerLabels(metrics, length){
      if (!length) return [];
      const heatmapDates = metrics?.heatmap?.dates;
      if (Array.isArray(heatmapDates) && heatmapDates.length) {
        const slice = heatmapDates.slice(-length);
        return slice.map(date => ({raw: date, display: formatLocaleDate(date)}));
      }
      const seriesLabels = metrics?.series?.labels || metrics?.series?.dates;
      if (Array.isArray(seriesLabels) && seriesLabels.length) {
        const slice = seriesLabels.slice(-length);
        return slice.map(label => ({raw: label, display: formatLocaleDate(label)}));
      }
      return Array.from({length}, (_, idx) => ({raw: idx, display: `#${idx + 1}`}));
    }

    function deltaVsPrior(series){
      const n=series.length, half=Math.floor(n/2);
      if(!half) return 0;
      const avg=a=>Math.round(a.reduce((s,v)=>s+v,0)/a.length);
      return avg(series.slice(half)) - avg(series.slice(0,half));
    }

    function sparkline(values, meta){
      if (!Array.isArray(values) || values.length === 0) {
        return '<div class="chart chart--spark" aria-hidden="true"></div>';
      }
      const max = Math.max(...values);
      const min = Math.min(...values);
      const span = max - min || 1;
      const step = values.length > 1 ? 100 / (values.length - 1) : 100;
      const points = values.map((v, i) => {
        const x = (step * i).toFixed(2);
        const y = (100 - ((v - min) / span) * 100).toFixed(2);
        return `${x},${y}`;
      }).join(' ');
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
      let tone = 'is-flat';
      if (Number.isFinite(delta) && Math.abs(delta) >= 0.1) {
        const improved = positive ? delta >= 0 : delta <= 0;
        tone = improved ? 'is-up' : 'is-down';
      }
      const key = tone === 'is-up'
        ? 'delta.up'
        : tone === 'is-down'
          ? 'delta.down'
          : 'delta.equal';
      const fallbackLabel = tone === 'is-up'
        ? 'Up'
        : tone === 'is-down'
          ? 'Down'
          : 'No change';
      const label = window.I18N?.t?.(key) || fallbackLabel;
      return {label, className: `delta-badge ${tone}`, tone};
    }

    function buildCaption(range, team){
      return `${periodLabel(range)} • ${teamLabel(team)}`;
    }

    function rangeLabel(range){
      if (!range) return t('range.7d', '7 Days');
      if (range.preset) {
        const presetKey = displayPreset(range.preset);
        const map = {
          today: t('range.today', 'Today'),
          '7d': t('range.7d', '7 Days'),
          mtd: t('range.mtd', 'MTD'),
          qtd: t('range.qtd', 'QTD'),
          ytd: t('range.ytd', 'YTD')
        };
        return map[presetKey] || t('range.7d', '7 Days');
      }
      if (range.start && range.end) {
        const start = formatLocaleDate(range.start);
        const end = formatLocaleDate(range.end);
        if (start && start === end) return start;
        return `${start} – ${end}`;
      }
      return t('range.7d', '7 Days');
    }

    function periodLabel(range){
      const prefix = scenarioPrefix();
      const base = `${t('caption.orgAvg', 'Org avg')} • ${rangeLabel(range)}`;
      return `${prefix}${base}`;
    }

    function updateTrackerDelta(el, currentAvg, previousAvg){
      if (!el) return;
      if (!Number.isFinite(currentAvg) || !Number.isFinite(previousAvg)) {
        el.textContent = '';
        el.className = 'delta-badge';
        el.removeAttribute('aria-label');
        return;
      }
      const deltaValue = Math.round(currentAvg - previousAvg);
      const vsPrev = t('analytics.delta.vsPrev', 'vs prev');
      const prefix = deltaValue > 0 ? '+' : '';
      const direction = deltaValue > 0 ? 'is-up' : deltaValue < 0 ? 'is-down' : 'is-flat';
      const text = `${prefix}${deltaValue} ${vsPrev}`;
      el.textContent = text;
      el.className = `delta-badge ${direction}`.trim();
      el.setAttribute('aria-label', `${t('analytics.delta.aria', 'Delta vs previous period')}: ${text}`);
    }

    function sampleSize(metrics, team){
      if (!metrics) return NaN;
      if (team && team !== 'all') {
        const list = metrics?.headcount?.teams;
        if (list && typeof list === 'object' && Number.isFinite(list[team])) {
          return Number(list[team]);
        }
      }
      if (Number.isFinite(Number(metrics?.n))) {
        return Number(metrics.n);
      }
      return NaN;
    }

    function teamLabel(team){
      if (!team || team === 'all') return t('caption.teamAll', 'All teams');
      try {
        const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
        if (map && map[team]) return map[team];
      } catch (e) {}
      return team;
    }

    function readScenario(){
      try {
        const raw = localStorage.getItem('hr:scenario');
        return canonicalScenario(raw);
      } catch (err) {
        return 'live';
      }
    }

    function scenarioPrefix(){
      const key = resolvedScenarioKey || readScenario();
      if (key === 'night') return t('caption.scenarioPrefix', '');
      if (key === 'demo') return t('caption.demoPrefix', 'Demo • ');
      return '';
    }
  }

window.renderAnalyticsPage = function(){
  const boot = () => initPage();
  if (window.I18N?.onReady) {
    window.I18N.onReady(boot);
  } else {
    boot();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const lazyHost = document.querySelector('[data-mount="renderAnalyticsPage"]');
  if (!lazyHost) {
    window.renderAnalyticsPage();
  }
});
