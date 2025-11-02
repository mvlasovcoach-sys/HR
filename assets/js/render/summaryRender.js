import { AppState } from '../appState.js';
import { DEFAULT_THRESHOLDS } from '../config/thresholds.js';
import { mapToStatus } from '../lib/status.js';
import { calcWellbeing } from '../lib/scores.js';

export function renderSummary() {
  const samples = AppState.samples || [];
  const kpiEl = document.getElementById('kpi-row');
  const trEl = document.getElementById('trends');
  const riskEl = document.getElementById('at-risk');

  if (!kpiEl || !trEl || !riskEl) {
    return;
  }

  kpiEl.innerHTML = trEl.innerHTML = riskEl.innerHTML = '';

  if (!samples.length) {
    const isLive = AppState.mode === 'LIVE';
    const message = isLive
      ? 'No live data yet — switch to Demo to explore sample insights.'
      : 'No data available for this view.';
    riskEl.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  const range = lastNDays(samples, 14);
  const sPts = ts(range, 'stress');
  const bPts = ts(range, 'burnout');
  const fPts = ts(range, 'fatigue');

  const aS = avg(sPts);
  const aB = avg(bPts);
  const aF = avg(fPts);
  const wb = calcWellbeing(aS, aB, aF);

  kpiEl.innerHTML =
    kpiCard('Stress', aS, mapToStatus('stress', aS), spark(sPts)) +
    kpiCard('Burnout', aB, mapToStatus('burnout', aB), spark(bPts)) +
    kpiCard('Fatigue', aF, mapToStatus('fatigue', aF), spark(fPts)) +
    kpiCard('WellBeing', wb, wb >= 80 ? 'OK' : wb >= 60 ? 'WARN' : 'ALERT', compositeSpark(sPts, bPts, fPts));

  trEl.appendChild(trendBlock('Stress', sPts, DEFAULT_THRESHOLDS.stress));
  trEl.appendChild(trendBlock('Burnout', bPts, DEFAULT_THRESHOLDS.burnout));
  trEl.appendChild(trendBlock('Fatigue', fPts, DEFAULT_THRESHOLDS.fatigue));

  riskEl.appendChild(atRiskTable(buildAtRisk(range).slice(0, 10)));
}

// --- helpers ---
function lastNDays(list, n) {
  return [...list]
    .filter(item => item?.ts)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
    .slice(-n);
}

function ts(list, key) {
  return list
    .map(sample => ({
      ts: sample?.ts,
      value: Number(sample?.scores?.[key]) || 0
    }))
    .filter(point => point.ts != null);
}

function avg(arr) {
  if (!arr.length) {
    return 0;
  }
  const total = arr.reduce((acc, point) => acc + (Number(point.value) || 0), 0);
  return Math.round(total / arr.length);
}

function spark(points) {
  return points.map(point => Number(point.value) || 0);
}

function compositeSpark(s, b, f) {
  const len = Math.min(s.length, b.length, f.length);
  if (!len) {
    return [];
  }
  const out = [];
  for (let i = 0; i < len; i += 1) {
    const stress = Number(s[i]?.value) || 0;
    const burnout = Number(b[i]?.value) || 0;
    const fatigue = Number(f[i]?.value) || 0;
    out.push(100 - Math.round((stress + burnout + fatigue) / 3));
  }
  return out;
}

function buildAtRisk(list) {
  const by = new Map();
  list.forEach(sample => {
    if (!sample) return;
    const id = sample.person_id || sample.personId || 'unknown';
    const curr = by.get(id) || { id, stress: [], burnout: [], fatigue: [] };
    const stress = Number(sample?.scores?.stress);
    const burnout = Number(sample?.scores?.burnout);
    const fatigue = Number(sample?.scores?.fatigue);
    if (!Number.isNaN(stress)) curr.stress.push(stress);
    if (!Number.isNaN(burnout)) curr.burnout.push(burnout);
    if (!Number.isNaN(fatigue)) curr.fatigue.push(fatigue);
    by.set(id, curr);
  });

  const rows = [...by.values()].map(entry => {
    const S = averageArray(entry.stress);
    const B = averageArray(entry.burnout);
    const F = averageArray(entry.fatigue);
    const max = Math.max(S, B, F);
    return {
      id: entry.id,
      name: entry.id,
      stress: S,
      burnout: B,
      fatigue: F,
      maxStatus: max <= 39 ? 'OK' : max <= 59 ? 'WARN' : 'ALERT'
    };
  });

  return rows.sort((a, b) => b.stress + b.burnout + b.fatigue - (a.stress + a.burnout + a.fatigue));
}

function averageArray(list) {
  if (!list.length) {
    return 0;
  }
  const total = list.reduce((acc, value) => acc + value, 0);
  return Math.round(total / list.length);
}

function kpiCard(title, val, status, sparkline) {
  return `<div class="card p-4 rounded-lg">
    <div class="text-sm opacity-70">${title}</div>
    <div class="text-3xl font-bold">${val}<span class="text-sm opacity-60">/100</span></div>
    <div class="mt-1 text-xs">${status}</div>
  </div>`;
}

function trendBlock(title, points, th) {
  const el = document.createElement('div');
  el.className = 'card p-4 rounded-lg';
  const latest = points.at(-1)?.value;
  el.innerHTML = `<div class="text-sm opacity-70 mb-2">${title}</div>
                  <div class="text-xs">${statusText(latest, th)}</div>`;
  return el;
}

function statusText(v, t) {
  if (v == null || !t) return '-';
  return v <= t.okMax ? 'OK' : v <= t.warnMax ? 'WARN' : 'ALERT';
}

function atRiskTable(rows) {
  const el = document.createElement('div');
  el.className = 'card p-4 rounded-lg';
  el.innerHTML = `<div class="text-sm opacity-70 mb-2">At-Risk (Top-10)</div>
    <table class="w-full text-sm opacity-90">
      <thead><tr><th class="text-left">Person</th><th>Stress</th><th>Burnout</th><th>Fatigue</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.name}</td><td>${r.stress}</td><td>${r.burnout}</td><td>${r.fatigue}</td><td>${r.maxStatus}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  return el;
}
