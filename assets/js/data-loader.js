(function(g, d){
  if (!g || !d) return;

  const TTL = 60000;
  const cache = new Map();
  let versionWait = null;

  const BUILD_VERSION = (() => {
    const raw = typeof g.ANALYTICS_BUILD_VERSION === 'string' ? g.ANALYTICS_BUILD_VERSION.trim() : '';
    const version = raw || '2025.10.25-01';
    g.ANALYTICS_BUILD_VERSION = version;
    return version;
  })();

  const BASE_PATH = (() => {
    try {
      const baseEl = d.querySelector('base');
      if (baseEl?.href) return baseEl.href;
    } catch (err) {
      /* noop */
    }
    try {
      const { origin, pathname } = g.location || {};
      if (origin && typeof pathname === 'string') {
        return origin + pathname.replace(/[^/]+$/, '');
      }
    } catch (err) {
      /* noop */
    }
    return d.baseURI || '';
  })();

  const DATA_BASE_URL = (() => {
    try {
      return new URL('data/stress/', BASE_PATH).toString();
    } catch (err) {
      return new URL('data/stress/', d.baseURI).toString();
    }
  })();

  g.ANALYTICS_BASE_PATH = BASE_PATH;
  g.ANALYTICS_DATA_BASE_URL = DATA_BASE_URL;

  function normalizeRange(range){
    if (!range) return null;
    try {
      if (typeof range === 'string') {
        return { preset: range };
      }
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

  function buildKey(path, range, team, mode){
    return JSON.stringify({ path, range: range || null, team: team || 'all', mode: mode || 'json' });
  }

  function readScenario(){
    try {
      return localStorage.getItem('hr:scenario') || 'live';
    } catch (err) {
      return 'live';
    }
  }

  function scenarioPath(path){
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

  function waitForVersion(){
    if (typeof g.APP_VERSION !== 'undefined') {
      return Promise.resolve(g.APP_VERSION || '');
    }
    if (!versionWait) {
      versionWait = new Promise(resolve => {
        const handler = () => {
          g.removeEventListener('app:version', handler);
          resolve(g.APP_VERSION || '');
        };
        g.addEventListener('app:version', handler, { once: true });
      });
    }
    return versionWait;
  }

  function ensureUrl(path){
    if (path instanceof URL) {
      return new URL(path.toString());
    }
    try {
      return new URL(path, d.baseURI);
    } catch (err) {
      return new URL(String(path || ''), d.baseURI);
    }
  }

  function maybeTagBuildVersion(url){
    if (!url || typeof url.searchParams === 'undefined') return url;
    if (BUILD_VERSION && !url.searchParams.has('v')) {
      url.searchParams.set('v', BUILD_VERSION);
    }
    return url;
  }

  function normaliseIsoDate(value){
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, year, month, day ] = match;
    return `${year}-${month}-${day}`;
  }

  async function fetchJson(path, options = {}){
    const { range, team, as: mode = 'json', skipScenario = false, appendBuildVersion = true, signal, headers, ...rest } = options;
    const normalizedRange = normalizeRange(range);
    const resolvedPath = skipScenario ? path : scenarioPath(path);
    const key = buildKey(resolvedPath, normalizedRange, team, mode);
    const now = Date.now();
    if (cache.has(key)) {
      const entry = cache.get(key);
      if (now - entry.ts < TTL) {
        return entry.data;
      }
      cache.delete(key);
    }

    const url = ensureUrl(resolvedPath);
    if (appendBuildVersion) {
      maybeTagBuildVersion(url);
    }
    const appVersion = await waitForVersion().catch(() => '');
    if (appVersion && appVersion !== url.searchParams.get('v') && !url.searchParams.has('app_v')) {
      url.searchParams.set('app_v', appVersion);
    }

    const fetchOptions = Object.assign({ cache: 'no-store' }, rest);
    if (signal) fetchOptions.signal = signal;
    if (headers) fetchOptions.headers = headers;

    let response;
    try {
      response = await fetch(url.toString(), fetchOptions);
    } catch (err) {
      console.error('[Analytics] Data load failed', { url: url.toString(), err });
      throw err;
    }

    if (response.status === 404) {
      console.warn('[Analytics] Data not found:', url.toString());
      cache.set(key, { ts: now, data: null });
      return null;
    }

    if (!response.ok) {
      console.error('[Analytics] Data load failed', { url: url.toString(), status: response.status });
      throw new Error(`HTTP ${response.status}`);
    }

    const data = mode === 'text' ? await response.text() : await response.json();
    cache.set(key, { ts: now, data });
    return data;
  }

  function clear(){
    cache.clear();
  }

  function resolveDataUrl(parts = []){
    const list = Array.isArray(parts) ? parts : [parts];
    const cleaned = list
      .map(part => (part == null ? '' : String(part)))
      .map(segment => segment.trim().replace(/^\/+|\/+$/g, ''))
      .filter(Boolean);
    const joined = cleaned.join('/');
    return new URL(joined, DATA_BASE_URL).toString();
  }

  async function loadDayJson(isoDate){
    const normalised = normaliseIsoDate(isoDate);
    if (!normalised) return null;
    const url = new URL(resolveDataUrl(['raw', `${normalised}.json`]));
    if (BUILD_VERSION) {
      url.searchParams.set('v', BUILD_VERSION);
    }
    return fetchJson(url.toString(), { skipScenario: true, appendBuildVersion: false });
  }

  async function loadIndex(){
    const url = new URL(resolveDataUrl(['raw', 'index.json']));
    if (BUILD_VERSION) {
      url.searchParams.set('v', BUILD_VERSION);
    }
    return fetchJson(url.toString(), { skipScenario: true, appendBuildVersion: false });
  }

  g.dataLoader = {
    fetch: fetchJson,
    clear,
    resolveDataUrl,
    loadDayJson,
    loadIndex,
    constants: { BASE_PATH, DATA_BASE_URL, BUILD_VERSION },
    _debug: { cache }
  };
})(window, document);
