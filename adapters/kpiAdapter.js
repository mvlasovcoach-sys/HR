const METRICS = ['wellbeing', 'stressAvg', 'burnoutPct', 'fatiguePct'];
const RANGE_KEYS = ['1d', '7d', '30d', 'mtd', 'qtd', 'ytd'];

const DATA_URL = new URL('../public/demo/night-shift.json', import.meta.url);
const BURNOUT_THRESHOLD = 55;
const FATIGUE_THRESHOLD = 60;

let datasetPromise = null;

// Helpers
const clamp0_100 = v => Math.max(0, Math.min(100, v));

function safeAvg(arr, key) {
  if (!Array.isArray(arr)) return undefined;
  const vals = arr
    .map(item => {
      if (key == null) return Number(item);
      if (item == null) return NaN;
      return Number(item[key]);
    })
    .filter(Number.isFinite);
  return vals.length ? vals.reduce((sum, value) => sum + value, 0) / vals.length : undefined;
}

function safePct(numer, denom) {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return undefined;
  return clamp0_100((numer / denom) * 100);
}

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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfLocalDay(d = new Date()) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

function endOfLocalDay(d = new Date()) {
  const t = new Date(d);
  t.setHours(23, 59, 59, 999);
  return t;
}

function windowForRange(range) {
  const now = new Date();
  if (range === '1d') {
    return { from: startOfLocalDay(now), to: endOfLocalDay(now) };
  }
  return { from: null, to: null };
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
      return { date: key, rows: [] };
    }

    const rows = entries.map(sample => {
      const scores = sample?.scores || {};
      const wellbeing = Number(scores?.wellbeing);
      const stress = Number(scores?.stress);
      const burnout = Number(scores?.burnout);
      const fatigue = Number(scores?.fatigue);
      return {
        date: sample.ts,
        userId: sample.person_id,
        wellbeing: Number.isFinite(wellbeing) ? wellbeing : undefined,
        stressAvg: Number.isFinite(stress) ? stress : undefined,
        burnoutRisk: Number.isFinite(burnout) && burnout >= BURNOUT_THRESHOLD,
        fatigueElevated: Number.isFinite(fatigue) && fatigue >= FATIGUE_THRESHOLD
      };
    });

    return { date: key, rows };
  });
}

function aggregateWindow(rows) {
  const out = {
    wellbeing: { value: safeAvg(rows, 'wellbeing'), delta: undefined },
    stressAvg: { value: safeAvg(rows, 'stressAvg'), delta: undefined },
    burnoutPct: { value: undefined, delta: undefined },
    fatiguePct: { value: undefined, delta: undefined }
  };

  if (!Array.isArray(rows) || !rows.length) {
    return out;
  }

  const users = new Set(rows.map(r => r?.userId).filter(Boolean));
  const denom = users.size;
  const is1d = isSameLocalDayRange(rows);

  if (is1d) {
    const sortedRows = [...rows].sort((a, b) => {
      const aTime = new Date(a?.date).getTime();
      const bTime = new Date(b?.date).getTime();
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });
    const lastByUser = new Map();
    sortedRows.forEach(entry => {
      if (!entry?.userId) return;
      lastByUser.set(entry.userId, entry);
    });
    const rows1d = Array.from(lastByUser.values());
    const burnNum = rows1d.filter(r => !!r?.burnoutRisk).length;
    const fatNum = rows1d.filter(r => !!r?.fatigueElevated).length;
    out.burnoutPct.value = safePct(burnNum, denom);
    out.fatiguePct.value = safePct(fatNum, denom);
    console.debug('[KPI] 1d rows:', rows1d.length, 'users:', denom, {
      burnout: out.burnoutPct.value,
      fatigue: out.fatiguePct.value
    });
  } else {
    const byDay = groupByLocalDay(rows);
    const dayBurnout = [];
    const dayFatigue = [];
    byDay.forEach(rlist => {
      const usersD = new Set(rlist.map(r => r?.userId).filter(Boolean));
      const denomD = usersD.size;
      const sortedDayRows = [...rlist].sort((a, b) => {
        const aTime = new Date(a?.date).getTime();
        const bTime = new Date(b?.date).getTime();
        return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      });
      const lastByUserD = new Map();
      sortedDayRows.forEach(entry => {
        if (!entry?.userId) return;
        lastByUserD.set(entry.userId, entry);
      });
      const arrD = Array.from(lastByUserD.values());
      const burnNumD = arrD.filter(r => !!r?.burnoutRisk).length;
      const fatNumD = arrD.filter(r => !!r?.fatigueElevated).length;
      dayBurnout.push(safePct(burnNumD, denomD));
      dayFatigue.push(safePct(fatNumD, denomD));
    });

    const avg = values => {
      if (!Array.isArray(values)) return undefined;
      const filtered = values.filter(Number.isFinite);
      if (!filtered.length) return undefined;
      const total = filtered.reduce((sum, value) => sum + value, 0);
      return total / filtered.length;
    };

    out.burnoutPct.value = avg(dayBurnout);
    out.fatiguePct.value = avg(dayFatigue);
  }

  return out;
}

function isSameLocalDayRange(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const first = new Date(rows[0]?.date);
  if (!Number.isFinite(first.valueOf())) return false;
  const year = first.getFullYear();
  const month = first.getMonth();
  const date = first.getDate();
  return rows.every(item => {
    const current = new Date(item?.date);
    if (!Number.isFinite(current.valueOf())) return false;
    return current.getFullYear() === year
      && current.getMonth() === month
      && current.getDate() === date;
  });
}

function groupByLocalDay(rows) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  rows.forEach(entry => {
    const current = new Date(entry?.date);
    if (!Number.isFinite(current.valueOf())) return;
    const key = `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  });
  return map;
}

function addTrend(curr, prev) {
  for (const key of ['wellbeing', 'stressAvg', 'burnoutPct', 'fatiguePct']) {
    const currentValue = curr[key]?.value;
    const previousValue = prev[key]?.value;
    if (Number.isFinite(currentValue) && Number.isFinite(previousValue)) {
      const delta = +(currentValue - previousValue).toFixed(1);
      curr[key].delta = delta;
      curr[key].trend = delta;
    }
  }
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

  const dayMap = new Map(byDay.map(day => [day.date, Array.isArray(day?.rows) ? day.rows : []]));
  const anchor = startOfDayUTC(parseDateKey(byDay[byDay.length - 1]?.date) || new Date());

  function collectRows(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return [];
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return [];
    if (start.getTime() > end.getTime()) return [];

    const collected = [];
    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
      const key = formatDateKey(cursor);
      const rows = dayMap.get(key);
      if (Array.isArray(rows) && rows.length) {
        collected.push(...rows);
      }
    }
    return collected;
  }

  function rangeDays(kind) {
    switch (kind) {
      case '1d': {
        const { from } = windowForRange('1d');
        const currentBase = from instanceof Date && !Number.isNaN(from.valueOf()) ? from : new Date();
        const currentKey = formatDateKey(currentBase);
        const prevStart = startOfLocalDay(new Date(currentBase.getTime() - DAY_MS));
        const prevKey = formatDateKey(prevStart);
        const currentRows = dayMap.get(currentKey) || [];
        const previousRows = dayMap.get(prevKey) || [];
        return {
          currRows: currentRows,
          prevRows: previousRows
        };
      }
      case '7d':
      case '30d': {
        const length = kind === '7d' ? 7 : 30;
        const currStart = addDays(anchor, -(length - 1));
        const prevEnd = addDays(currStart, -1);
        const prevStart = addDays(prevEnd, -(length - 1));
        return {
          currRows: collectRows(currStart, anchor),
          prevRows: collectRows(prevStart, prevEnd)
        };
      }
      case 'mtd': {
        const currStart = startOfMonth(anchor);
        const prevMonthStart = addMonths(currStart, -1);
        const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth()));
        const prevEnd = new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth(), prevEndDay));
        return {
          currRows: collectRows(currStart, anchor),
          prevRows: collectRows(prevMonthStart, prevEnd)
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
          currRows: collectRows(quarterStart, anchor),
          prevRows: collectRows(prevQuarterStart, prevEnd)
        };
      }
      case 'ytd': {
        const yearStart = startOfYear(anchor);
        const prevYear = anchor.getUTCFullYear() - 1;
        const prevYearStart = new Date(Date.UTC(prevYear, 0, 1));
        const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevYear, anchor.getUTCMonth()));
        const prevEnd = new Date(Date.UTC(prevYear, anchor.getUTCMonth(), prevEndDay));
        return {
          currRows: collectRows(yearStart, anchor),
          prevRows: collectRows(prevYearStart, prevEnd)
        };
      }
      default:
        return { currRows: [], prevRows: [] };
    }
  }

  const metrics = METRICS.reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {});

  RANGE_KEYS.forEach(rangeKey => {
    const { currRows, prevRows } = rangeDays(rangeKey);
    const current = aggregateWindow(currRows);
    const previous = aggregateWindow(prevRows);
    const payload = addTrend(current, previous);
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
