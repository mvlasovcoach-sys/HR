import { loadIndex, loadDay } from './data-loader.js';

const THRESHOLDS = {
  low: [0, 39],
  normal: [40, 59],
  moderate: [60, 79],
  high: [80, 100]
};

const state = {
  range: 'day',
  date: todayISO(),
  index: null,
  data: null,
  actualDate: null
};

const dayCache = new Map();
const aggregateCache = new Map();
let chartPromise = null;
let chartInstance = null;

const elements = {
  panel: null,
  chartHost: null,
  skeleton: null,
  rangeValue: null,
  lastValue: null,
  statePill: null,
  updated: null,
  sample: null,
  metaLine: null,
  fallback: null,
  lowSample: null
};

function todayISO(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function translate(key, fallback) {
  try {
    const fn = globalThis.I18N?.t;
    if (typeof fn === 'function') {
      const result = fn(key, fallback);
      if (typeof result === 'string' && result.trim()) {
        return result;
      }
    }
  } catch (err) {
    // ignore translation errors
  }
  return fallback;
}

function initElements() {
  elements.panel = document.querySelector('.panel--stress');
  elements.chartHost = document.getElementById('so-chart');
  elements.skeleton = elements.panel?.querySelector('.so-skeleton');
  elements.rangeValue = document.getElementById('so-range');
  elements.lastValue = document.getElementById('so-last');
  elements.statePill = document.getElementById('so-state');
  elements.updated = document.getElementById('so-updated');
  elements.sample = document.getElementById('stress-sample');
  elements.metaLine = document.getElementById('so-meta-line');
  elements.fallback = ensureFallbackNote(elements.panel);
  elements.lowSample = document.getElementById('so-low');
}

function ensureFallbackNote(panel) {
  if (!panel) return null;
  let note = panel.querySelector('#so-fallback');
  if (note) return note;
  note = document.createElement('div');
  note.id = 'so-fallback';
  note.className = 'panel__note note note--info';
  note.hidden = true;
  const meta = panel.querySelector('#so-meta-line');
  if (meta) {
    meta.insertAdjacentElement('afterend', note);
  } else {
    panel.appendChild(note);
  }
  return note;
}

export function initStressTabs() {
  initElements();
  if (!elements.chartHost || !elements.panel) return;

  const params = new URLSearchParams(location.search);
  state.range = params.get('range') || 'day';

  const buttons = Array.from(document.querySelectorAll('[data-range]'));
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      setRange(btn.dataset.range).catch(err => {
        console.error('[Analytics] Failed to switch stress range', err);
      });
    });
  });

  handleTabKeys(buttons);
  setRange(state.range, { pushUrl: false }).catch(err => {
    console.error('[Analytics] Failed to initialise stress tabs', err);
  });
}

function handleTabKeys(tabs) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusNext(tabs, index, 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusNext(tabs, index, -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        tabs[0]?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        tabs[tabs.length - 1]?.focus();
      }
    });
  });
}

function focusNext(items, currentIndex, direction) {
  if (!items.length) return;
  const max = items.length - 1;
  let index = currentIndex + direction;
  if (index > max) index = 0;
  if (index < 0) index = max;
  items[index].focus();
}

async function setRange(range, { pushUrl = true } = {}) {
  if (!range) return;
  state.range = range;
  markActive(range);
  showSkeleton();

  try {
    if (!state.index) {
      state.index = await ensureIndex();
    }
    const data = await resolveDataForRange(range, state.date, state.index);
    if (!data) {
      showEmpty('No stress data for the selected period.');
      state.data = null;
      return;
    }

    state.data = data;
    state.actualDate = data.meta.actualDate || state.date;
    hideSkeleton();
    renderMeta(data);
    renderLowSample(data);
    await renderStressChart(data);

    if (pushUrl) {
      const sp = new URLSearchParams(location.search);
      sp.set('range', range);
      const query = sp.toString();
      const nextUrl = query ? `${location.pathname}?${query}` : location.pathname;
      history.replaceState({}, '', nextUrl);
    }
  } catch (err) {
    console.error('[Analytics] Failed to load stress data', err);
    showEmpty('No stress data for the selected period.');
  }
}

function markActive(range) {
  document.querySelectorAll('[data-range]').forEach(el => {
    const on = el.dataset.range === range;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', String(on));
    el.setAttribute('tabindex', on ? '0' : '-1');
    el.setAttribute('aria-pressed', String(on));
  });
}

function showSkeleton() {
  if (elements.chartHost) {
    elements.chartHost.innerHTML = '';
    elements.chartHost.classList.add('is-skeleton');
  }
  if (elements.skeleton) {
    elements.skeleton.hidden = false;
  }
  showInfo();
}

function hideSkeleton() {
  if (elements.chartHost) {
    elements.chartHost.classList.remove('is-skeleton');
  }
  if (elements.skeleton) {
    elements.skeleton.hidden = true;
  }
}

function showEmpty(message) {
  hideSkeleton();
  if (elements.chartHost) {
    elements.chartHost.innerHTML = '';
    const block = document.createElement('div');
    block.className = 'empty-state';
    block.textContent = message;
    elements.chartHost.append(block);
  }
  showInfo();
  renderLowBanner(false);
}

function showInfo(message) {
  if (!elements.fallback) return;
  if (!message) {
    elements.fallback.hidden = true;
    elements.fallback.textContent = '';
    return;
  }
  elements.fallback.textContent = message;
  elements.fallback.hidden = false;
}

function renderMeta(data) {
  const buckets = data.buckets;
  const values = buckets.map(bucket => bucket.avg).filter(value => Number.isFinite(value));
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const lastValue = getLastValue(buckets);
  const stateLabel = stateOf(lastValue);

  if (elements.rangeValue) {
    elements.rangeValue.textContent = values.length ? `${min}–${max}` : '—';
  }
  if (elements.lastValue) {
    elements.lastValue.textContent = lastValue ?? '—';
  }
  if (elements.statePill) {
    const stateText = stateLabel ? capitalise(stateLabel) : '—';
    elements.statePill.textContent = stateText;
    elements.statePill.className = `pill pill--state state--${stateLabel || 'normal'}`;
  }
  if (elements.updated) {
    elements.updated.textContent = formatTime(data.meta.updatedAt);
  }
  if (elements.sample) {
    const nValue = data.meta?.nUsers;
    elements.sample.textContent = Number.isFinite(nValue) ? `n=${nValue}` : 'n=—';
  }

  renderMetaLine(data);
}

function renderMetaLine(data) {
  if (!elements.metaLine) return;
  const selected = typeof state.date === 'string' ? state.date.trim() : '';
  const actual = typeof data?.meta?.actualDate === 'string' ? data.meta.actualDate.trim() : '';
  const prefix = translate('stress.meta.showing', 'Showing');
  const nearestLabel = translate('stress.meta.nearest', 'nearest available');

  let message = '';
  if (actual) {
    if (selected && actual !== selected) {
      message = `${prefix} ${actual} (${nearestLabel})`;
    } else {
      message = `${prefix} ${actual}`;
    }
  } else if (selected) {
    message = `${prefix} ${selected}`;
  }

  const finalMessage = message.trim();
  elements.metaLine.textContent = finalMessage;
  elements.metaLine.hidden = finalMessage === '';
}

function renderLowSample(data) {
  if (!elements.lowSample) return;
  renderLowBanner(shouldShowLowSample(data));
}

function shouldShowLowSample(data) {
  if (!data) return false;
  const ratio = coverageRatio(data);
  if (ratio !== null) {
    return ratio >= 0 && ratio < 0.1;
  }

  const total = totalSamples(data);
  if (!Number.isFinite(total)) return false;
  if (total <= 0) return false;
  const hasData = data.buckets.some(bucket => {
    const value = Number(bucket.sampleN ?? bucket.n ?? 0);
    return Number.isFinite(value) && value > 0;
  });
  if (!hasData) return false;
  return total < 20;
}

function coverageRatio(data) {
  const meta = data?.meta || {};
  const directKeys = ['sampleRate', 'coverage', 'sampleCoverage', 'nRate', 'nShare'];
  for (const key of directKeys) {
    const ratio = normaliseRate(meta[key]);
    if (ratio !== null) return ratio;
  }

  const headcount = getHeadcount();
  const nUsers = Number(meta.nUsers);
  if (Number.isFinite(headcount) && headcount > 0 && Number.isFinite(nUsers) && nUsers >= 0) {
    return nUsers / headcount;
  }

  const sampleN = Number(meta.sampleN);
  if (Number.isFinite(sampleN) && sampleN >= 0) {
    const populationKeys = ['population', 'totalUsers', 'devicesIssued', 'deviceTotal', 'participantTotal'];
    for (const key of populationKeys) {
      const base = Number(meta[key]);
      if (Number.isFinite(base) && base > 0) {
        return sampleN / base;
      }
    }
  }

  return null;
}

function normaliseRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return null;
  if (num <= 1) return num;
  if (num <= 100) return num / 100;
  return null;
}

function totalSamples(data) {
  if (!data) return null;
  const metaTotal = Number(data.meta?.sampleN);
  if (Number.isFinite(metaTotal) && metaTotal >= 0) {
    return metaTotal;
  }
  return data.buckets.reduce((sum, bucket) => {
    const value = Number(bucket.sampleN ?? bucket.n ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function getHeadcount() {
  const site = globalThis.SITE;
  if (!site) return null;
  const sources = [site?.totals?.headcount, site?.raw?.headcount, site?.raw?.devicesIssued];
  for (const value of sources) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  return null;
}

function renderLowBanner(show) {
  if (!elements.lowSample) return;
  if (show) {
    elements.lowSample.removeAttribute('hidden');
    elements.lowSample.style.display = 'block';
  } else {
    elements.lowSample.setAttribute('hidden', '');
    elements.lowSample.style.display = 'none';
  }
}

function getLastValue(buckets) {
  const copy = [...buckets].reverse();
  for (const bucket of copy) {
    if (Number.isFinite(bucket.avg)) return bucket.avg;
  }
  return null;
}

function capitalise(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  try {
    const locale = document.documentElement.lang || 'en';
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch (err) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function stateOf(value) {
  if (!Number.isFinite(value)) return null;
  const entry = Object.entries(THRESHOLDS).find(([, [min, max]]) => value >= min && value <= max);
  return entry ? entry[0] : null;
}

function colorOf(state) {
  const styles = getComputedStyle(document.documentElement);
  const map = {
    low: styles.getPropertyValue('--stress-low').trim(),
    normal: styles.getPropertyValue('--stress-normal').trim(),
    moderate: styles.getPropertyValue('--stress-moderate').trim(),
    high: styles.getPropertyValue('--stress-high').trim()
  };
  return map[state || 'normal'] || '#2ec27e';
}

async function ensureChart() {
  if (window.Chart) return window.Chart;
  if (!chartPromise) {
    chartPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => resolve(window.Chart);
      script.onerror = err => reject(err);
      document.head.appendChild(script);
    });
  }
  try {
    return await chartPromise;
  } catch (err) {
    chartPromise = null;
    throw err;
  }
}

async function renderStressChart(data) {
  const Chart = await ensureChart();
  if (!elements.chartHost) return;
  elements.chartHost.innerHTML = '';
  const canvas = document.createElement('canvas');
  elements.chartHost.append(canvas);

  const context = canvas.getContext('2d');
  const labels = data.labels;
  const values = data.values;
  const colors = data.buckets.map(bucket => colorOf(stateOf(bucket.avg)));

  const tooltipFormatter = tooltipCallback(data);
  const axis = axisLabels(data.range);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg stress',
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          barPercentage: 0.75,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          title: { display: true, text: 'Stress score (0–100)' },
          ticks: { maxTicksLimit: 8 }
        },
        x: {
          title: { display: true, text: axis.x },
          ticks: { maxTicksLimit: 8 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: tooltipFormatter
          }
        }
      }
    }
  });
}

function tooltipCallback(data) {
  return context => {
    const index = context.dataIndex;
    const bucket = data.buckets[index];
    if (!bucket) return '';
    const connected = bucket.n ?? bucket.sampleN ?? 0;
    const avg = Number.isFinite(bucket.avg) ? bucket.avg : '—';
    const anomalies = bucket.anomalies > 0 ? bucket.anomalies : 'none';
    return [
      `${context.label}`,
      `Connected: ${connected}`,
      `Avg stress: ${avg}`,
      `Anomalies: ${anomalies}`
    ];
  };
}

function axisLabels(range) {
  switch (range) {
    case 'month':
      return { x: 'Day of month' };
    case 'year':
      return { x: 'Month' };
    default:
      return { x: 'Hour (00–23)' };
  }
}

async function ensureIndex() {
  const index = await loadIndex();
  const list = Array.isArray(index?.dates)
    ? index.dates
    : Array.isArray(index?.days)
      ? index.days
      : [];
  const dates = list
    .map(value => (typeof value === 'string' ? value.slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  return { dates };
}

async function resolveDataForRange(range, iso, index) {
  if (range === 'day') {
    const direct = await loadDayData(iso);
    if (direct) {
      showInfo();
      return presentDay(direct, range);
    }
    const fallback = await loadNearestPast(iso, index);
    if (fallback) {
      showInfo(`Showing ${fallback.date} (nearest available)`);
      return presentDay(fallback.data, range, fallback.date);
    }
    return null;
  }

  const key = `${range}|${iso}`;
  if (aggregateCache.has(key)) return aggregateCache.get(key);

  let view = null;
  if (range === 'week') {
    view = await aggregateWeek(iso, index);
  } else if (range === 'month') {
    view = await aggregateMonth(iso, index);
  } else if (range === 'year') {
    view = await aggregateYear(iso, index);
  }

  if (view) {
    aggregateCache.set(key, view);
  }
  return view;
}

async function loadDayData(iso) {
  if (!iso) return null;
  const key = iso;
  if (dayCache.has(key)) return dayCache.get(key);
  const payload = await loadDay(iso);
  if (!payload) return null;
  const parsed = Array.isArray(payload)
    ? parseDayFromEvents(payload, iso)
    : parseDayFromHourly(payload, iso);
  if (parsed) {
    dayCache.set(key, parsed);
  }
  return parsed;
}

function parseDayFromEvents(rows, iso) {
  const buckets = createHourlyBuckets();
  const userSet = new Set();
  let updatedAt = null;

  rows.forEach(row => {
    if (!row) return;
    const value = Number(row.value ?? row.avg ?? row.score);
    if (!Number.isFinite(value)) return;
    const ts = row.ts || row.timestamp || row.time;
    const date = ts ? new Date(ts) : null;
    if (!date || !Number.isFinite(date.getTime())) return;
    const hour = date.getHours();
    const bucket = buckets[hour];
    bucket.sum += value;
    bucket.count += 1;
    bucket.sampleN += 1;
    if (value >= 80) bucket.anomalies += 1;
    if (row.uid) {
      bucket.users.add(row.uid);
      userSet.add(row.uid);
    }
    if (!updatedAt || date > updatedAt) {
      updatedAt = date;
    }
  });

  const finalBuckets = buckets.map(bucket => ({
    hour: bucket.hour,
    label: `${String(bucket.hour).padStart(2, '0')}`,
    sum: bucket.sum,
    count: bucket.count,
    avg: bucket.count ? Math.round(bucket.sum / bucket.count) : null,
    n: bucket.users.size,
    sampleN: bucket.sampleN,
    anomalies: bucket.anomalies,
    users: bucket.users
  }));

  const totals = finalBuckets.reduce((acc, bucket) => {
    acc.sum += bucket.sum;
    acc.count += bucket.count;
    acc.sampleN += bucket.sampleN;
    acc.anomalies += bucket.anomalies;
    return acc;
  }, { sum: 0, count: 0, sampleN: 0, anomalies: 0 });

  return {
    date: iso,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    buckets: finalBuckets,
    userSet,
    totals
  };
}

function parseDayFromHourly(payload, iso) {
  if (!payload || !Array.isArray(payload.hourly)) return null;
  const hourly = payload.hourly;
  const updatedAt = payload.updated_at || payload.updatedAt || null;
  const nUsers = Number(payload.n_users ?? payload.nUsers ?? 0);
  const buckets = hourly.map(entry => {
    const hour = Number(entry.h ?? entry.hour);
    const avg = Number(entry.avg ?? entry.value);
    const n = Number(entry.n ?? entry.count ?? entry.sample ?? 0);
    const anomalies = Number(entry.anomalies ?? entry.anom ?? 0);
    const sampleN = Number(entry.sampleN ?? entry.samples ?? n);
    const label = Number.isFinite(hour) ? String(hour).padStart(2, '0') : '--';
    const users = new Set();
    for (let i = 0; i < n; i += 1) {
      users.add(`${iso}-${label}-${i}`);
    }
    return {
      hour: Number.isFinite(hour) ? hour : 0,
      label,
      sum: Number.isFinite(avg) && sampleN ? avg * sampleN : 0,
      count: Number.isFinite(sampleN) ? sampleN : 0,
      avg: Number.isFinite(avg) ? Math.round(avg) : null,
      n,
      sampleN,
      anomalies: Number.isFinite(anomalies) ? anomalies : 0,
      users
    };
  });

  const totals = buckets.reduce((acc, bucket) => {
    acc.sum += bucket.sum;
    acc.count += bucket.count;
    acc.sampleN += bucket.sampleN;
    acc.anomalies += bucket.anomalies;
    bucket.users.forEach(uid => acc.userSet.add(uid));
    return acc;
  }, { sum: 0, count: 0, sampleN: 0, anomalies: 0, userSet: new Set() });

  const userSet = nUsers ? new Set(Array.from({ length: nUsers }, (_, idx) => `${iso}-user-${idx}`)) : totals.userSet;

  return {
    date: iso,
    updatedAt,
    buckets,
    userSet,
    totals: {
      sum: totals.sum,
      count: totals.count,
      sampleN: totals.sampleN,
      anomalies: totals.anomalies
    }
  };
}

function createHourlyBuckets() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sum: 0,
    count: 0,
    sampleN: 0,
    anomalies: 0,
    users: new Set()
  }));
}

function presentDay(day, range, actualDate) {
  const meta = {
    updatedAt: day.updatedAt,
    nUsers: day.userSet.size,
    sampleN: day.totals.sampleN,
    actualDate: actualDate || day.date
  };
  const buckets = day.buckets.map(bucket => ({
    label: bucket.label,
    avg: bucket.avg,
    n: bucket.n,
    sampleN: bucket.sampleN,
    anomalies: bucket.anomalies
  }));
  const labels = buckets.map(bucket => bucket.label);
  const values = buckets.map(bucket => (Number.isFinite(bucket.avg) ? bucket.avg : null));
  return { range, labels, values, buckets, meta };
}

async function loadNearestPast(iso, index) {
  const dates = normalisedDates(index).filter(d => d <= iso).sort().reverse();
  for (const date of dates) {
    const day = await loadDayData(date);
    if (day) {
      return { date, data: day };
    }
  }
  return null;
}

async function aggregateWeek(iso, index) {
  const dates = normalisedDates(index).filter(d => d <= iso);
  if (!dates.length) return null;
  const slice = dates.slice(-7);
  const buckets = createHourlyBuckets();
  const userSet = new Set();
  let updatedAt = null;
  let sampleTotal = 0;

  for (const date of slice) {
    const day = await loadDayData(date);
    if (!day) continue;
    sampleTotal += day.totals.sampleN;
    day.userSet.forEach(uid => userSet.add(uid));
    if (!updatedAt || (day.updatedAt && day.updatedAt > updatedAt)) {
      updatedAt = day.updatedAt;
    }
    day.buckets.forEach((bucket, index) => {
      const target = buckets[index];
      target.sum += bucket.sum;
      target.count += bucket.count;
      target.sampleN += bucket.sampleN;
      target.anomalies += bucket.anomalies;
      bucket.users.forEach(uid => target.users.add(uid));
    });
  }

  const finalBuckets = buckets.map(bucket => ({
    label: `${String(bucket.hour).padStart(2, '0')}`,
    avg: bucket.count ? Math.round(bucket.sum / bucket.count) : null,
    n: bucket.users.size,
    sampleN: bucket.sampleN,
    anomalies: bucket.anomalies
  }));

  const labels = finalBuckets.map(bucket => bucket.label);
  const values = finalBuckets.map(bucket => (Number.isFinite(bucket.avg) ? bucket.avg : null));
  return {
    range: 'week',
    labels,
    values,
    buckets: finalBuckets,
    meta: {
      updatedAt,
      nUsers: userSet.size,
      sampleN: sampleTotal
    }
  };
}

async function aggregateMonth(iso, index) {
  const target = new Date(iso);
  const month = target.getMonth();
  const year = target.getFullYear();
  const dates = normalisedDates(index).filter(date => {
    const current = new Date(date);
    return current.getFullYear() === year && current.getMonth() === month;
  }).sort();
  if (!dates.length) return null;

  const buckets = [];
  const userSet = new Set();
  let updatedAt = null;
  let sampleTotal = 0;

  for (const date of dates) {
    const day = await loadDayData(date);
    if (!day) continue;
    sampleTotal += day.totals.sampleN;
    day.userSet.forEach(uid => userSet.add(uid));
    if (!updatedAt || (day.updatedAt && day.updatedAt > updatedAt)) {
      updatedAt = day.updatedAt;
    }
    const avg = day.totals.count ? Math.round(day.totals.sum / day.totals.count) : null;
    const anomalies = day.totals.anomalies;
    const label = String(new Date(date).getDate());
    buckets.push({
      label,
      avg,
      n: day.userSet.size,
      sampleN: day.totals.sampleN,
      anomalies
    });
  }

  const labels = buckets.map(bucket => bucket.label);
  const values = buckets.map(bucket => (Number.isFinite(bucket.avg) ? bucket.avg : null));
  return {
    range: 'month',
    labels,
    values,
    buckets,
    meta: {
      updatedAt,
      nUsers: userSet.size,
      sampleN: sampleTotal
    }
  };
}

async function aggregateYear(iso, index) {
  const target = new Date(iso);
  const months = [];
  const monthKeys = new Set();
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(target.getFullYear(), target.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({ date, key });
    monthKeys.add(key);
  }
  const dates = normalisedDates(index).filter(date => {
    const current = new Date(date);
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    return monthKeys.has(key) && current <= target;
  });

  if (!dates.length) return null;

  const monthBuckets = new Map();
  const userMap = new Map();
  let updatedAt = null;
  let sampleTotal = 0;

  for (const date of dates) {
    const day = await loadDayData(date);
    if (!day) continue;
    const current = new Date(date);
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthBuckets.get(key) || { sum: 0, count: 0, anomalies: 0, sampleN: 0 };
    entry.sum += day.totals.sum;
    entry.count += day.totals.count;
    entry.anomalies += day.totals.anomalies;
    entry.sampleN += day.totals.sampleN;
    monthBuckets.set(key, entry);
    sampleTotal += day.totals.sampleN;
    const set = userMap.get(key) || new Set();
    day.userSet.forEach(uid => set.add(uid));
    userMap.set(key, set);
    if (!updatedAt || (day.updatedAt && day.updatedAt > updatedAt)) {
      updatedAt = day.updatedAt;
    }
  }

  const locale = document.documentElement.lang || 'en';
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });

  const buckets = months
    .reverse()
    .map(({ date, key }) => {
      const data = monthBuckets.get(key);
      if (!data) {
        return { label: formatter.format(date), avg: null, n: 0, sampleN: 0, anomalies: 0 };
      }
      const avg = data.count ? Math.round(data.sum / data.count) : null;
      const n = userMap.get(key)?.size || 0;
      return {
        label: formatter.format(date),
        avg,
        n,
        sampleN: data.sampleN,
        anomalies: data.anomalies
      };
    });

  const labels = buckets.map(bucket => bucket.label);
  const values = buckets.map(bucket => (Number.isFinite(bucket.avg) ? bucket.avg : null));

  const totalUsers = Array.from(userMap.values()).reduce((acc, set) => new Set([...acc, ...set]), new Set());

  return {
    range: 'year',
    labels,
    values,
    buckets,
    meta: {
      updatedAt,
      nUsers: totalUsers.size,
      sampleN: sampleTotal
    }
  };
}

function normalisedDates(index) {
  if (!index || !Array.isArray(index.dates)) return [];
  return index.dates.slice();
}

function bootstrap() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStressTabs, { once: true });
  } else {
    initStressTabs();
  }
}

bootstrap();

window.addEventListener('site:ready', () => {
  if (!state.data) return;
  renderLowSample(state.data);
});

window.addEventListener('i18n:change', () => {
  if (!state.data) return;
  renderMeta(state.data);
  renderLowSample(state.data);
  renderStressChart(state.data).catch(err => {
    console.error('[Analytics] Failed to refresh stress chart', err);
  });
});
