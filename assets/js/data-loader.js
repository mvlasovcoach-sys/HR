export const BUILD_V = '2025-10-25-02';

export function withV(u){
  return `${u}${u.includes('?') ? '&' : '?'}v=${BUILD_V}`;
}

export async function fetchJson(u){
  const r = await fetch(u, {cache: 'no-store'});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  return r.json();
}

const indexCache = new Map();
const dayCache = new Map();

function ensureLoaderGlobals(){
  const g = typeof window !== 'undefined' ? window : globalThis;
  if (!g.loaderGlobals) {
    g.loaderGlobals = {};
  }
  return g.loaderGlobals;
}

function normaliseDateKey(value){
  if (!value) return null;
  if (value instanceof Date) {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normaliseDateKey(new Date(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return normaliseDateKey(date);
    }
  }
  return null;
}

function versionedPath(path){
  try {
    return withV(path);
  } catch (err) {
    return path;
  }
}

function currentScenario(){
  try {
    return localStorage.getItem('hr:scenario') || 'live';
  } catch (err) {
    return 'live';
  }
}

export async function loadIndex({ refresh = false } = {}){
  if (!refresh && indexCache.has('default')) {
    return indexCache.get('default');
  }
  const url = versionedPath('./data/stress/raw/index.json');
  try {
    const payload = await fetchJson(url);
    indexCache.set('default', payload);
    return payload;
  } catch (err) {
    console.error('[DataLoader] Failed to load stress index', err);
    indexCache.set('default', null);
    return null;
  }
}

export async function loadDay(input, { refresh = false, scenario } = {}){
  const iso = normaliseDateKey(input);
  if (!iso) return null;
  const variant = scenario || currentScenario();
  const cacheKey = `${variant}|${iso}`;
  if (!refresh && dayCache.has(cacheKey)) {
    return dayCache.get(cacheKey);
  }

  const basePath = variant === 'night'
    ? `./data/scenario/night_shift/stress/${iso}.json`
    : `./data/stress/raw/${iso}.json`;

  const url = versionedPath(basePath);
  try {
    const payload = await fetchJson(url);
    dayCache.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.error(`[DataLoader] Failed to load stress day ${iso}`, err);
    dayCache.set(cacheKey, null);
    return null;
  }
}

const globals = ensureLoaderGlobals();
Object.assign(globals, { BUILD_V, withV, fetchJson, loadIndex, loadDay });
