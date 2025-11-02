(function(){
  const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
  const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
  const EVENT_NAME = 'site:ready';
  const GROUPS = {
    ops: ['ops'],
    it: ['it'],
    lab: ['lab'],
    cs: ['adm', 'cat', 'oim']
  };
  const LABELS = {
    ops: 'Production',
    it: 'Maintenance & IT',
    lab: 'Lab & HSE',
    cs: 'Day-Shift Support'
  };
  const visibleRows = Object.keys(GROUPS);
  let dispatched = false;

  async function init(){
    const version = window.APP_VERSION || '';
    const url = new URL('./data/site/demo.json', document.baseURI);
    if (version) {
      url.searchParams.set('v', version);
    }
    let payload = null;
    let error = null;
    try {
      const response = await fetch(url.toString(), {cache: 'no-store'});
      if (!response.ok) {
        throw new Error(`site: failed to load (${response.status})`);
      }
      payload = await response.json();
    } catch (err) {
      error = err;
      devError('site: data load failed', err);
    }

    const site = normalizeSite(payload);
    window.SITE = site;
    dispatched = true;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {site, error}}));
  }

  function normalizeSite(payload){
    const departments = Array.isArray(payload?.departments) ? payload.departments : [];
    const map = {};
    let totalHeadcount = 0;

    visibleRows.forEach(id => {
      const members = GROUPS[id] || [id];
      const label = LABELS[id] || id;
      const headcount = members.reduce((sum, deptId) => {
        const match = departments.find(dept => String(dept.id) === String(deptId));
        const value = Number(match?.headcount);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      map[id] = {id, label, headcount};
      totalHeadcount += headcount;
    });

    return {
      ready: true,
      visibleRows: visibleRows.slice(),
      map,
      totals: {headcount: totalHeadcount},
      raw: payload || null,
      name: payload?.site || 'Org'
    };
  }

  function boot(){
    if (dispatched) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, {once: true});
    } else {
      init();
    }
  }

  if (typeof window !== 'undefined') {
    boot();
  }
})();
