(function(g){
  const loaderGlobals = g.loaderGlobals || {};
  const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : (url => url);
  const loadJson = typeof loaderGlobals.fetchJson === 'function'
    ? loaderGlobals.fetchJson
    : async url => {
        const response = await fetch(url, {cache: 'no-store'});
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      };

  async function directFetch(path, options){
    const {range, team, params, ...rest} = options || {};
    const url = new URL(path, document.baseURI);
    if (range && typeof range === 'object') {
      Object.entries(range).forEach(([key, value])=>{
        if (value != null) url.searchParams.set(key, value);
      });
    }
    if (team) {
      url.searchParams.set('team', team);
    }
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value])=>{
        if (value != null) url.searchParams.set(key, value);
      });
    }
    const finalUrl = applyVersion(url.toString());
    const mode = (options && options.as) || 'json';
    if (mode === 'json') {
      return loadJson(finalUrl);
    }
    const response = await fetch(finalUrl, {cache: 'no-store', ...rest});
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return response.text();
  }

  const API = {
    async fetch(path, options){
      return directFetch(path, options || {});
    },
    async fetchJSON(path, options){
      const opts = Object.assign({}, options, { as: 'json' });
      return directFetch(path, opts);
    },
    clearCache(){
      if (typeof loaderGlobals.clearCache === 'function') {
        loaderGlobals.clearCache();
      }
    }
  };

  g.API = API;
})(window);
