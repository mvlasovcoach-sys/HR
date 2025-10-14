(function(){
  const ver = ()=> window.APP_VERSION || '';
  const MIN_N = 5;

  function getRangeKey(){
    try{
      const r = JSON.parse(localStorage.getItem('hr:range')||'{"preset":"7d"}');
      const p = r.preset || '7d';
      if (p==='day') return '7d';
      if (p==='7d' || p==='month' || p==='year') return p;
      return 'month';
    }catch{ return '7d'; }
  }
  function getTeam(){
    try{
      const t = JSON.parse(localStorage.getItem('hr:team')||'{"team":"All Teams"}');
      return t.team || 'All Teams';
    }catch{ return 'All Teams'; }
  }
  async function fetchJSON(path){
    const res = await fetch(`${path}?v=${ver()}`);
    if(!res.ok) throw new Error('Fetch failed: '+path);
    return await res.json();
  }
  function kGuard(n, host){
    if(n>=MIN_N) return false;
    host.innerHTML = `<div class="kGuard">Insufficient group size (n=${n}) to display aggregated metrics.</div>`;
    return true;
  }
  function renderCaption(){
    const el = document.getElementById('sum-caption');
    if(!el) return;
    const rangeKey = getRangeKey();
    const rangeLabel = rangeKey==='7d' ? '7 Days' : rangeKey==='month' ? 'Month' : 'Year';
    el.textContent = `Org avg · ${rangeLabel} · ${getTeam()}`;
  }

  function renderKpis(kpi, delta, n){
    const grid = document.getElementById('sum-kpi-grid');
    if(!grid) return;
    if (kGuard(Number(n||0), grid)) return;

    const defs = [
      { key:'wellbeing_avg',         label:'Org Wellbeing',     unit:'/100', fmt:v=>Math.round(v) },
      { key:'high_stress_pct',       label:'High Stress',       unit:'%',    fmt:v=>Math.round(v) },
      { key:'fatigue_elevated_pct',  label:'Elevated Fatigue',  unit:'%',    fmt:v=>Math.round(v) },
      { key:'engagement_active_pct', label:'Active Engagement', unit:'%',    fmt:v=>Math.round(v) },
    ];
    grid.innerHTML = defs.map(d=>{
      const raw = Number(kpi?.[d.key]);
      const val = Number.isFinite(raw) ? d.fmt(raw) : '—';
      const dRaw = Number(delta?.[d.key]);
      const del  = Number.isFinite(dRaw) ? dRaw : null;
      return `<div class="tile kpi">
        <div class="tile__head">${d.label}
          ${del!==null ? `<span class="pill ${del>=0?'green':'red'}">${del>=0?'▲':'▼'} ${Math.abs(Math.round(del))}</span>`:''}
        </div>
        <div class="tile__kpi">${val}<small>${d.unit}</small></div>
      </div>`;
    }).join('');
  }

  async function loadAndRender(){
    renderCaption();
    const m = await fetchJSON(`./data/org/metrics_${getRangeKey()}.json`);
    renderKpis(m.kpi, m.delta||{}, m.n||0);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    I18N.onReady(loadAndRender);
    window.addEventListener('storage', (e)=>{
      if(e.key==='hr:range' || e.key==='hr:team') loadAndRender();
    });
  });
})();
