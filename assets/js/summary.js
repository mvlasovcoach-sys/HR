(function(){
  const ver = ()=> window.APP_VERSION || '';
  const MIN_N = 5;

  function getRangeKey(){
    try{
      const raw = localStorage.getItem('hr:range');
      const parsed = raw ? JSON.parse(raw) : {preset:'7d'};
      const preset = parsed?.preset;
      if (preset === 'day') return '7d';
      if (preset === '7d' || preset === 'month' || preset === 'year') return preset;
      return 'month';
    }catch{ return '7d'; }
  }

  function getTeamId(){
    try{
      const raw = localStorage.getItem('hr:team');
      if (!raw) return 'all';
      if (raw === 'all') return 'all';
      if (raw.startsWith('{')){
        const parsed = JSON.parse(raw);
        const team = parsed?.team;
        if (!team || team === 'All Teams') return 'all';
        return team;
      }
      return raw;
    }catch{ return 'all'; }
  }

  function teamLabel(id){
    if (!id || id === 'all') return window.I18N?.t('caption.teamAll') || 'All Teams';
    try{
      const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
      if (map && map[id]) return map[id];
    }catch{ /* ignore */ }
    return id;
  }

  async function fetchJSON(path){
    const res = await fetch(`${path}?v=${ver()}`);
    if(!res.ok) throw new Error('Fetch failed: '+path);
    return await res.json();
  }

  function kGuard(n, host){
    if(n>=MIN_N){
      host.removeAttribute('data-guard');
      return false;
    }
    host.setAttribute('data-guard', 'true');
    host.innerHTML = `<div class="kGuard">Aggregated metrics withheld — n < ${MIN_N}.</div>`;
    return true;
  }

  function rangeLabel(){
    const key = getRangeKey();
    const map = {
      '7d': window.I18N?.t('range.7d') || '7 Days',
      month: window.I18N?.t('range.month') || 'Month',
      year: window.I18N?.t('range.year') || 'Year'
    };
    return map[key] || map['7d'];
  }

  function renderCaption(){
    const el = document.getElementById('sum-caption');
    if(!el) return;
    const prefix = window.I18N?.t('caption.orgAverage') || 'Org avg';
    const sep = window.I18N?.t('caption.separator') || ' · ';
    el.textContent = `${prefix}${sep}${rangeLabel()}${sep}${teamLabel(getTeamId())}`;
  }

  function renderKpis(kpi, delta, n){
    const grid = document.getElementById('sum-kpi-grid');
    if(!grid) return;
    if (kGuard(Number(n||0), grid)) return;

    const defs = [
      { key:'wellbeing_avg',         label:()=>window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',     unit:'/100', fmt:v=>Math.round(v) },
      { key:'high_stress_pct',       label:()=>window.I18N?.t('metric.highStress') || 'High Stress',   unit:'%',    fmt:v=>Math.round(v) },
      { key:'fatigue_elevated_pct',  label:()=>window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue',  unit:'%',    fmt:v=>Math.round(v) },
      { key:'engagement_active_pct', label:()=>window.I18N?.t('metric.activeEngagement') || 'Active Engagement', unit:'%',    fmt:v=>Math.round(v) },
    ];
    grid.innerHTML = defs.map(d=>{
      const raw = Number(kpi?.[d.key]);
      const val = Number.isFinite(raw) ? d.fmt(raw) : '—';
      const dRaw = Number(delta?.[d.key]);
      const del  = Number.isFinite(dRaw) ? dRaw : null;
      return `<div class="tile kpi">
        <div class="tile__head">${d.label()}
          ${del!==null ? `<span class="pill ${del>=0?'green':'red'}">${del>=0?'▲':'▼'} ${Math.abs(Math.round(del))}</span>`:''}
        </div>
        <div class="tile__kpi">${val}<small>${d.unit}</small></div>
      </div>`;
    }).join('');
  }

  async function loadAndRender(){
    renderCaption();
    try{
      const m = await fetchJSON(`./data/org/metrics_${getRangeKey()}.json`);
      renderKpis(m.kpi, m.delta||{}, m.n||0);
    }catch(err){
      console.error('Summary metrics failed', err);
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    console.info('Summary init');
    const ready = ()=> loadAndRender();
    if (window.I18N?.onReady){
      window.I18N.onReady(ready);
    }else{
      ready();
    }
    window.addEventListener('storage', (e)=>{
      if(e && (e.key==='hr:range' || e.key==='hr:team')) loadAndRender();
    });
    document.addEventListener('i18n:change', loadAndRender);
  });
})();
