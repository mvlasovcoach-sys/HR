const g = typeof window !== 'undefined' ? window : globalThis;
const d = typeof document !== 'undefined' ? document : null;

const FALLBACK_BASE = (() => {
  if (g?.location) {
    const { origin, pathname } = g.location;
    return origin + pathname.replace(/[^/]+$/, '');
  }
  return '';
})();

export const BASE_PATH = d?.querySelector('base')?.href || FALLBACK_BASE;
export const BUILD_V = '2025-10-25-01';
export const BUILD_VERSION = BUILD_V;

export function base(path = '') {
  const origin = BASE_PATH || g?.location?.href || '';
  const href = new URL(path || '.', origin).toString();
  return href.endsWith('/') ? href : `${href.replace(/\/?$/, '/')}`;
}

export const DATA_BASE_URL = base('data/stress/');

const LOG_PREFIX = '[Analytics]';

export const withV = input => {
  if (!input) return input;
  const origin = BASE_PATH || g?.location?.href || '';
  const url = input instanceof URL ? new URL(input.toString()) : new URL(String(input), origin);
  if (BUILD_V && !url.searchParams.has('v')) {
    url.searchParams.set('v', BUILD_V);
  }
  return url.toString();
};

export function urlWithV(u) {
  if (!u) return u;
  return withV(u);
}

export function dataUrl(...parts) {
  const joined = parts
    .flat()
    .filter(Boolean)
    .map(part => String(part).replace(/^\/+|\/+$/g, ''))
    .join('/');
  return new URL(joined, DATA_BASE_URL).toString();
}

export async function fetchJson(u, options = {}) {
  const targetUrl = typeof u === 'string' || u instanceof URL ? u : String(u);
  const fetchUrl = targetUrl instanceof URL ? targetUrl.toString() : targetUrl;
  const fetchOptions = Object.assign({ cache: 'no-store' }, options);
  let response;
  try {
    response = await fetch(fetchUrl, fetchOptions);
  } catch (err) {
    console.error(`${LOG_PREFIX} Data load failed`, { url: fetchUrl, status: 'network', err });
    throw err;
  }

  if (response.status === 404) {
    console.warn(`${LOG_PREFIX} Missing:`, fetchUrl);
    return null;
  }

  if (!response.ok) {
    console.error(`${LOG_PREFIX} Data load failed`, { url: fetchUrl, status: response.status });
    throw new Error(`${LOG_PREFIX} HTTP ${response.status} for ${fetchUrl}`);
  }

  return response.json();
}

const legacyCache = new Map();
const dayCache = new Map();
let indexPromise = null;

function normaliseIso(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function clearCache() {
  dayCache.clear();
  indexPromise = null;
  legacyCache.clear();
}

export function loadIndex() {
  if (!indexPromise) {
    const url = urlWithV(dataUrl('raw', 'index.json'));
    indexPromise = fetchJson(url).catch(err => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

export function loadDay(iso) {
  const key = normaliseIso(iso);
  if (!key) return Promise.resolve(null);
  if (!dayCache.has(key)) {
    const url = urlWithV(dataUrl('raw', `${key}.json`));
    const promise = fetchJson(url).catch(err => {
      dayCache.delete(key);
      throw err;
    });
    dayCache.set(key, promise);
  }
  return dayCache.get(key);
}

function normalizeRange(range) {
  if (!range) return null;
  if (typeof range === 'string') return range;
  try {
    const { preset, start, end } = range;
    const normalized = {};
    if (preset) normalized.preset = preset;
    if (start) normalized.start = start;
    if (end) normalized.end = end;
    return Object.keys(normalized).length ? normalized : null;
  } catch (err) {
    return null;
  }
}

function buildKey(path, range, team, mode) {
  return JSON.stringify({ path, range: range || null, team: team || 'all', mode: mode || 'json' });
}

function readScenario() {
  try {
    return localStorage.getItem('hr:scenario') || 'live';
  } catch (err) {
    return 'live';
  }
}

function scenarioPath(path) {
  if (typeof path !== 'string') return path;
  if (/^[a-z]+:\/\//i.test(path)) return path;
  const scenario = readScenario();
  if (scenario !== 'night') return path;
  const suffixes = [
    { match: 'metrics_7d.json', replace: 'night_shift_metrics_7d.json' },
    { match: 'events.json', replace: 'night_shift_events.json' }
  ];
  for (const entry of suffixes) {
    if (path.includes(entry.replace)) return path;
    if (path.endsWith(entry.match)) {
      return path.slice(0, -entry.match.length) + entry.replace;
    }
  }
  return path;
}

const LEGACY_TTL = 60000;

function ensureUrl(path) {
  if (path instanceof URL) return new URL(path.toString());
  try {
    return new URL(path, BASE_PATH || d?.baseURI || g?.location?.href || '');
  } catch (err) {
    return new URL(String(path || ''), BASE_PATH || d?.baseURI || g?.location?.href || '');
  }
}

async function legacyFetch(path, options = {}) {
  const { range, team, as: mode = 'json', skipScenario = false, signal, headers, ...rest } = options;
  const normalizedRange = normalizeRange(range);
  const resolvedPath = skipScenario ? path : scenarioPath(path);
  const key = buildKey(resolvedPath, normalizedRange, team, mode);
  const now = Date.now();
  if (legacyCache.has(key)) {
    const entry = legacyCache.get(key);
    if (now - entry.ts < LEGACY_TTL) {
      return entry.data;
    }
    legacyCache.delete(key);
  }

  const url = ensureUrl(resolvedPath);
  if (BUILD_VERSION && !url.searchParams.has('v')) {
    url.searchParams.set('v', BUILD_VERSION);
  }
  if (normalizedRange && typeof normalizedRange === 'object') {
    Object.entries(normalizedRange).forEach(([k, v]) => {
      if (!url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    });
  }

  const fetchOptions = Object.assign({ cache: 'no-store' }, rest);
  if (signal) fetchOptions.signal = signal;
  if (headers) fetchOptions.headers = headers;

  let payload;
  if (mode === 'json') {
    payload = await fetchJson(url.toString(), fetchOptions);
  } else {
    const response = await fetch(url.toString(), fetchOptions);
    if (response.status === 404) {
      console.warn(`${LOG_PREFIX} Missing:`, url.toString());
      payload = null;
    } else if (!response.ok) {
      console.error(`${LOG_PREFIX} Data load failed`, { url: url.toString(), status: response.status });
      throw new Error(`${LOG_PREFIX} HTTP ${response.status} for ${url.toString()}`);
    } else if (mode === 'text') {
      payload = await response.text();
    } else if (mode === 'blob') {
      payload = await response.blob();
    } else {
      payload = await response.arrayBuffer();
    }
  }

  legacyCache.set(key, { ts: now, data: payload });
  return payload;
}

const legacyApi = {
  fetch: legacyFetch,
  clear: clearCache,
  resolveDataUrl: (...parts) => dataUrl(...parts),
  loadDayJson: loadDay,
  loadIndex,
  fetchJson,
  withV,
  base,
  constants: { BASE_PATH, DATA_BASE_URL, BUILD_V, BUILD_VERSION }
};

if (g) {
  g.AnalyticsDataLoader = {
    BASE_PATH,
    DATA_BASE_URL,
    BUILD_V,
    BUILD_VERSION,
    base,
    withV,
    urlWithV,
    dataUrl,
    fetchJson,
    loadIndex,
    loadDay,
    clearCache
  };
  g.dataLoader = Object.assign({}, g.dataLoader || {}, legacyApi);
}

export default {
  BASE_PATH,
  DATA_BASE_URL,
  BUILD_V,
  BUILD_VERSION,
  base,
  withV,
  urlWithV,
  dataUrl,
  fetchJson,
  loadIndex,
  loadDay,
  clearCache
};
