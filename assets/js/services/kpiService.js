import { loadLiveSamples } from './dataSource.js';
import { loadDemoDaily, demoBounds } from './demoData.js';
import { clampToDemo, keyForRange } from '../utils/dateRange.js';

const guardLive = 5;
const guardDemo = 1;
const BURNOUT_THRESHOLD = 55;
const FATIGUE_THRESHOLD = 60;

const datasetCache = new Map();
const dailyCache = new Map();
const responseCache = new Map();

const DAY_MS = 24 * 60 * 60 * 1000;

function normaliseMode(value){
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text === 'live' ? 'live' : 'demo';
}

function toDate(value){
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function startOfUtcDay(date){
  if (!(date instanceof Date)) return new Date(NaN);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateKey(date){
  const normalized = startOfUtcDay(date);
  if (Number.isNaN(normalized.valueOf())) return '';
  const year = normalized.getUTCFullYear();
  const month = String(normalized.getUTCMonth() + 1).padStart(2, '0');
  const day = String(normalized.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp100(value){
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function safeNumber(value){
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function recordDaySample(store, key, personId, sample){
  let byPerson = store.get(key);
  if (!byPerson) {
    byPerson = new Map();
    store.set(key, byPerson);
  }
  const existing = byPerson.get(personId);
  if (!existing || existing.ts < sample.ts) {
    byPerson.set(personId, sample);
  }
}

function buildDailyIndex(samples){
  const byDay = new Map();
  samples.forEach(raw => {
    const ts = safeNumber(raw?.ts ?? raw?.timestamp);
    const parsedTs = Number.isFinite(ts) ? ts : Date.parse(raw?.ts ?? raw?.timestamp);
    if (!Number.isFinite(parsedTs)) return;
    const date = new Date(parsedTs);
    const key = formatDateKey(date);
    if (!key) return;
    const personId = raw?.person_id ?? raw?.personId ?? raw?.id;
    if (!personId) return;
    recordDaySample(byDay, key, String(personId), {
      ts: parsedTs,
      scores: raw?.scores || {}
    });
  });

  const daily = new Map();
  byDay.forEach((people, key) => {
    const entries = Array.from(people.values());
    if (!entries.length) {
      daily.set(key, {
        wellbeing: { sum: 0, count: 0 },
        stress: { sum: 0, count: 0 },
        burnout: { risk: 0, total: 0 },
        fatigue: { elevated: 0, total: 0 },
        n: 0
      });
      return;
    }

    let wellbeingSum = 0;
    let wellbeingCount = 0;
    let stressSum = 0;
    let stressCount = 0;
    let burnoutRisk = 0;
    let burnoutTotal = 0;
    let fatigueElevated = 0;
    let fatigueTotal = 0;

    entries.forEach(entry => {
      const wellbeing = clamp100(safeNumber(entry?.scores?.wellbeing));
      if (typeof wellbeing === 'number') {
        wellbeingSum += wellbeing;
        wellbeingCount += 1;
      }
      const stress = clamp100(safeNumber(entry?.scores?.stress));
      if (typeof stress === 'number') {
        stressSum += stress;
        stressCount += 1;
      }
      const burnout = clamp100(safeNumber(entry?.scores?.burnout));
      if (typeof burnout === 'number') {
        burnoutTotal += 1;
        if (burnout >= BURNOUT_THRESHOLD) {
          burnoutRisk += 1;
        }
      }
      const fatigue = clamp100(safeNumber(entry?.scores?.fatigue));
      if (typeof fatigue === 'number') {
        fatigueTotal += 1;
        if (fatigue >= FATIGUE_THRESHOLD) {
          fatigueElevated += 1;
        }
      }
    });

    daily.set(key, {
      wellbeing: { sum: wellbeingSum, count: wellbeingCount },
      stress: { sum: stressSum, count: stressCount },
      burnout: { risk: burnoutRisk, total: burnoutTotal },
      fatigue: { elevated: fatigueElevated, total: fatigueTotal },
      n: entries.length
    });
  });

  return daily;
}

async function ensureDataset(){
  const key = 'LIVE';
  if (!datasetCache.has(key)) {
    datasetCache.set(key, Promise.resolve().then(() => loadLiveSamples()).then(data => Array.isArray(data) ? data : []));
  }
  const data = await datasetCache.get(key);
  return Array.isArray(data) ? data : [];
}

async function ensureDailyIndex(){
  const key = 'LIVE';
  if (!dailyCache.has(key)) {
    const promise = ensureDataset().then(buildDailyIndex);
    dailyCache.set(key, promise);
  }
  return dailyCache.get(key);
}

function iterateDays(startIso, endIso){
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) return [];
  const normalizedStart = startOfUtcDay(start);
  const normalizedEnd = startOfUtcDay(end);
  if (Number.isNaN(normalizedStart.valueOf()) || Number.isNaN(normalizedEnd.valueOf())) return [];
  if (normalizedEnd.getTime() <= normalizedStart.getTime()) return [];

  const days = [];
  for (let cursor = normalizedStart.getTime(); cursor < normalizedEnd.getTime(); cursor += DAY_MS) {
    days.push(formatDateKey(new Date(cursor)));
  }
  return days;
}

function aggregateDays(dayIndex, dayKeys){
  const totals = {
    wellbeing: { sum: 0, count: 0 },
    stress: { sum: 0, count: 0 },
    burnout: { risk: 0, total: 0 },
    fatigue: { elevated: 0, total: 0 },
    n: 0
  };

  dayKeys.forEach(key => {
    const entry = dayIndex.get(key);
    if (!entry) return;
    totals.wellbeing.sum += entry.wellbeing.sum;
    totals.wellbeing.count += entry.wellbeing.count;
    totals.stress.sum += entry.stress.sum;
    totals.stress.count += entry.stress.count;
    totals.burnout.risk += entry.burnout.risk;
    totals.burnout.total += entry.burnout.total;
    totals.fatigue.elevated += entry.fatigue.elevated;
    totals.fatigue.total += entry.fatigue.total;
    totals.n += entry.n;
  });

  const avg = (sum, count) => (count > 0 ? +(sum / count).toFixed(1) : null);
  const pct = (num, denom) => (denom > 0 ? +((num / denom) * 100).toFixed(1) : null);

  return {
    wellbeing: avg(totals.wellbeing.sum, totals.wellbeing.count),
    stress: avg(totals.stress.sum, totals.stress.count),
    burnout: pct(totals.burnout.risk, totals.burnout.total),
    fatigue: pct(totals.fatigue.elevated, totals.fatigue.total),
    n: totals.n
  };
}

function sliceByDate(rows, startIso, endIso){
  const startTime = Date.parse(startIso);
  const endTime = Date.parse(endIso);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return [];
  if (endTime <= startTime) return [];
  return rows.filter(row => {
    const ts = Date.parse(`${row?.date}T00:00:00.000Z`);
    if (!Number.isFinite(ts)) return false;
    return ts >= startTime && ts < endTime;
  });
}

function mean(values){
  if (!Array.isArray(values) || !values.length) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = sum / values.length;
  return Number.isFinite(avg) ? +avg.toFixed(1) : null;
}

function aggregateDemo(rows = []){
  const wellbeing = [];
  const stress = [];
  const burnout = [];
  const fatigue = [];

  rows.forEach(row => {
    if (Number.isFinite(row?.wellbeing)) wellbeing.push(row.wellbeing);
    if (Number.isFinite(row?.stress)) stress.push(row.stress);
    if (Number.isFinite(row?.burnout)) burnout.push(row.burnout);
    if (Number.isFinite(row?.fatigue)) fatigue.push(row.fatigue);
  });

  return {
    wellbeing: mean(wellbeing),
    stress: mean(stress),
    burnout: mean(burnout),
    fatigue: mean(fatigue)
  };
}

function delta(current, previous){
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const value = +(current - previous).toFixed(1);
  return Number.isFinite(value) ? value : null;
}

function diffObjects(previous = {}, current = {}){
  return {
    wellbeing: delta(current.wellbeing, previous.wellbeing),
    stress: delta(current.stress, previous.stress),
    burnout: delta(current.burnout, previous.burnout),
    fatigue: delta(current.fatigue, previous.fatigue)
  };
}

export async function getKpis(params = {}){
  const mode = normaliseMode(params.mode);
  const lang = params.lang || (typeof document !== 'undefined' ? document.documentElement?.lang : 'en') || 'en';
  const teamId = params.teamId || 'all';
  const startISO = params.startISO || params.start || null;
  const endISO = params.endISO || params.end || null;
  const compareStartISO = params.compareStartISO || params.compareStart || params.compare?.startISO || params.compare?.start || null;
  const compareEndISO = params.compareEndISO || params.compareEnd || params.compare?.endISO || params.compare?.end || null;

  const cacheKey = keyForRange({ startISO, endISO, teamId, mode, lang });
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  const request = (async () => {
    if (mode === 'demo') {
      const [rows, bounds] = await Promise.all([loadDemoDaily(), demoBounds()]);
      const clamped = clampToDemo({ startISO, endISO }, bounds);
      if (!clamped.ok) {
        return { mode: 'demo', isInsufficient: true, reason: 'no-demo-range' };
      }
      const currentRows = sliceByDate(rows, clamped.startISO, clamped.endISO);
      const previousRows = sliceByDate(rows, compareStartISO, compareEndISO);
      if (currentRows.length < guardDemo) {
        return { mode: 'demo', isInsufficient: true };
      }
      const currentAgg = aggregateDemo(currentRows);
      const previousAgg = aggregateDemo(previousRows);
      return {
        mode: 'demo',
        isInsufficient: false,
        wellbeing: currentAgg.wellbeing,
        stress: currentAgg.stress,
        burnout: currentAgg.burnout,
        fatigue: currentAgg.fatigue,
        samples: currentRows.length,
        deltas: diffObjects(previousAgg, currentAgg)
      };
    }

    const dayIndex = await ensureDailyIndex();
    const currentDays = iterateDays(startISO, endISO);
    const compareDays = iterateDays(compareStartISO, compareEndISO);

    if (!currentDays.length) {
      return { mode: 'live', isInsufficient: true };
    }

    const currentAgg = aggregateDays(dayIndex, currentDays);
    const compareAgg = aggregateDays(dayIndex, compareDays);

    if (currentAgg.n < guardLive) {
      return { mode: 'live', isInsufficient: true, samples: currentAgg.n };
    }

    return {
      mode: 'live',
      isInsufficient: false,
      wellbeing: currentAgg.wellbeing,
      stress: currentAgg.stress,
      burnout: currentAgg.burnout,
      fatigue: currentAgg.fatigue,
      samples: currentAgg.n,
      deltas: diffObjects(compareAgg, currentAgg)
    };
  })()
    .then(value => {
      responseCache.set(cacheKey, value);
      return value;
    })
    .catch(err => {
      responseCache.delete(cacheKey);
      throw err;
    });

  responseCache.set(cacheKey, request);
  return request;
}

export function clearKpiCache(){
  responseCache.clear();
}
