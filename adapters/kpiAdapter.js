const METRICS = ['wellbeing', 'stressAvg', 'burnoutPct', 'fatiguePct'];
const RANGE_KEYS = ['1d', '7d', '30d', 'mtd', 'qtd', 'ytd'];

const DATA_URL = new URL('../public/demo/night-shift.json', import.meta.url);
const BURNOUT_THRESHOLD = 55;
const FATIGUE_THRESHOLD = 60;

let datasetPromise = null;

function blankMetric() {
  return RANGE_KEYS.reduce((acc, range) => {
    acc[range] = { value: undefined, delta: undefined };
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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateKey(date) {
  const normalized = startOfDayUTC(date);
  if (Number.isNaN(normalized.valueOf())) return '';
  const year = normalized.getUTCFullYear();
  const month = String(normalized.getUTCMonth() + 1).padStart(2, '0');
  const day = String(normalized.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  if (typeof key !== 'string') return null;
  const [yearStr, monthStr, dayStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, amount) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + amount);
  return startOfDayUTC(result);
}

function addMonths(date, amount) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfQuarter(date) {
  const month = date.getUTCMonth();
  const quarterMonth = month - (month % 3);
  return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1));
}

function endOfQuarter(start) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
}

function startOfYear(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

async function fetchDaily() {
  const samples = await loadSamples();
  if (!samples.length) return [];

  const perDay = new Map();
  samples.forEach(sample => {
    const key = formatDateKey(new Date(sample.ts));
    if (!key) return;
    let byPerson = perDay.get(key);
    if (!byPerson) {
      byPerson = new Map();
      perDay.set(key, byPerson);
    }
    const current = byPerson.get(sample.person_id);
    if (!current || current.ts < sample.ts) {
      byPerson.set(sample.person_id, sample);
    }
  });

  const sortedKeys = Array.from(perDay.keys()).sort();
  return sortedKeys.map(key => {
    const people = perDay.get(key);
    const entries = Array.from(people?.values() || []);
    if (!entries.length) {
      return { date: key };
    }

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
      date: key,
      wellbeing: average(wellbeingValues),
      stressAvg: average(stressValues),
      burnoutPct: percentage(burnoutRisk, burnoutValid),
      fatiguePct: percentage(fatigueElevated, fatigueValid)
    };
  });
}

function aggregate(days) {
  const result = METRICS.reduce((acc, metric) => {
    acc[metric] = { value: undefined, delta: undefined };
    return acc;
  }, {});

  if (!Array.isArray(days) || !days.length) {
    return result;
  }

  METRICS.forEach(metric => {
    const values = days
      .map(day => day?.[metric])
      .filter(value => typeof value === 'number' && Number.isFinite(value));
    if (values.length) {
      const total = values.reduce((sum, value) => sum + value, 0);
      result[metric].value = total / values.length;
    }
  });

  return result;
}

function withTrend(curr, prev) {
  METRICS.forEach(metric => {
    const currentValue = curr[metric]?.value;
    const previousValue = prev[metric]?.value;
    if (typeof currentValue === 'number' && Number.isFinite(currentValue)
      && typeof previousValue === 'number' && Number.isFinite(previousValue)) {
      const delta = +(currentValue - previousValue).toFixed(1);
      curr[metric].delta = delta;
      curr[metric].trend = delta;
    }
  });
  return curr;
}

export async function getKpiData() {
  const byDay = await fetchDaily();
  if (!byDay.length) {
    return {
      defaultRange: '7d',
      metrics: METRICS.reduce((acc, key) => {
        acc[key] = blankMetric();
        return acc;
      }, {})
    };
  }

  const dayMap = new Map(byDay.map(day => [day.date, day]));
  const anchor = startOfDayUTC(parseDateKey(byDay[byDay.length - 1]?.date) || new Date());

  function collectDays(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return [];
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return [];
    if (start.getTime() > end.getTime()) return [];

    const collected = [];
    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
      const key = formatDateKey(cursor);
      const entry = dayMap.get(key);
      if (entry) collected.push(entry);
    }
    return collected;
  }

  function rangeDays(kind) {
    switch (kind) {
      case '1d': {
        const prevDay = addDays(anchor, -1);
        return {
          currDays: collectDays(anchor, anchor),
          prevDays: collectDays(prevDay, prevDay)
        };
      }
      case '7d':
      case '30d': {
        const length = kind === '7d' ? 7 : 30;
        const currStart = addDays(anchor, -(length - 1));
        const prevEnd = addDays(currStart, -1);
        const prevStart = addDays(prevEnd, -(length - 1));
        return {
          currDays: collectDays(currStart, anchor),
          prevDays: collectDays(prevStart, prevEnd)
        };
      }
      case 'mtd': {
        const currStart = startOfMonth(anchor);
        const prevMonthStart = addMonths(currStart, -1);
        const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth()));
        const prevEnd = new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth(), prevEndDay));
        return {
          currDays: collectDays(currStart, anchor),
          prevDays: collectDays(prevMonthStart, prevEnd)
        };
      }
      case 'qtd': {
        const quarterStart = startOfQuarter(anchor);
        const prevQuarterStart = addMonths(quarterStart, -3);
        const daysIntoQuarter = Math.floor((anchor.getTime() - quarterStart.getTime()) / DAY_MS);
        const prevQuarterEnd = endOfQuarter(prevQuarterStart);
        const prevEndCandidate = addDays(prevQuarterStart, daysIntoQuarter);
        const prevEnd = prevEndCandidate.getTime() > prevQuarterEnd.getTime() ? prevQuarterEnd : prevEndCandidate;
        return {
          currDays: collectDays(quarterStart, anchor),
          prevDays: collectDays(prevQuarterStart, prevEnd)
        };
      }
      case 'ytd': {
        const yearStart = startOfYear(anchor);
        const prevYear = anchor.getUTCFullYear() - 1;
        const prevYearStart = new Date(Date.UTC(prevYear, 0, 1));
        const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevYear, anchor.getUTCMonth()));
        const prevEnd = new Date(Date.UTC(prevYear, anchor.getUTCMonth(), prevEndDay));
        return {
          currDays: collectDays(yearStart, anchor),
          prevDays: collectDays(prevYearStart, prevEnd)
        };
      }
      default:
        return { currDays: [], prevDays: [] };
    }
  }

  const metrics = METRICS.reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {});

  RANGE_KEYS.forEach(rangeKey => {
    const { currDays, prevDays } = rangeDays(rangeKey);
    const current = aggregate(currDays);
    const previous = aggregate(prevDays);
    const payload = withTrend(current, previous);
    METRICS.forEach(metric => {
      metrics[metric][rangeKey] = payload[metric];
    });
  });

  return {
    defaultRange: '7d',
    metrics
  };
}

export const KPI_RANGES = [...RANGE_KEYS];
export const KPI_METRICS = [...METRICS];
