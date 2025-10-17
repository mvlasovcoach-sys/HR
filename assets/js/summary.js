(function(){
  console.info('Summary init');
  const TILE_COUNT = 4;

  const state = {
    loading: false
  };

  document.addEventListener('DOMContentLoaded', () => {
    const start = () => {
      renderSkeleton();
      loadAndRender();
    };
    if (window.I18N?.onReady) {
      window.I18N.onReady(start);
    } else {
      start();
    }
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
        renderSkeleton();
        if (evt.key === 'hr:scenario') updateScenarioButtons();
        loadAndRender();
      }
    });
    document.addEventListener('i18n:change', () => {
      renderCaption();
      if (!state.loading) {
        loadAndRender();
      }
    });
    bindTileNavigation();
    bindScenarioControls();
  });

  function bindTileNavigation(){
    document.getElementById('sum-kpi-grid')?.addEventListener('click', evt => {
      const tile = evt.target.closest('.tile');
      if (!tile) return;
      const params = new URLSearchParams();
      params.set('team', getTeamId());
      params.set('range', getRangeKey());
      window.location.href = `./Analytics.html?${params.toString()}`;
    });
  }

  function bindScenarioControls(){
    const loadBtn = document.getElementById('btn-night-scenario');
    const resetBtn = document.getElementById('btn-night-reset');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        setScenario('night');
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        setScenario('live');
      });
    }
    updateScenarioButtons();
  }

  function setScenario(mode){
    try {
      const prev = localStorage.getItem('hr:scenario') || 'live';
      const next = mode === 'night' ? 'night' : 'live';
      if (prev === next) return;
      localStorage.setItem('hr:scenario', next);
      window.dataLoader?.clear?.();
      dispatchEvent(new StorageEvent('storage', {key: 'hr:scenario'}));
    } catch (err) {
      console.warn('scenario set failed', err);
    }
    updateScenarioButtons();
    renderSkeleton();
    loadAndRender();
  }

  function readScenario(){
    try {
      return localStorage.getItem('hr:scenario') || 'live';
    } catch (err) {
      return 'live';
    }
  }

  function updateScenarioButtons(){
    const scenario = readScenario();
    const loadBtn = document.getElementById('btn-night-scenario');
    const resetBtn = document.getElementById('btn-night-reset');
    loadBtn?.setAttribute('aria-pressed', String(scenario === 'night'));
    resetBtn?.setAttribute('aria-pressed', String(scenario !== 'night'));
    if (scenario === 'night') {
      loadBtn?.classList.add('is-active');
      resetBtn?.classList.remove('is-active');
    } else {
      resetBtn?.classList.add('is-active');
      loadBtn?.classList.remove('is-active');
    }
  }

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

  function rangeLabel(){
    const key = getRangeKey();
    const map = {
      '7d': window.I18N?.t('range.7d') || '7 Days',
      month: window.I18N?.t('range.month') || 'Month',
      year: window.I18N?.t('range.year') || 'Year'
    };
    return map[key] || map['7d'];
  }

  function scenarioPrefix(){
    const scenario = readScenario();
    if (scenario !== 'night') return '';
    return window.I18N?.t('caption.scenarioPrefix') || 'Night-Shift Scenario · ';
  }

  function renderCaption(){
    const el = document.getElementById('sum-caption');
    if(!el) return;
    const prefix = window.I18N?.t('caption.orgAvg') || window.I18N?.t('caption.orgAverage') || 'Org avg';
    const sep = window.I18N?.t('caption.separator') || ' · ';
    el.textContent = `${scenarioPrefix()}${prefix}${sep}${rangeLabel()}${sep}${teamLabel(getTeamId())}`;
  }

  function renderSkeleton(){
    const grid = document.getElementById('sum-kpi-grid');
    if (!grid) return;
    const skeleton = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      skeleton.push(`<div class="tile tile--skeleton skeleton" aria-hidden="true">
        <div class="tile__head"><span class="skeleton skeleton--text"></span></div>
        <div class="tile__meta"><span class="skeleton skeleton--pill"></span></div>
        <div class="tile__kpi"><span class="skeleton skeleton--value"></span></div>
        <div class="spark"><span class="skeleton skeleton--spark"></span></div>
      </div>`);
    }
    grid.innerHTML = skeleton.join('');
  }

  async function loadAndRender(){
    state.loading = true;
    renderCaption();
    const grid = document.getElementById('sum-kpi-grid');
    if (!grid) return;
    try{
      const [metrics, trend] = await Promise.all([
        window.dataLoader.fetch(`./data/org/metrics_${getRangeKey()}.json`),
        window.dataLoader.fetch('./data/org/metrics_7d.json')
      ]);
      renderKpis(metrics, trend);
    }catch(err){
      console.error('Summary metrics failed', err);
      grid.innerHTML = '';
      toast(window.I18N?.t('toast.summaryError') || window.I18N?.t('status.noData') || 'Unable to load data');
    } finally {
      state.loading = false;
    }
  }

  function renderKpis(metrics, trend){
    const grid = document.getElementById('sum-kpi-grid');
    if(!grid) return;
    const kpi = metrics?.kpi || {};
    const delta = metrics?.delta || {};
    const nValue = Number(metrics?.n);
    grid.innerHTML = '';
    if (Number.isFinite(nValue) && window.guardSmallN && window.guardSmallN(nValue, grid)) {
      return;
    }
    if (!Number.isFinite(nValue)) {
      grid.removeAttribute('data-guard');
    }

    const updatedDate = lastDate(metrics?.heatmap?.dates);
    const updatedLabel = updatedDate ? `${window.I18N?.t('ui.updated') || window.I18N?.t('label.updated') || 'Updated'} ${formatDate(updatedDate)}` : '';
    const sparkSeries = buildSparkSeries(trend?.heatmap);

    const defs = [
      { key:'wellbeing_avg',         label:()=>window.I18N?.t('kpi.orgWellbeing') || window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',     unit:'/100', fmt:v=>Math.round(v) },
      { key:'high_stress_pct',       label:()=>window.I18N?.t('kpi.highStress') || window.I18N?.t('metric.highStress') || 'High Stress %',   unit:'%',    fmt:v=>Math.round(v) },
      { key:'fatigue_elevated_pct',  label:()=>window.I18N?.t('kpi.elevatedFatigue') || window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue %',  unit:'%',    fmt:v=>Math.round(v) },
      { key:'engagement_active_pct', label:()=>window.I18N?.t('kpi.activeEngagement') || window.I18N?.t('metric.activeEngagement') || 'Active Engagement %', unit:'%',    fmt:v=>Math.round(v) }
    ];

    grid.innerHTML = defs.map((d, index)=>{
      const raw = Number(kpi?.[d.key]);
      const val = Number.isFinite(raw) ? d.fmt(raw) : '—';
      const dRaw = Number(delta?.[d.key]);
      const del  = Number.isFinite(dRaw) ? dRaw : null;
      const badge = del!==null ? `<span class="pill ${del>=0?'pill--strong':'pill--critical'}">${del>=0?'▲':'▼'} ${Math.abs(Math.round(del))}</span>`:'';
      const spark = sparkline(sparkSeries);
      return `<div class="tile tile--interactive kpi" data-index="${index}">
        <div class="tile__head">${d.label()} ${badge}</div>
        <div class="tile__meta">${updatedLabel}</div>
        <div class="tile__kpi">${val}<small>${d.unit}</small></div>
        <div class="spark">${spark}</div>
      </div>`;
    }).join('');
  }

  function buildSparkSeries(heatmap){
    if (!heatmap || !heatmap.value || !heatmap.cols) return [];
    const cols = heatmap.cols.length;
    if (!cols) return [];
    const series = new Array(cols).fill(0);
    const counts = new Array(cols).fill(0);
    Object.values(heatmap.value).forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach((value, index) => {
        const num = Number(value);
        if (Number.isFinite(num)) {
          series[index] += num;
          counts[index] += 1;
        }
      });
    });
    return series.map((sum, index) => counts[index] ? sum / counts[index] : null);
  }

  function sparkline(values){
    const points = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
    if (!points.length) return '';
    const width = 64;
    const height = 24;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const path = points.map((val, idx) => {
      const x = (idx / (points.length - 1 || 1)) * width;
      const y = height - ((val - min) / span) * height;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  }

  function formatDate(dateStr){
    try {
      const lang = window.I18N?.getLang?.() || 'en';
      const formatter = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'});
      return formatter.format(new Date(dateStr));
    } catch (err) {
      return dateStr;
    }
  }

  function lastDate(dates){
    if (!Array.isArray(dates) || !dates.length) return null;
    return dates[dates.length - 1];
  }

  function toast(message){
    if (!message) return;
    const host = document.getElementById('sum-toast');
    if (!host) return;
    host.textContent = message;
    host.classList.add('is-visible');
    clearTimeout(host._hideTimer);
    host._hideTimer = setTimeout(() => {
      host.classList.remove('is-visible');
    }, 3200);
  }
})();
