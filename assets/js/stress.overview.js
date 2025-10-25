(function(g, d){
  if (!g || !d) return;

  const THRESHOLDS = { low: [0, 39], normal: [40, 59], moderate: [60, 79], high: [80, 100] };
  const chartRefs = new Map();
  const instances = new Map();
  let chartPromise = null;
  let availableDaysPromise = null;
  const LOG_PREFIX = '[Analytics]';

  if (typeof g.dataLoader?.clear === 'function'){
    const originalClear = g.dataLoader.clear.bind(g.dataLoader);
    g.dataLoader.clear = (...args) => {
      availableDaysPromise = null;
      return originalClear(...args);
    };
  }

  function t(key, fallback){
    if (!key) return fallback;
    const translated = g.I18N?.t?.(key);
    if (typeof translated === 'string' && translated && translated !== key) {
      return translated;
    }
    return typeof fallback === 'function' ? fallback() : (fallback ?? key);
  }

  function currentDayISO(date = new Date()){
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  }

  function emptyStateMessage(){
    return t('stress.emptyState', 'No stress data for the selected period.');
  }

  function resolveHost(host){
    if (typeof host === 'string') {
      return d.getElementById(host);
    }
    return host;
  }

  function showChartSkeleton(host){
    const el = resolveHost(host);
    if (!el) return;
    const prev = chartRefs.get(el);
    if (prev?.destroy) prev.destroy();
    chartRefs.delete(el);
    el.innerHTML = '<div class="skeleton-bar" aria-hidden="true"></div>';
    el.classList.add('is-skeleton');
  }

  function hideEmptyState(host){
    const el = resolveHost(host);
    if (!el) return;
    if (el.firstElementChild?.classList.contains('empty-state')) {
      el.innerHTML = '';
    }
    el.classList.remove('is-skeleton');
  }

  function showEmptyState(host, message){
    const el = resolveHost(host);
    if (!el) return;
    const prev = chartRefs.get(el);
    if (prev?.destroy) prev.destroy();
    chartRefs.delete(el);
    el.innerHTML = '';
    const block = d.createElement('div');
    block.className = 'empty-state';
    block.setAttribute('role', 'status');
    block.textContent = message;
    el.appendChild(block);
    el.classList.remove('is-skeleton');
  }

  async function ensureChart(){
    if (g.Chart) return g.Chart;
    if (chartPromise) return chartPromise;
    chartPromise = new Promise((resolve, reject) => {
      const script = d.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => resolve(g.Chart);
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      d.head.appendChild(script);
    }).catch(err => {
      console.error(`${LOG_PREFIX} Failed to load Chart.js`, err);
      chartPromise = null;
      throw err;
    });
    return chartPromise;
  }

  function normaliseDayISO(dayISO){
    if (!dayISO) return null;
    if (typeof dayISO !== 'string') return null;
    const match = dayISO.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [ , year, month, day ] = match;
    return `${year}-${month}-${day}`;
  }

  function ensureFallbackNote(panel){
    if (!panel) return null;
    let note = panel.querySelector('#so-fallback');
    if (!note) {
      note = d.createElement('div');
      note.id = 'so-fallback';
      note.className = 'panel__note note note--info so-fallback';
      note.hidden = true;
      const meta = panel.querySelector('#so-meta-line');
      if (meta?.parentNode) {
        meta.insertAdjacentElement('afterend', note);
      } else {
        panel.appendChild(note);
      }
    }
    return note;
  }

  function updateFallbackNote(panel, requested, actual){
    const note = ensureFallbackNote(panel);
    if (!note) return;
    const req = normaliseDayISO(requested);
    const act = normaliseDayISO(actual);
    if (!req || !act || req === act) {
      note.hidden = true;
      note.textContent = '';
      return;
    }
    const label = t('stress.fallbackShowing', 'Showing');
    const nearest = t('stress.fallbackNearest', 'nearest available');
    note.textContent = `${label}: ${act} (${nearest})`;
    note.hidden = false;
  }

  async function loadAvailableDays(){
    if (!availableDaysPromise){
      availableDaysPromise = (async () => {
        try {
          const payload = typeof g.dataLoader?.loadIndex === 'function'
            ? await g.dataLoader.loadIndex()
            : await g.API?.fetchJSON?.('/data/stress/raw/index.json');
          if (!payload) return [];
          const list = Array.isArray(payload?.days) ? payload.days : Array.isArray(payload) ? payload : [];
          const uniques = Array.from(new Set(list.map(normaliseDayISO).filter(Boolean)));
          return uniques.sort((a, b) => {
            const timeA = new Date(a).getTime();
            const timeB = new Date(b).getTime();
            if (!Number.isFinite(timeA) && !Number.isFinite(timeB)) return 0;
            if (!Number.isFinite(timeA)) return 1;
            if (!Number.isFinite(timeB)) return -1;
            return timeB - timeA;
          });
        } catch (err){
          console.error(`${LOG_PREFIX} Failed to load stress day index`, err);
          return [];
        }
      })();
    }
    return availableDaysPromise;
  }

  async function resolveAvailableDay(dayISO){
    const available = await loadAvailableDays();
    if (!available.length) return normaliseDayISO(dayISO);
    const target = normaliseDayISO(dayISO);
    if (target && available.includes(target)) return target;
    const targetTime = target ? new Date(target).getTime() : Number.NaN;
    if (Number.isFinite(targetTime)){
      const found = available.find(day => {
        const time = new Date(day).getTime();
        return Number.isFinite(time) && time <= targetTime;
      });
      if (found) return found;
    }
    return available[0];
  }

  async function loadStressRawDay(dayISO, teamId){
    const requestedISO = normaliseDayISO(dayISO) || currentDayISO();

    const loadPayload = async iso => {
      if (!iso) return null;
      if (typeof g.dataLoader?.loadDayJson === 'function') {
        try {
          return await g.dataLoader.loadDayJson(iso);
        } catch (err) {
          console.error(`${LOG_PREFIX} Failed to load stress day`, { iso, err });
          return null;
        }
      }
      try {
        return await g.API?.fetchJSON?.(`/data/stress/raw/${iso}.json`);
      } catch (err) {
        const message = String(err?.message || '');
        if (/404/.test(message)) {
          console.warn(`${LOG_PREFIX} Data not found:`, `/data/stress/raw/${iso}.json`);
          return null;
        }
        console.error(`${LOG_PREFIX} Failed to load stress day`, { iso, err });
        return null;
      }
    };

    const candidates = [];
    if (requestedISO) candidates.push(requestedISO);

    let payload = await loadPayload(requestedISO);
    if (!payload){
      const available = await loadAvailableDays();
      const normalized = available.filter(Boolean);
      if (requestedISO){
        const targetTime = new Date(requestedISO).getTime();
        if (Number.isFinite(targetTime)) {
          const nearest = normalized.find(day => {
            const time = new Date(day).getTime();
            return Number.isFinite(time) && time <= targetTime;
          });
          if (nearest && !candidates.includes(nearest)) {
            candidates.push(nearest);
          }
        }
      }
      for (const day of normalized) {
        if (!candidates.includes(day)) {
          candidates.push(day);
        }
      }
    }

    let resolvedDay = null;
    let fallbackISO = null;
    for (const candidate of candidates){
      const normalised = normaliseDayISO(candidate);
      if (!normalised) continue;
      const result = await loadPayload(normalised);
      if (result){
        payload = result;
        resolvedDay = normalised;
        if (requestedISO && normalised !== requestedISO) {
          fallbackISO = normalised;
        }
        break;
      }
      if (!resolvedDay) {
        resolvedDay = normalised;
      }
      if (requestedISO && normalised !== requestedISO && !fallbackISO) {
        fallbackISO = normalised;
      }
    }

    if (!payload){
      const empty = [];
      empty.dayISO = resolvedDay || null;
      empty.requestedISO = requestedISO;
      empty.fallbackISO = fallbackISO && fallbackISO !== requestedISO ? fallbackISO : null;
      empty.updatedISO = null;
      empty.isMissing = true;
      return empty;
    }

    const rawRows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    const filtered = rawRows
      .filter(entry => entry && entry.on === true && (!teamId || entry.team === teamId))
      .map(entry => ({
        uid: String(entry.uid ?? ''),
        ts: entry.ts,
        value: Number(entry.value),
        on: true,
        team: entry.team
      }))
      .filter(entry => entry.uid && entry.ts && Number.isFinite(entry.value))
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));

    const lastRowTs = filtered.length ? filtered[filtered.length - 1].ts : rawRows[rawRows.length - 1]?.ts;
    const updatedISO = typeof payload?.updated_at === 'string'
      ? payload.updated_at
      : lastRowTs || (resolvedDay ? `${resolvedDay}T00:00:00Z` : null);

    filtered.dayISO = resolvedDay || requestedISO || null;
    filtered.requestedISO = requestedISO;
    filtered.fallbackISO = fallbackISO && fallbackISO !== requestedISO ? fallbackISO : null;
    filtered.updatedISO = updatedISO;
    filtered.payload = payload;
    return filtered;
  }

  function bucketHourly(rows, tz = Intl.DateTimeFormat().resolvedOptions().timeZone){
    const formatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz });
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      h,
      values: [],
      uids: new Set(),
      sampleN: 0,
      modN: 0,
      highN: 0
    }));
    for (const row of rows){
      if (!row || !row.ts) continue;
      const date = new Date(row.ts);
      if (Number.isNaN(date.getTime())) continue;
      const hour = formatter.format(date);
      const idx = Number.parseInt(hour, 10);
      if (!Number.isFinite(idx) || idx < 0 || idx > 23) continue;
      const bucket = buckets[idx];
      const value = Number(row.value);
      if (!Number.isFinite(value)) continue;
      bucket.values.push(value);
      bucket.sampleN += 1;
      bucket.uids.add(row.uid);
      if (value >= 60) bucket.modN += 1;
      if (value >= 80) bucket.highN += 1;
    }
    return buckets.map(bucket => {
      if (!bucket.values.length){
        return {
          t: `${String(bucket.h).padStart(2, '0')}:00`,
          avg: null,
          n: 0,
          sampleN: 0,
          modN: 0,
          highN: 0
        };
      }
      const avg = Math.round(bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length);
      return {
        t: `${String(bucket.h).padStart(2, '0')}:00`,
        avg,
        n: bucket.uids.size,
        sampleN: bucket.sampleN,
        modN: bucket.modN,
        highN: bucket.highN
      };
    });
  }

  function stateOf(value){
    if (value == null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const entry = Object.entries(THRESHOLDS).find(([, [min, max]]) => numeric >= min && numeric <= max);
    return entry ? entry[0] : 'normal';
  }

  function colorOf(state){
    const styles = getComputedStyle(d.documentElement);
    return {
      low: styles.getPropertyValue('--stress-low').trim(),
      normal: styles.getPropertyValue('--stress-normal').trim(),
      moderate: styles.getPropertyValue('--stress-moderate').trim(),
      high: styles.getPropertyValue('--stress-high').trim()
    }[state || 'normal'] || styles.getPropertyValue('--stress-normal').trim() || '#2ec27e';
  }

  function anomaliesSummary(bucket){
    const total = Math.max(1, bucket.sampleN ?? bucket.n ?? 0);
    const highShare = (bucket.highN ?? 0) / total;
    const modShare = (bucket.modN ?? 0) / total;
    if (highShare >= 0.3) return { level: 'high', text: t('stress.anomHigh', 'Anomalies: many high') };
    if (modShare >= 0.5) return { level: 'moderate', text: t('stress.anomModerate', 'Anomalies: elevated') };
    return { level: 'none', text: t('stress.anomNone', 'No anomalies detected') };
  }

  function burnoutHint(){
    return t('stress.burnoutNone', 'No burnout pattern detected');
  }

  function hourlyTooltipCb(buckets){
    return ctx => {
      const idx = ctx?.dataIndex;
      if (idx == null) return '';
      const bucket = buckets[idx];
      if (!bucket) return '';
      const avg = bucket.avg ?? '—';
      const state = stateOf(bucket.avg);
      const stateLabel = state ? t(`stress.${state}`, state) : t('stress.normal', 'Normal');
      const anomalies = anomaliesSummary(bucket);
      const burnout = burnoutHint(bucket);
      return [
        `${ctx.label}`,
        `${t('stress.connected', 'Connected')}: ${bucket.n}`,
        `${t('stress.avg', 'Avg stress')}: ${avg} ${avg !== '—' ? `(${stateLabel})` : ''}`.trim(),
        anomalies.text,
        burnout
      ];
    };
  }

  function thresholdLabelFrom(){
    return Object.entries(THRESHOLDS)
      .map(([state, [min, max]]) => {
        const label = t(`stress.${state}`, state.charAt(0).toUpperCase() + state.slice(1));
        if (min === 0) return `<${max + 1} ${label}`;
        if (max >= 100) return `${min}+ ${label}`;
        return `${min}–${max} ${label}`;
      })
      .join(', ');
  }

  function formatTimeLocal(iso){
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat(g.I18N?.getLang?.() || d.documentElement.lang || 'en', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (err){
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  function updateHeaderFromBuckets(buckets, updatedISO){
    const values = buckets.map(bucket => bucket.avg).filter(value => Number.isFinite(value));
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    const lastIndex = [...buckets].reverse().findIndex(bucket => Number.isFinite(bucket.avg));
    const lastValue = lastIndex >= 0 ? buckets[buckets.length - 1 - lastIndex].avg : null;
    const rangeEl = d.getElementById('so-range');
    if (rangeEl) rangeEl.textContent = values.length ? `${min}–${max}` : '—';
    const lastEl = d.getElementById('so-last');
    if (lastEl) lastEl.textContent = lastValue ?? '—';
    const pill = d.getElementById('so-state');
    const state = stateOf(lastValue);
    if (pill){
      pill.textContent = state ? t(`stress.${state}`, state) : '—';
      pill.className = `pill pill--state state--${state || 'normal'}`;
    }
    const updatedEl = d.getElementById('so-updated');
    if (updatedEl) updatedEl.textContent = updatedISO ? formatTimeLocal(updatedISO) : '—';
  }

  function updateLowNBanner(buckets){
    const banner = d.getElementById('so-lowN') || d.getElementById('so-low');
    if (!banner) return;
    if (!Array.isArray(buckets) || !buckets.some(bucket => (bucket?.n || 0) > 0)){
      banner.setAttribute('hidden', '');
      banner.style.display = 'none';
      return;
    }
    const totalN = buckets.reduce((sum, bucket) => sum + (bucket.n || 0), 0);
    const hoursWithData = buckets.filter(bucket => (bucket.n || 0) > 0).length;
    if (totalN < 20 || hoursWithData < 4){
      banner.innerHTML = t('stats.lowSample', 'Low sample size — interpret with caution');
      banner.removeAttribute('hidden');
      banner.style.display = 'block';
    } else {
      banner.setAttribute('hidden', '');
      banner.style.display = 'none';
    }
  }

  function renderMetaLine(panel, range){
    const host = panel?.querySelector('#so-meta-line');
    if (!host) return;
    const threshold = thresholdLabelFrom();
    const period = t(`range.${range}`, range.charAt(0).toUpperCase() + range.slice(1));
    if (typeof g.renderSourceNote === 'function'){
      g.renderSourceNote(host, {
        sourceId: panel.getAttribute('data-source-id') || panel.dataset.sourceId,
        threshold,
        period
      });
    } else {
      host.textContent = `${t('source.short', 'Source')}: ${threshold}`;
    }
  }

  function setLoading(panel, loading){
    if (!panel) return;
    panel.classList.toggle('is-loading', !!loading);
  }

  async function renderHourlyChart(hostId, buckets){
    const ChartCtor = await ensureChart();
    const el = typeof hostId === 'string' ? d.getElementById(hostId) : hostId;
    if (!el) return null;
    hideEmptyState(el);
    el.classList.remove('is-skeleton');
    el.innerHTML = '<canvas></canvas>';
    const canvas = el.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const labels = buckets.map(bucket => bucket.t);
    const values = buckets.map(bucket => bucket.avg);
    const colors = buckets.map(bucket => colorOf(stateOf(bucket.avg)));
    const tooltipCallback = hourlyTooltipCb(buckets);

    const prev = chartRefs.get(el);
    if (prev?.destroy) prev.destroy();

    const chart = new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.9
        }]
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: tooltipCallback
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25 }
          },
          x: {
            grid: { display: false },
            ticks: { autoSkip: false, maxRotation: 0 }
          }
        }
      }
    });

    chartRefs.set(el, chart);
    return chart;
  }

  function stopAutoRefresh(instance){
    if (instance?.timer){
      clearInterval(instance.timer);
      instance.timer = null;
    }
  }

  async function refreshDay(instance, options = {}){
    const { updatedISO } = options;
    if (!instance.buckets?.length) {
      showChartSkeleton(instance.host);
    }
    const requestedISO = instance.requestedISO || instance.dayISO;
    const raw = await loadStressRawDay(requestedISO, instance.teamId);
    if (raw?.dayISO) {
      instance.dayISO = raw.dayISO;
    }
    instance.requestedISO = raw?.requestedISO || requestedISO;
    const rows = Array.isArray(raw) ? raw : [];
    const buckets = bucketHourly(rows, instance.timeZone);
    instance.buckets = buckets;

    const lastTs = raw?.updatedISO || (rows.length ? rows[rows.length - 1].ts : updatedISO);
    const resolvedUpdated = lastTs || new Date().toISOString();

    if (!rows.length){
      showEmptyState(instance.host, emptyStateMessage());
      updateLowNBanner([]);
    } else {
      await renderHourlyChart(instance.host, buckets);
      updateLowNBanner(buckets);
    }

    updateHeaderFromBuckets(buckets, resolvedUpdated);
    updateFallbackNote(instance.panel, raw?.requestedISO || requestedISO, raw?.dayISO);
    renderMetaLine(instance.panel, instance.range);
  }

  function startAutoRefresh(instance){
    stopAutoRefresh(instance);
    instance.timer = setInterval(() => {
      refreshDay(instance, { updatedISO: new Date().toISOString() }).catch(err => {
        console.error(`${LOG_PREFIX} Auto-refresh failed`, err);
      });
    }, 60000);
  }

  async function renderInstance(instance){
    if (!instance) return;
    if (instance.range !== 'day'){
      stopAutoRefresh(instance);
    }
    if (instance.range === 'day'){
      await refreshDay(instance);
      startAutoRefresh(instance);
      return;
    }
    await refreshDay(instance);
  }

  function syncTabs(tabs, active){
    tabs.forEach(tab => {
      const isActive = tab.dataset.range === active;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function focusNext(items, currentIndex, direction){
    if (!items.length) return;
    const max = items.length - 1;
    let index = currentIndex + direction;
    if (index > max) index = 0;
    if (index < 0) index = max;
    items[index].focus();
  }

  function handleTabKeys(tabs){
    tabs.forEach((tab, index) => {
      tab.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown'){
          event.preventDefault();
          focusNext(tabs, index, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp'){
          event.preventDefault();
          focusNext(tabs, index, -1);
        } else if (event.key === 'Home'){
          event.preventDefault();
          tabs[0]?.focus();
        } else if (event.key === 'End'){
          event.preventDefault();
          tabs[tabs.length - 1]?.focus();
        }
      });
    });
  }

  function setupInteractions(instance){
    const panel = instance.panel;
    const tabs = Array.from(panel.querySelectorAll('.so-tabs .tab'));
    syncTabs(tabs, instance.range);
    handleTabKeys(tabs);
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        const range = tab.dataset.range || 'day';
        if (instance.range === range) return;
        instance.range = range;
        syncTabs(tabs, range);
        setLoading(panel, true);
        try {
          await renderInstance(instance);
        } finally {
          setLoading(panel, false);
        }
      });
    });
  }

  async function mount(hostId = 'so-chart', initialRange = 'day'){
    const host = typeof hostId === 'string' ? d.getElementById(hostId) : hostId;
    if (!host) return;
    const panel = host.closest('.panel--stress') || d.querySelector('.panel--stress');
    if (!panel) return;

    host.setAttribute('role', 'img');
    host.setAttribute('aria-live', 'polite');

    const instance = {
      host,
      panel,
      range: initialRange || 'day',
      teamId: panel.getAttribute('data-team') || panel.dataset.team,
      dayISO: currentDayISO(),
      requestedISO: currentDayISO(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timer: null,
      buckets: []
    };

    instances.set(hostId, instance);

    ensureFallbackNote(panel);

    setLoading(panel, true);
    try {
      await ensureChart();
      setupInteractions(instance);
      await renderInstance(instance);
    } catch (err){
      console.error(`${LOG_PREFIX} Failed to mount stress overview`, err);
    } finally {
      setLoading(panel, false);
    }
  }

  g.addEventListener?.('i18n:change', () => {
    instances.forEach(instance => {
      if (!instance) return;
      if (instance.buckets?.length){
        renderHourlyChart(instance.host, instance.buckets).catch(err => console.error(`${LOG_PREFIX} Chart render failed`, err));
        updateHeaderFromBuckets(instance.buckets, new Date().toISOString());
        updateLowNBanner(instance.buckets);
        renderMetaLine(instance.panel, instance.range);
        updateFallbackNote(instance.panel, instance.requestedISO, instance.dayISO);
      } else {
        renderInstance(instance).catch(err => console.error(`${LOG_PREFIX} Refresh failed`, err));
      }
    });
  });

  g.StressOverview = {
    mount,
    loadStressRawDay,
    bucketHourly,
    stateOf,
    colorOf,
    anomaliesSummary
  };
})(window, document);
