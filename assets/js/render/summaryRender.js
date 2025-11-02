import { AppState } from '../appState.js';
import { DEFAULT_THRESHOLDS } from '../config/thresholds.js';
import { mapToStatus } from '../lib/status.js';
import { calcWellbeing } from '../lib/scores.js';

export function renderSummary() {
  const samples = AppState.samples || [];
  const root = document.getElementById('summary-root');
  const kpiEl = document.getElementById('kpi-row');
  const trEl = document.getElementById('trends');
  const riskEl = document.getElementById('at-risk');

  if (!root || !kpiEl || !trEl || !riskEl) {
    return;
  }

  clearSections(kpiEl, trEl, riskEl);
  clearEmptyCard(root);

  if (!samples.length) {
    showEmptyState(root, kpiEl, trEl, riskEl, emptyMessage(AppState.mode));
    window.__currentView = { mode: AppState.mode, empty: true };
    return;
  }

  const range = lastNDays(samples, 14);
  if (!range.length) {
    showEmptyState(root, kpiEl, trEl, riskEl, 'No data available for the selected range.');
    window.__currentView = { mode: AppState.mode, empty: true };
    return;
  }

  showSections(kpiEl, trEl, riskEl);

  const stressTrend = ts(range, 'stress');
  const burnoutTrend = ts(range, 'burnout');
  const fatigueTrend = ts(range, 'fatigue');

  const avgStress = avg(stressTrend);
  const avgBurnout = avg(burnoutTrend);
  const avgFatigue = avg(fatigueTrend);
  const wellbeing = calcWellbeing(avgStress, avgBurnout, avgFatigue);

  const kpis = [
    { metric: 'stress', label: 'Stress', value: avgStress, status: mapToStatus('stress', avgStress), sparkline: spark(stressTrend) },
    { metric: 'burnout', label: 'Burnout', value: avgBurnout, status: mapToStatus('burnout', avgBurnout), sparkline: spark(burnoutTrend) },
    { metric: 'fatigue', label: 'Fatigue', value: avgFatigue, status: mapToStatus('fatigue', avgFatigue), sparkline: spark(fatigueTrend) },
    { metric: 'wellbeing', label: 'WellBeing', value: wellbeing, status: wellbeingStatus(wellbeing), sparkline: compositeSpark(stressTrend, burnoutTrend, fatigueTrend) }
  ];

  kpiEl.innerHTML = kpis.map(kpi => kpiCard(kpi)).join('');

  trEl.appendChild(trendBlock('Stress', stressTrend, DEFAULT_THRESHOLDS.stress));
  trEl.appendChild(trendBlock('Burnout', burnoutTrend, DEFAULT_THRESHOLDS.burnout));
  trEl.appendChild(trendBlock('Fatigue', fatigueTrend, DEFAULT_THRESHOLDS.fatigue));

  const atRiskRows = buildAtRisk(range).slice(0, 10);
  riskEl.appendChild(atRiskTable(atRiskRows));

  window.__currentView = {
    mode: AppState.mode,
    window: rangeMeta(range),
    kpis: kpis.map(entry => ({
      metric: entry.metric,
      label: entry.label,
      value: entry.value,
      status: entry.status,
      sparkline: entry.sparkline
    })),
    trends: {
      stress: stressTrend,
      burnout: burnoutTrend,
      fatigue: fatigueTrend
    },
    atRisk: atRiskRows
  };
}

// --- helpers ---
function emptyMessage(mode) {
  return mode === 'LIVE'
    ? 'Live mode enabled. Switch to Demo.'
    : 'No data available for the selected range.';
}

function clearSections(...sections) {
  sections.forEach(section => {
    if (section) {
      section.innerHTML = '';
    }
  });
}

function showSections(...sections) {
  sections.forEach(section => {
    if (section) {
      section.removeAttribute('hidden');
    }
  });
}

function showEmptyState(root, kpiEl, trEl, riskEl, message) {
  [kpiEl, trEl, riskEl].forEach(section => {
    if (section) {
      section.setAttribute('hidden', '');
      section.innerHTML = '';
    }
  });

  const card = document.createElement('div');
  card.className = 'card summary-empty-card';
  card.innerHTML = `<p>${message}</p>`;
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  root.insertBefore(card, root.firstChild);
}

function clearEmptyCard(root) {
  const emptyCard = root.querySelector('.summary-empty-card');
  if (emptyCard) {
    emptyCard.remove();
  }
}

function lastNDays(list, n) {
  return [...list]
    .filter(item => item?.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
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

function compositeSpark(stress, burnout, fatigue) {
  const len = Math.min(stress.length, burnout.length, fatigue.length);
  if (!len) {
    return [];
  }
  const out = [];
  for (let i = 0; i < len; i += 1) {
    const s = Number(stress[i]?.value) || 0;
    const b = Number(burnout[i]?.value) || 0;
    const f = Number(fatigue[i]?.value) || 0;
    out.push(100 - Math.round((s + b + f) / 3));
  }
  return out;
}

function wellbeingStatus(value) {
  if (value >= 80) return 'OK';
  if (value >= 60) return 'WARN';
  return 'ALERT';
}

function rangeMeta(range) {
  if (!Array.isArray(range) || range.length === 0) {
    return { from: null, to: null, points: 0 };
  }
  const sorted = [...range]
    .filter(item => item?.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const from = sorted[0]?.ts ? new Date(sorted[0].ts).toISOString() : null;
  const to = sorted.at(-1)?.ts ? new Date(sorted.at(-1).ts).toISOString() : null;
  return {
    from,
    to,
    points: sorted.length
  };
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

function kpiCard({ label, value, status, sparkline }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  return `<div class="card summary-kpi-card">
    <div class="summary-kpi-label">${label}</div>
    <div class="summary-kpi-value">${safeValue}<span class="summary-kpi-unit">/100</span></div>
    <div class="summary-kpi-status">${statusPill(status)}</div>
    <div class="summary-kpi-chart">${renderSparkline(sparkline)}</div>
  </div>`;
}

function trendBlock(title, points, thresholds) {
  const el = document.createElement('div');
  el.className = 'card summary-trend-card';
  const latest = points.at(-1)?.value;
  const latestValue = Number.isFinite(latest) ? Math.round(latest) : null;
  el.innerHTML = `<div class="summary-trend-head">
      <div class="summary-trend-meta">
        <div class="summary-trend-label">${title}</div>
        <div class="summary-trend-value">${latestValue != null ? latestValue : '–'}</div>
      </div>
      <div class="summary-trend-status">${statusPill(statusText(latest, thresholds))}</div>
    </div>
    <div class="summary-trend-chart">${renderTrendChart(points)}</div>`;
  return el;
}

function statusText(value, thresholds) {
  if (value == null || !thresholds) return '-';
  return value <= thresholds.okMax ? 'OK' : value <= thresholds.warnMax ? 'WARN' : 'ALERT';
}

function atRiskTable(rows) {
  const el = document.createElement('div');
  el.className = 'card summary-at-risk';
  if (!rows.length) {
    el.innerHTML = `<div class="summary-section-title">At-Risk (Top-10)</div>
      <div class="summary-at-risk-empty">All clear for now.</div>`;
    return el;
  }
  el.innerHTML = `<div class="summary-section-title">At-Risk (Top-10)</div>
    <table>
      <thead><tr><th scope="col">Person</th><th scope="col">Stress</th><th scope="col">Burnout</th><th scope="col">Fatigue</th><th scope="col">Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <th scope="row">${r.name}</th>
        <td>${formatCell(r.stress)}</td>
        <td>${formatCell(r.burnout)}</td>
        <td>${formatCell(r.fatigue)}</td>
        <td>${statusPill(r.maxStatus)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  return el;
}

function statusPill(status) {
  const value = typeof status === 'string' && status ? status.toUpperCase() : '-';
  return `<span class="summary-status summary-status--${value.toLowerCase()}">${value}</span>`;
}

function formatCell(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '–';
  }
  return Math.round(Number(value));
}

function clamp(value, min = 0, max = 100) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function renderSparkline(values) {
  const series = Array.isArray(values) ? values : [];
  if (!series.length) {
    return '<div class="summary-sparkline-empty">No points</div>';
  }
  const width = 100;
  const height = 36;
  const points = toLinePoints(series, width, height);
  const line = buildLinePath(points);
  const area = buildAreaPath(points, width, height);
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="summary-spark-area" d="${area}"></path>
    <path class="summary-spark-line" d="${line}"></path>
  </svg>`;
}

function renderTrendChart(points) {
  const width = 120;
  const height = 70;
  const values = Array.isArray(points) ? points.map(point => clamp(point?.value)) : [];
  if (!values.length) {
    return '<div class="summary-trend-empty">No recent data</div>';
  }
  const coords = toLinePoints(values, width, height - 10);
  const line = buildLinePath(coords);
  const area = buildAreaPath(coords, width, height - 10);
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Trend from 0 to 100">
    <g class="trend-axis">
      <line x1="0" y1="${height - 10}" x2="${width}" y2="${height - 10}"></line>
      <line x1="0" y1="${(height - 10) / 2}" x2="${width}" y2="${(height - 10) / 2}" class="trend-axis-mid"></line>
      <line x1="0" y1="0" x2="${width}" y2="0"></line>
      <text x="${width - 6}" y="10" class="trend-axis-label">100</text>
      <text x="${width - 6}" y="${height - 14}" class="trend-axis-label">50</text>
      <text x="${width - 6}" y="${height - 2}" class="trend-axis-label">0</text>
    </g>
    <path class="trend-area" d="${area}"></path>
    <path class="trend-line" d="${line}"></path>
  </svg>`;
}

function toLinePoints(values, width, height) {
  const len = values.length;
  if (!len) return [];
  const step = len > 1 ? width / (len - 1) : 0;
  return values.map((value, index) => {
    const x = len === 1 ? width / 2 : Number((index * step).toFixed(2));
    const y = Number((height - (clamp(value) / 100) * height).toFixed(2));
    return { x, y };
  });
}

function buildLinePath(points) {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points, width, height) {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const commands = [`M0 ${height}`, `L${first.x} ${height}`];
  points.forEach(point => {
    commands.push(`L${point.x} ${point.y}`);
  });
  commands.push(`L${last.x} ${height}`);
  if (last.x !== width) {
    commands.push(`L${width} ${height}`);
  }
  commands.push('Z');
  return commands.join(' ');
}
