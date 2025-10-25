(function(g){
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
    const response = await fetch(url.toString(), {cache: 'no-store', ...rest});
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const mode = (options && options.as) || 'json';
    return mode === 'text' ? response.text() : response.json();
  }

  const API = {
    async fetch(path, options){
      if (g.dataLoader?.fetch) {
        return g.dataLoader.fetch(path, options || {});
      }
      return directFetch(path, options || {});
    },
    async fetchJSON(path, options){
      const opts = Object.assign({}, options, { as: 'json' });
      return this.fetch(path, opts);
    },
    clearCache(){
      g.dataLoader?.clear?.();
    }
  };

  g.API = API;
})(window);
