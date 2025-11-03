const METRICS = ['wellbeing', 'stressAvg', 'burnoutPct', 'fatiguePct'];
const RANGE_CONFIG = [
  { id: '1d', days: 1 },
  { id: '7d', days: 7 },
  { id: '30d', days: 30 }
];

const DATA_URL = new URL('../public/demo/night-shift.json', import.meta.url);
const BURNOUT_THRESHOLD = 55;
const FATIGUE_THRESHOLD = 60;

let datasetPromise = null;

function blankMetric() {
  return RANGE_CONFIG.reduce((acc, range) => {
    acc[range.id] = { value: undefined, delta: undefined };
    return acc;
  }, {});
}

function toTimestamp(value) {
  if (!value) return NaN;
  const ts = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ts) ? ts : NaN;
}

async function loadSamples() {
  if (!datasetPromise) {
    datasetPromise = fetch(DATA_URL)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load KPI dataset (${response.status})`);
        return response.json();
      })
      .then(raw => {
        if (!Array.isArray(raw)) return [];
        return raw
          .map(item => {
            const tsMs = toTimestamp(item?.ts);
            if (!Number.isFinite(tsMs)) return null;
            return {
              person_id: item?.person_id,
              ts: tsMs,
              scores: item?.scores || {}
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.ts - b.ts);
      })
      .catch(() => []);
  }
  return datasetPromise;
}

function average(values) {
  const filtered = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!filtered.length) return undefined;
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

function percentage(numerator, denominator) {
  if (!denominator) return undefined;
  return (numerator / denominator) * 100;
}

function aggregateWindow(samples, startTs, endTs) {
  if (!samples.length) return null;
  const latestByPerson = new Map();
  samples.forEach(sample => {
    if (sample.ts < startTs || sample.ts >= endTs) return;
    const current = latestByPerson.get(sample.person_id);
    if (!current || current.ts < sample.ts) {
      latestByPerson.set(sample.person_id, sample);
    }
  });

  const entries = Array.from(latestByPerson.values());
  if (!entries.length) return null;

  const wellbeingValues = [];
  const stressValues = [];
  let burnoutValid = 0;
  let burnoutRisk = 0;
  let fatigueValid = 0;
  let fatigueElevated = 0;

  entries.forEach(({ scores }) => {
    const wellbeing = Number(scores?.wellbeing);
    if (Number.isFinite(wellbeing)) wellbeingValues.push(wellbeing);

    const stress = Number(scores?.stress);
    if (Number.isFinite(stress)) stressValues.push(stress);

    const burnout = Number(scores?.burnout);
    if (Number.isFinite(burnout)) {
      burnoutValid += 1;
      if (burnout >= BURNOUT_THRESHOLD) burnoutRisk += 1;
    }

    const fatigue = Number(scores?.fatigue);
    if (Number.isFinite(fatigue)) {
      fatigueValid += 1;
      if (fatigue >= FATIGUE_THRESHOLD) fatigueElevated += 1;
    }
  });

  return {
    wellbeing: average(wellbeingValues),
    stressAvg: average(stressValues),
    burnoutPct: percentage(burnoutRisk, burnoutValid),
    fatiguePct: percentage(fatigueElevated, fatigueValid)
  };
}

function diff(current, previous) {
  if (typeof current !== 'number' || !Number.isFinite(current)) return undefined;
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return undefined;
  return current - previous;
}

function buildMetricPayload(currentWindow, previousWindow) {
  return METRICS.reduce((acc, key) => {
    const value = currentWindow?.[key];
    const delta = diff(value, previousWindow?.[key]);
    acc[key] = { value: value ?? undefined, delta: delta ?? undefined };
    return acc;
  }, {});
}

function mergeRangeData(target, rangeId, values) {
  METRICS.forEach(metric => {
    target[metric][rangeId] = values[metric];
  });
}

export async function getKpiData() {
  const samples = await loadSamples();
  if (!samples.length) {
    return {
      defaultRange: '7d',
      metrics: METRICS.reduce((acc, key) => {
        acc[key] = blankMetric();
        return acc;
      }, {})
    };
  }

  const latestTs = samples[samples.length - 1]?.ts;
  if (!Number.isFinite(latestTs)) {
    return {
      defaultRange: '7d',
      metrics: METRICS.reduce((acc, key) => {
        acc[key] = blankMetric();
        return acc;
      }, {})
    };
  }

  const metrics = METRICS.reduce((acc, key) => {
    acc[key] = blankMetric();
    return acc;
  }, {});

  RANGE_CONFIG.forEach(range => {
    const duration = range.days * 24 * 60 * 60 * 1000;
    const currentStart = latestTs - duration;
    const previousStart = currentStart - duration;

    const currentWindow = aggregateWindow(samples, currentStart, latestTs + 1);
    const previousWindow = aggregateWindow(samples, previousStart, currentStart);
    const payload = buildMetricPayload(currentWindow, previousWindow);
    mergeRangeData(metrics, range.id, payload);
  });

  return {
    defaultRange: '7d',
    metrics
  };
}

export const KPI_RANGES = RANGE_CONFIG.map(range => range.id);
export const KPI_METRICS = [...METRICS];
