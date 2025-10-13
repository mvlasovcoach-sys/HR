(function(){
  const mount = document.getElementById('hr-board');
  if(!mount) return;

  const METRICS = {
    stress:{label:'Stress'},
    burnout:{label:'Burnout'},
    fatigue:{label:'Fatigue'},
    cardio:{label:'Cardio Index'}
  };

  const defaults = {
    stress:{score:42, trend:[48,46,44,43,42,40,41], updated_at:new Date().toISOString()},
    burnout:{score:31, trend:[35,34,33,32,31,30,31], updated_at:new Date().toISOString()},
    fatigue:{score:58, trend:[61,60,59,58,57,58,58], updated_at:new Date().toISOString()},
    cardio:{score:72, trend:[70,71,72,72,73,72,74], updated_at:new Date().toISOString()}
  };

  function readMetric(key){
    try {
      const raw = localStorage.getItem(`hr:${key}`);
      if (!raw) return defaults[key];
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.score === 'number') {
        if (!Array.isArray(parsed.trend) || !parsed.trend.length) parsed.trend = defaults[key].trend;
        return parsed;
      }
    } catch(e){
      // ignore malformed entries
    }
    return defaults[key];
  }

  function readRange(){
    try {
      const raw = localStorage.getItem('hr:range');
      if (!raw) return {preset:'7d'};
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    } catch(e){
      // ignore
    }
    return {preset:'7d'};
  }

  function sparkline(values){
    const points = values && values.length ? values : [0];
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = max - min || 1;
    const step = points.length > 1 ? 100/(points.length-1) : 100;
    const path = points.map((v,i)=>{
      const x = (step*i).toFixed(2);
      const y = (100 - ((v-min)/span)*100).toFixed(2);
      return `${x},${y}`;
    }).join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="var(--cyan)" stroke-width="4" stroke-linecap="round" points="${path}" /></svg>`;
  }

  function level(score){
    if (score >= 75) return 'High';
    if (score >= 50) return 'Moderate';
    return 'Stable';
  }

  function render(){
    const range = readRange();
    const now = new Date();
    const rangeLabel = range.preset ? {
      day:'Daily snapshot',
      '7d':'7-day overview',
      month:'Monthly trend',
      year:'Yearly outlook'
    }[range.preset] || 'Custom range' : 'Custom range';

    const cards = Object.keys(METRICS).map(key=>{
      const metric = readMetric(key);
      const updated = metric.updated_at ? new Date(metric.updated_at) : now;
      const updatedText = isNaN(updated.getTime()) ? 'Updated recently' : `Updated ${updated.toLocaleDateString()}`;
      const trend = Array.isArray(metric.trend) ? metric.trend : defaults[key].trend;
      return `<article class="hr-card">
        <div class="hr-card__ring"></div>
        <div class="hr-card__head">
          <span class="hr-card__label">${METRICS[key].label}</span>
          <span class="hr-badge">${level(metric.score)}</span>
        </div>
        <div class="hr-card__score">${Math.round(metric.score)}<span>/100</span></div>
        <div class="hr-card__spark">${sparkline(trend)}</div>
        <footer class="hr-card__foot">
          <span>${updatedText}</span>
          <span>${trend.length} pts</span>
        </footer>
      </article>`;
    }).join('');

    mount.innerHTML = `<div class="hr-panel__meta">
      <span>HR Board</span>
      <span>${rangeLabel}</span>
    </div>
    <div class="hr-panel__grid">${cards}</div>`;
  }

  render();
  addEventListener('storage', (evt)=>{
    if (!evt.key || evt.key.startsWith('hr:')) {
      render();
    }
  });
})();
