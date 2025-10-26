export function fmtPct(v){
  const value = Number.isFinite(v) ? Math.round(v) : 0;
  return `${value} %`;
}

export function fmtScore(v){
  const value = Number.isFinite(v) ? Math.round(v) : 0;
  return `${value} /100`;
}

export function fmtPts(v){
  const ptsLabel = window.I18N?.t?.('kpi.points') || 'pts';
  if (!Number.isFinite(v) || v === 0) {
    return `± 0 ${ptsLabel}`;
  }
  const sign = v > 0 ? '+' : '−';
  return `${sign} ${Math.abs(Math.round(v))} ${ptsLabel}`;
}

export function fmtUpdated(dt){
  const label = window.I18N?.t?.('kpi.updated', {dt}) || `Updated ${dt}`;
  return label;
}
