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

  function waitForVersion(){
    if (window.APP_VERSION) {
      return Promise.resolve(window.APP_VERSION);
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
    const key = buildKey(path, range, team, mode);
    const now = Date.now();
    if (cache.has(key)) {
      const entry = cache.get(key);
      if (now - entry.ts < TTL) {
        return entry.data;
      }
      cache.delete(key);
    }

    const version = await waitForVersion();
    const url = new URL(path, document.baseURI);
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
