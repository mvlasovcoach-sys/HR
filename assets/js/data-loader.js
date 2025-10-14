(function(){
  const TTL = 60000;
  const cache = new Map();
  let versionWait = null;

  function normalizeRange(range){
    if (!range) return null;
    try {
      if (typeof range === 'string') {
        return {preset: range};
      }
      const {preset, start, end} = range;
      const normalized = {};
      if (preset) normalized.preset = preset;
      if (start) normalized.start = start;
      if (end) normalized.end = end;
      return Object.keys(normalized).length ? normalized : null;
    } catch (e) {
      return null;
    }
  }

  function buildKey(path, range, team, mode){
    return JSON.stringify({path, range: range || null, team: team || 'all', mode: mode || 'json'});
  }

  function readScenario(){
    try {
      return localStorage.getItem('hr:scenario') || 'live';
    } catch (err) {
      return 'live';
    }
  }

  function scenarioPath(path){
    const scenario = readScenario();
    if (scenario !== 'night') return path;
    const suffixes = [
      {match: 'metrics_7d.json', replace: 'night_shift_metrics_7d.json'},
      {match: 'events.json', replace: 'night_shift_events.json'}
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
    if (typeof window.APP_VERSION !== 'undefined') {
      return Promise.resolve(window.APP_VERSION || '');
    }
    if (!versionWait) {
      versionWait = new Promise(resolve => {
        const handler = () => {
          window.removeEventListener('app:version', handler);
          resolve(window.APP_VERSION || '');
        };
        window.addEventListener('app:version', handler, {once: true});
      });
    }
    return versionWait;
  }

  async function fetchJson(path, options={}){
    const range = normalizeRange(options.range);
    const team = options.team || null;
    const mode = options.as || 'json';
    const resolvedPath = scenarioPath(path);
    const key = buildKey(resolvedPath, range, team, mode);
    const now = Date.now();
    if (cache.has(key)) {
      const entry = cache.get(key);
      if (now - entry.ts < TTL) {
        return entry.data;
      }
      cache.delete(key);
    }

    const version = await waitForVersion();
    const url = new URL(resolvedPath, document.baseURI);
    if (version) {
      url.searchParams.set('v', version);
    }

    const resp = await fetch(url.toString(), {cache: 'no-store'});
    if (!resp.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    const data = mode === 'text' ? await resp.text() : await resp.json();
    cache.set(key, {ts: now, data});
    return data;
  }

  function clear(){
    cache.clear();
  }

  window.dataLoader = {
    fetch: fetchJson,
    clear,
    _debug: {cache}
  };
})();
