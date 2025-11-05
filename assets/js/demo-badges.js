(function(){
  // Run only in DEMO
  if (!/mode=demo/i.test(location.search)) return;

  // --- DEMO org constants ---
  const ORG = { prod:32, maint:18, lab:16, daySupport:(8+12+14) }; // 34
  const DAY_START = 8, NIGHT_START = 20; // CET, 12h shifts

  function getCETHour(d=new Date()){
    try{
      const p = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',hour12:false})
                 .formatToParts(d).find(x=>x.type==='hour').value;
      return Number(p);
    }catch(_){ return d.getUTCHours(); } // fallback
  }
  function isNightCET(d=new Date()){ const h=getCETHour(d); return (h>=NIGHT_START||h<DAY_START); }

  function split3(n){ const q=Math.floor(n/3), r=n%3; return [q+(r>0), q+(r>1), q]; }

  // expected headcount by team key for current slot
  function expectedMap(now=new Date()){
    const night = isNightCET(now);
    const [pA,pB,pC]=split3(ORG.prod);     // 11,11,10
    const [mA,mB,mC]=split3(ORG.maint);    // 6,6,6
    const [lA,lB,lC]=split3(ORG.lab);      // 6,5,5
    const prod   = night ? pA : pB;
    const maint  = night ? mA : mB;
    const lab    = night ? lA : lB;
    const dsup   = night ? 0 : ORG.daySupport;
    const overall = prod + maint + lab + dsup;
    return {
      'team.all': overall,
      'team.production': prod,
      'team.maint': maint,
      'team.lab': lab,
      'team.day_support': dsup
    };
  }
  // coverage provider (replace with real coverage if you have it in window.demoCoverage)
  function coverage(team){
    const v = (window.demoCoverage && window.demoCoverage[team]);
    if (typeof v === 'number') return Math.max(0, Math.min(1, v));
    return 0.75; // default DEMO
  }

  function currentTeamKey(){
    const el = document.getElementById('teamFilter');
    if (el && el.value) return el.value;
    return 'team.all';
  }

  function attachTeamListener(){
    const el = document.getElementById('teamFilter');
    if (!el || el.dataset.demoBadgeBound === 'true') return false;
    el.addEventListener('change', renderBadges);
    el.dataset.demoBadgeBound = 'true';
    return true;
  }

  function renderBadges(){
    const team = currentTeamKey();
    const map = expectedMap(new Date());
    const expected = map[team] ?? map['team.all'];
    const cov = coverage(team);
    const sample = Math.round(expected * cov);
    const badge = document.getElementById('onDutyBadge');
    if (badge){
      badge.textContent = expected>0
        ? `On duty: ${expected} • Sample: ${sample} (${Math.round(cov*100)}%)`
        : `On duty: 0 • Sample: —`;
    }
    const clock = document.getElementById('clockCET');
    if (clock){
      const fmt = new Intl.DateTimeFormat('en-GB',{
        timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hour12:false
      });
      clock.textContent = fmt.format(new Date()) + ' CET';
    }
  }

  function renderDemoTable(){
    const el = document.getElementById('demoHeadcount');
    if (!el) return;
    const day  = { overall:57, production:11, day_support:34, maint:6, lab:6 };
    const nite = { overall:22, production:11, day_support:0,  maint:6, lab:5 };
    const rows = [
      ['Morning', day],
      ['Day', day],
      ['Evening', day],
      ['Night', nite],
    ];
    el.innerHTML =
      '<table class="demo-table">' +
      '<thead><tr><th>Shift</th><th>Overall</th><th>Production</th><th>Day-Shift Support</th><th>Maintenance & IT</th><th>Lab & HSE</th></tr></thead>' +
      '<tbody>' +
      rows.map(([name,val]) =>
        `<tr><td>${name}</td><td>${val.overall}</td><td>${val.production}</td><td>${val.day_support}</td><td>${val.maint}</td><td>${val.lab}</td></tr>`
      ).join('') +
      '</tbody></table>';
  }

  // init
  function init(){
    renderBadges(); renderDemoTable();
    // update badges every 30s; table every minute (covers Day↔Night boundary)
    setInterval(renderBadges, 30_000);
    setInterval(renderDemoTable, 60_000);
    // listen to team filter changes
    if (!attachTeamListener()) {
      const observer = new MutationObserver(() => {
        if (attachTeamListener()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
