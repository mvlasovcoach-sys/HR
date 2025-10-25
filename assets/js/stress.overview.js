(function(g, d){
  if (!g || !d) return;

  const THRESHOLDS = { low: [0, 39], normal: [40, 59], moderate: [60, 79], high: [80, 100] };
  const chartRefs = new Map();
  const instances = new Map();
  let chartPromise = null;

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
      console.error(err);
      chartPromise = null;
      throw err;
    });
    return chartPromise;
  }

  async function loadStressRawDay(dayISO, teamId){
    if (!dayISO) return [];
    try {
      const data = await g.API?.fetchJSON?.(`/data/stress/raw/${dayISO}.json`);
      const rows = Array.isArray(data) ? data : [];
      return rows
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
    } catch (err){
      console.error('Failed to load stress raw day', err);
      return [];
    }
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
    const raw = await loadStressRawDay(instance.dayISO, instance.teamId);
    const buckets = bucketHourly(raw, instance.timeZone);
    instance.buckets = buckets;
    await renderHourlyChart(instance.host, buckets);
    const lastTs = raw.length ? raw[raw.length - 1].ts : updatedISO;
    updateHeaderFromBuckets(buckets, lastTs || new Date().toISOString());
    updateLowNBanner(buckets);
    renderMetaLine(instance.panel, instance.range);
  }

  function startAutoRefresh(instance){
    stopAutoRefresh(instance);
    instance.timer = setInterval(() => {
      refreshDay(instance, { updatedISO: new Date().toISOString() }).catch(err => {
        console.error('Auto-refresh failed', err);
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
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timer: null,
      buckets: []
    };

    instances.set(hostId, instance);

    setLoading(panel, true);
    try {
      await ensureChart();
      setupInteractions(instance);
      await renderInstance(instance);
    } catch (err){
      console.error('Failed to mount stress overview', err);
    } finally {
      setLoading(panel, false);
    }
  }

  g.addEventListener?.('i18n:change', () => {
    instances.forEach(instance => {
      if (!instance) return;
      if (instance.buckets?.length){
        renderHourlyChart(instance.host, instance.buckets).catch(err => console.error(err));
        updateHeaderFromBuckets(instance.buckets, new Date().toISOString());
        updateLowNBanner(instance.buckets);
        renderMetaLine(instance.panel, instance.range);
      } else {
        renderInstance(instance).catch(err => console.error(err));
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
