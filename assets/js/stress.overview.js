(function(g, d){
  if (!g || !d) return;

  const THRESHOLDS = { low:[0,39], normal:[40,59], moderate:[60,79], high:[80,100] };
  const LABEL_KEYS = ['low','normal','moderate','high'];
  const MIN_SAMPLE = 10;
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  const datasetCache = new Map();
  const instances = new Map();

  function t(key, vars, fallback){
    let options = vars;
    let fallbackValue = fallback;
    if (typeof vars === 'string' || typeof vars === 'number'){
      fallbackValue = vars;
      options = undefined;
    }
    const translated = g.I18N?.t?.(key, options);
    if (typeof translated === 'string' && translated && translated !== key) {
      return translated;
    }
    if (fallbackValue != null) {
      return typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
    }
    return key;
  }

  function getLocale(){
    return g.I18N?.getLang?.() || d.documentElement.lang || 'en';
  }

  function agg(values){
    if (!Array.isArray(values) || !values.length) return null;
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function clamp(value, min = 0, max = 100){
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
  }

  function stateOf(value){
    if (value == null || Number.isNaN(value)) return null;
    const numeric = Number(value);
    for (const key of LABEL_KEYS){
      const range = THRESHOLDS[key];
      if (!range) continue;
      const [min, max] = range.map(Number);
      if (numeric >= min && numeric <= max) return key;
    }
    return null;
  }

  function computeRangeDisplay(values){
    const list = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
    if (!list.length) return '—';
    const min = Math.min(...list);
    const max = Math.max(...list);
    return `${min}–${max}`;
  }

  function formatUpdated(raw){
    if (!Array.isArray(raw) || !raw.length) return '—:—';
    let ts = new Date(raw[raw.length - 1].ts || raw[raw.length - 1].date || raw[raw.length - 1].timestamp || Date.now());
    if (!(ts instanceof Date) || Number.isNaN(ts)) ts = new Date();
    try {
      return new Intl.DateTimeFormat(getLocale(), {hour: '2-digit', minute: '2-digit'}).format(ts);
    } catch (err){
      return ts.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }
  }

  function pseudoRandom(index, seed){
    const x = Math.sin(seed * (index + 1)) * 10000;
    return x - Math.floor(x);
  }

  function generateSeries(metric){
    const now = new Date();
    const rows = [];
    const seed = metric === 'emotion' ? 1.27 : 1.73;
    const base = metric === 'emotion' ? 60 : 54;
    const amplitude = metric === 'emotion' ? 18 : 22;

    for (let h = 0; h < 60; h++){
      const ts = new Date(now.getTime() - h * HOUR_MS);
      const wave = Math.sin((h / 6) + seed) * amplitude * 0.35;
      const drift = Math.cos((h / 18) + seed * 0.6) * 6;
      const noise = (pseudoRandom(h, seed) - 0.5) * 6;
      const value = clamp(base + wave + drift + noise);
      rows.push({ ts: ts.toISOString(), value: Number(value.toFixed(2)) });
    }

    for (let d = 1; d <= 420; d++){
      const ts = new Date(now.getTime() - d * DAY_MS);
      ts.setHours(12, 0, 0, 0);
      const idx = d + 60;
      const wave = Math.sin((idx / 9) + seed) * amplitude * 0.45;
      const seasonal = Math.cos((idx / 36) + seed * 0.4) * 8;
      const trend = metric === 'emotion' ? Math.sin(idx / 140) * 4 : Math.cos(idx / 160) * -5;
      const noise = (pseudoRandom(idx, seed) - 0.5) * 7;
      const value = clamp(base + wave + seasonal + trend + noise);
      rows.push({ ts: ts.toISOString(), value: Number(value.toFixed(2)) });
    }

    return rows.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  }

  function loadMetric(metric){
    if (!datasetCache.has(metric)){
      datasetCache.set(metric, generateSeries(metric));
    }
    return Promise.resolve(datasetCache.get(metric));
  }

  function alignHour(date){
    const copy = new Date(date);
    copy.setMinutes(0, 0, 0);
    return copy;
  }

  function alignDay(date){
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function alignMonth(date){
    const copy = new Date(date);
    copy.setDate(1);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function sliceRange(raw, range){
    const sorted = Array.isArray(raw) ? raw.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts)) : [];
    if (!sorted.length){
      const now = new Date();
      return { rows: [], start: now, end: now };
    }
    let end = new Date(sorted[sorted.length - 1].ts);
    if (!(end instanceof Date) || Number.isNaN(end)) end = new Date();
    let start;
    switch(range){
      case 'day':
        end = alignHour(end);
        start = new Date(end.getTime() - 23 * HOUR_MS);
        break;
      case 'week':
        end = alignDay(end);
        start = new Date(end.getTime() - 6 * DAY_MS);
        break;
      case 'month':
        end = alignDay(end);
        start = new Date(end.getTime() - 29 * DAY_MS);
        break;
      case 'year':
        end = alignMonth(end);
        start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
        break;
      default:
        end = alignHour(end);
        start = new Date(end.getTime() - 23 * HOUR_MS);
    }
    const upper = range === 'year'
      ? new Date(end.getFullYear(), end.getMonth() + 1, 1).getTime()
      : end.getTime() + (range === 'day' ? HOUR_MS : DAY_MS);
    const startMs = start.getTime();
    const filtered = sorted.filter(entry => {
      const ts = new Date(entry.ts).getTime();
      if (Number.isNaN(ts)) return false;
      return ts >= startMs && ts < upper;
    });
    return { rows: filtered, start, end };
  }

  function formatHour(date){
    return `${String(date.getHours()).padStart(2, '0')}:00`;
  }

  function formatWeekday(date){
    try {
      return new Intl.DateTimeFormat(getLocale(), { weekday: 'short' }).format(date);
    } catch (err){
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()] || '';
    }
  }

  function formatMonthDay(date){
    return String(date.getDate());
  }

  function formatMonth(date){
    try {
      return new Intl.DateTimeFormat(getLocale(), { month: 'short' }).format(date);
    } catch (err){
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[date.getMonth()] || '';
    }
  }

  function bucketize(rows, start, count, stepMs, formatter){
    const buckets = [];
    const startMs = start.getTime();
    const arrays = Array.from({ length: count }, () => []);
    rows.forEach(entry => {
      const ts = new Date(entry.ts).getTime();
      if (Number.isNaN(ts)) return;
      const index = Math.floor((ts - startMs) / stepMs + 0.00001);
      if (index < 0 || index >= count) return;
      arrays[index].push(Number(entry.value));
    });
    for (let i = 0; i < count; i++){
      const point = new Date(startMs + i * stepMs);
      const values = arrays[i];
      const median = agg(values);
      buckets.push({ t: formatter(point), v: median });
    }
    return buckets;
  }

  function groupByHour(rows, ctx){
    const end = alignHour(ctx.end);
    const start = new Date(end.getTime() - 23 * HOUR_MS);
    return bucketize(rows, start, 24, HOUR_MS, formatHour);
  }

  function groupByDay(rows, ctx){
    const end = alignDay(ctx.end);
    const start = new Date(end.getTime() - 6 * DAY_MS);
    return bucketize(rows, start, 7, DAY_MS, formatWeekday);
  }

  function groupByDayOfMonth(rows, ctx){
    const end = alignDay(ctx.end);
    const start = new Date(end.getTime() - 29 * DAY_MS);
    return bucketize(rows, start, 30, DAY_MS, formatMonthDay);
  }

  function groupByMonth(rows, ctx){
    const end = alignMonth(ctx.end);
    const result = [];
    for (let i = 11; i >= 0; i--){
      const monthStart = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const values = [];
      rows.forEach(entry => {
        const ts = new Date(entry.ts).getTime();
        if (Number.isNaN(ts)) return;
        if (ts >= monthStart.getTime() && ts < next.getTime()){
          values.push(Number(entry.value));
        }
      });
      result.push({ t: formatMonth(monthStart), v: agg(values) });
    }
    return result;
  }

  const bucketers = {
    day: groupByHour,
    week: groupByDay,
    month: groupByDayOfMonth,
    year: groupByMonth
  };

  function getStateLabel(state){
    if (!state) return '—';
    const fallback = state.charAt(0).toUpperCase() + state.slice(1);
    return t(`stress.${state}`, fallback);
  }

  function thresholdLabelFrom(thresholds){
    const text = LABEL_KEYS.map(key => {
      const range = thresholds[key];
      if (!range) return '';
      const [min, max] = range;
      const label = getStateLabel(key);
      if (min === 0) return `<${max + 1} ${label}`;
      if (max >= 100) return `${min}+ ${label}`;
      return `${min}–${max} ${label}`;
    }).filter(Boolean);
    return text.join(', ');
  }

  function currentRangeLabel(range){
    switch(range){
      case 'week': return t('range.week', 'Week');
      case 'month': return t('range.month', 'Month');
      case 'year': return t('range.year', 'Year');
      default: return t('range.day', 'Day');
    }
  }

  function renderBars(host, buckets){
    if (!host) return;
    host.innerHTML = '';
    const wrapper = d.createElement('div');
    wrapper.className = 'so-bars';
    const track = d.createElement('div');
    track.className = 'so-bars__track';
    const labels = d.createElement('div');
    labels.className = 'so-bars__labels';
    const sr = d.createElement('div');
    sr.className = 'sr-only';
    const descId = `${host.id || 'so-chart'}-desc`;
    sr.id = descId;

    const description = [];

    buckets.forEach(bucket => {
      const bar = d.createElement('div');
      bar.className = 'so-bar';
      const fill = d.createElement('div');
      fill.className = 'so-bar__fill';
      const numeric = Number.isFinite(bucket.v) ? Math.round(bucket.v) : null;
      const state = numeric != null ? stateOf(numeric) : null;
      const label = getStateLabel(state);
      if (numeric != null){
        fill.style.height = `${Math.max(4, Math.min(100, numeric))}%`;
        fill.dataset.value = String(numeric);
        if (state) fill.classList.add(`state--${state}`);
        const tooltip = `${bucket.t}: ${numeric} — ${label}`;
        fill.title = tooltip;
        description.push(tooltip);
      } else {
        fill.style.height = '6%';
        fill.dataset.value = '—';
        fill.classList.add('is-empty');
        fill.title = `${bucket.t}: —`;
        description.push(`${bucket.t}: —`);
      }
      bar.appendChild(fill);
      track.appendChild(bar);

      const labelEl = d.createElement('span');
      labelEl.textContent = bucket.t;
      labels.appendChild(labelEl);
    });

    sr.textContent = description.join('; ');
    wrapper.appendChild(track);
    wrapper.appendChild(labels);
    wrapper.appendChild(sr);
    host.appendChild(wrapper);
    host.setAttribute('aria-describedby', descId);
  }

  function renderMetaLine(panel, range){
    const host = panel.querySelector('#so-meta-line');
    if (!host) return;
    const thresholdText = thresholdLabelFrom(THRESHOLDS);
    const period = currentRangeLabel(range);
    if (typeof g.renderSourceNote === 'function'){
      g.renderSourceNote(host, {
        sourceId: panel.getAttribute('data-source-id') || panel.dataset.sourceId,
        threshold: thresholdText,
        period
      });
    } else {
      host.textContent = `${t('source.short', 'Source')}: ${panel.getAttribute('data-source-id') || ''}`;
    }
  }

  function updateLowSample(panel, count){
    const banner = panel.querySelector('#so-low');
    if (!banner) return;
    if (count < MIN_SAMPLE){
      banner.hidden = false;
      banner.textContent = t('stress.lowSample', { n: count }, () => `Low sample size (n=${count})`);
    } else {
      banner.hidden = true;
    }
  }

  function setLoading(panel, loading){
    if (!panel) return;
    panel.classList.toggle('is-loading', !!loading);
  }

  function syncTabs(tabs, active){
    tabs.forEach(tab => {
      const isActive = tab.dataset.range === active;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function syncSegments(buttons, active){
    buttons.forEach(btn => {
      const isActive = btn.dataset.metric === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderAll(instance){
    if (!instance) return;
    const panel = instance.panel;
    const host = instance.host;
    const raw = instance.rawByMetric.get(instance.metric) || [];
    const { rows, start, end } = sliceRange(raw, instance.range);
    const bucketFn = bucketers[instance.range] || bucketers.day;
    const buckets = bucketFn(rows, { start, end }).map(entry => ({
      t: entry.t,
      v: entry.v == null ? null : Number(entry.v),
      s: entry.v == null ? null : stateOf(Number(entry.v))
    }));

    const values = buckets
      .map(entry => Number.isFinite(entry.v) ? Math.round(entry.v) : null)
      .filter(v => v != null);

    const rangeEl = panel.querySelector('#so-range');
    if (rangeEl) rangeEl.textContent = computeRangeDisplay(values);

    const lastValue = values.length ? values[values.length - 1] : null;
    const lastEl = panel.querySelector('#so-last');
    if (lastEl) lastEl.textContent = lastValue != null ? lastValue : '—';

    const pill = panel.querySelector('#so-state');
    const lastState = lastValue != null ? stateOf(lastValue) : null;
    if (pill){
      pill.textContent = lastState ? getStateLabel(lastState) : '—';
      pill.className = `pill pill--state state--${lastState || 'none'}`;
    }

    const updated = panel.querySelector('#so-updated');
    if (updated) updated.textContent = formatUpdated(raw);

    const metricLabel = t(`stress.${instance.metric}`, instance.metric === 'emotion' ? 'Emotion' : 'Stress');
    const chartLabel = `${t('stress.chartAria', 'Emotional wellbeing distribution chart')} — ${metricLabel}, ${currentRangeLabel(instance.range)}`;
    host.setAttribute('aria-label', chartLabel);

    renderBars(host, buckets);
    updateLowSample(panel, values.length);
    renderMetaLine(panel, instance.range);
  }

  function focusNext(items, currentIndex, direction){
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
          tabs[0].focus();
        } else if (event.key === 'End'){
          event.preventDefault();
          tabs[tabs.length - 1].focus();
        }
      });
    });
  }

  function handleSegmentKeys(buttons){
    buttons.forEach((btn, index) => {
      btn.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown'){
          event.preventDefault();
          focusNext(buttons, index, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp'){
          event.preventDefault();
          focusNext(buttons, index, -1);
        }
      });
    });
  }

  async function ensureData(instance, metric){
    if (!instance.rawByMetric.has(metric)){
      const data = await loadMetric(metric);
      instance.rawByMetric.set(metric, data);
    }
  }

  function setupInteractions(instance){
    const panel = instance.panel;
    const tabs = Array.from(panel.querySelectorAll('.so-tabs .tab'));
    const segments = Array.from(panel.querySelectorAll('.seg__btn'));

    syncTabs(tabs, instance.range);
    syncSegments(segments, instance.metric);
    handleTabKeys(tabs);
    handleSegmentKeys(segments);

    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        const range = tab.dataset.range || 'day';
        if (instance.range === range) return;
        instance.range = range;
        syncTabs(tabs, instance.range);
        renderAll(instance);
        renderMetaLine(instance.panel, instance.range);
      });
    });

    segments.forEach(btn => {
      btn.addEventListener('click', async () => {
        const metric = btn.dataset.metric || 'stress';
        if (instance.metric === metric) return;
        syncSegments(segments, metric);
        instance.metric = metric;
        setLoading(panel, true);
        await ensureData(instance, metric);
        setLoading(panel, false);
        renderAll(instance);
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
      metric: 'emotion',
      rawByMetric: new Map()
    };
    instances.set(hostId, instance);

    setLoading(panel, true);
    await ensureData(instance, instance.metric);
    setLoading(panel, false);
    setupInteractions(instance);
    renderAll(instance);
  }

  g.addEventListener?.('i18n:change', () => {
    instances.forEach(instance => renderAll(instance));
  });

  g.addEventListener?.('resize', () => {
    instances.forEach(instance => renderAll(instance));
  });

  g.StressOverview = {
    mount,
    thresholds: THRESHOLDS,
    stateOf,
    thresholdLabelFrom,
    computeRangeDisplay
  };
})(window, document);
