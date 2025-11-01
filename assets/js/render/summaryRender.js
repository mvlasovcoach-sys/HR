import { AppState } from '../appState.js';
import { DEFAULT_THRESHOLDS } from '../modules/config/thresholds.js';
import { mapToStatus } from '../modules/lib/status.js';
import { calcWellbeing } from '../modules/lib/scores.js';

const KPI_LABELS = {
  stress: 'Stress',
  burnout: 'Burnout',
  fatigue: 'Fatigue',
  wellbeing: 'Wellbeing'
};

const METRIC_DESCRIPTIONS = {
  stress: 'Crew stress in the selected window',
  burnout: 'Burnout accumulation over weeks',
  fatigue: 'Average fatigue from sleep debt',
};

export function renderSummary(){
  const root = document.getElementById('summary-root');
  if (!root) return;

  const samples = AppState.samples || [];
  if (!samples.length){
    root.innerHTML = `<div class="empty">No data for selected range</div>`;
    return;
  }

  root.innerHTML = `
    <div class="summary-sections">
      <div id="kpi-row" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"></div>
      <div id="trends" class="grid lg:grid-cols-3 gap-6"></div>
      <div id="at-risk"></div>
    </div>
  `;

  const range = lastNDays(samples, 14);
  const stressPts  = timeseries(range, 'stress');
  const burnoutPts = timeseries(range, 'burnout');
  const fatiguePts = timeseries(range, 'fatigue');

  const avgS = avg(stressPts);
  const avgB = avg(burnoutPts);
  const avgF = avg(fatiguePts);
  const wb = calcWellbeing(avgS, avgB, avgF);

  renderKpiRow({
    stress:  { value: avgS, status: mapToStatus('stress',  avgS),  trend: spark(stressPts)  },
    burnout: { value: avgB, status: mapToStatus('burnout', avgB), trend: spark(burnoutPts) },
    fatigue: { value: avgF, status: mapToStatus('fatigue', avgF), trend: spark(fatiguePts) },
    wellbeing: {
      value: wb,
      status: wb >= 80 ? 'OK' : wb >= 60 ? 'WARN' : 'ALERT',
      trend: compositeSpark(stressPts, burnoutPts, fatiguePts)
    }
  });

  renderTrend('stress',  stressPts,  DEFAULT_THRESHOLDS.stress);
  renderTrend('burnout', burnoutPts, DEFAULT_THRESHOLDS.burnout);
  renderTrend('fatigue', fatiguePts, DEFAULT_THRESHOLDS.fatigue);

  renderAtRisk(buildAtRiskRows(range).slice(0, 10));
}

function renderKpiRow(summary){
  const host = document.getElementById('kpi-row');
  if (!host) return;
  const entries = ['stress', 'burnout', 'fatigue', 'wellbeing'];
  host.innerHTML = entries.map(key => {
    const item = summary[key] || {};
    const value = formatScore(item.value);
    const status = normaliseStatus(item.status);
    const sparkline = createSparkSvg(item.trend || []);
    return `
      <article class="card summary-card" data-kpi="${key}">
        <header class="card__head">
          <h3>${KPI_LABELS[key] || key}</h3>
          <span class="status status--${status.toLowerCase()}">${status}</span>
        </header>
        <div class="card__body">
          <div class="score">${value}</div>
          <div class="sparkline" aria-hidden="true">${sparkline}</div>
        </div>
      </article>
    `;
  }).join('');
}

function renderTrend(metric, points, thresholds){
  const host = document.getElementById('trends');
  if (!host) return;
  const section = document.createElement('article');
  section.className = 'card trend-card';
  const values = points.map(point => formatScore(point.value)).join(', ');
  const rangeLabel = thresholds
    ? `OK ≤ ${thresholds.okMax} / WARN ≤ ${thresholds.warnMax}`
    : '';
  section.innerHTML = `
    <header class="card__head">
      <h3>${KPI_LABELS[metric] || metric}</h3>
      <span class="muted">${METRIC_DESCRIPTIONS[metric] || ''}</span>
    </header>
    <div class="card__body">
      <div class="sparkline" aria-hidden="true">${createSparkSvg(points.map(p => p.value))}</div>
      <div class="trend-meta">
        <div class="meta-label">Recent values</div>
        <div class="meta-values">${values}</div>
        ${rangeLabel ? `<div class="meta-thresholds">${rangeLabel}</div>` : ''}
      </div>
    </div>
  `;
  host.appendChild(section);
}

function renderAtRisk(rows){
  const host = document.getElementById('at-risk');
  if (!host) return;
  if (!rows.length){
    host.innerHTML = `<div class="card"><div class="card__body empty">No individuals flagged as at risk</div></div>`;
    return;
  }

  const header = `
    <thead>
      <tr>
        <th scope="col">Employee</th>
        <th scope="col">Stress</th>
        <th scope="col">Burnout</th>
        <th scope="col">Fatigue</th>
        <th scope="col">Status</th>
        <th scope="col">Drivers</th>
      </tr>
    </thead>
  `;

  const body = rows.map(row => {
    const status = normaliseStatus(row.status);
    const drivers = Array.isArray(row.drivers) ? row.drivers : [];
    return `
    <tr>
      <th scope="row">${row.name}</th>
      <td>${formatScore(row.stress)}</td>
      <td>${formatScore(row.burnout)}</td>
      <td>${formatScore(row.fatigue)}</td>
      <td><span class="status status--${status.toLowerCase()}">${status}</span></td>
      <td>${drivers.length ? drivers.join(', ') : '—'}</td>
    </tr>
  `;}).join('');

  host.innerHTML = `
    <article class="card at-risk-card">
      <header class="card__head"><h3>At-risk individuals</h3></header>
      <div class="card__body">
        <div class="table-wrapper">
          <table>${header}<tbody>${body}</tbody></table>
        </div>
      </div>
    </article>
  `;
}

function lastNDays(samples, n){
  if (!Array.isArray(samples) || !samples.length) return [];
  const sorted = samples
    .slice()
    .filter(sample => sample && sample.ts)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const latestTs = new Date(sorted[0].ts).getTime();
  if (!Number.isFinite(latestTs)) {
    return sorted.slice().reverse();
  }
  const cutoff = latestTs - (n - 1) * 24 * 60 * 60 * 1000;
  return sorted
    .filter(sample => {
      const ts = new Date(sample.ts).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

function timeseries(list, key){
  if (!Array.isArray(list)) return [];
  const grouped = new Map();
  list.forEach(sample => {
    const ts = sample?.ts;
    const value = sample?.scores?.[key];
    if (!ts || typeof value !== 'number') return;
    const day = ts.slice(0, 10);
    const bucket = grouped.get(day) || [];
    bucket.push(value);
    grouped.set(day, bucket);
  });
  return Array.from(grouped.entries())
    .map(([day, values]) => {
      const avgValue = values.reduce((acc, num) => acc + num, 0) / Math.max(1, values.length);
      return { ts: `${day}T00:00:00.000Z`, value: Math.round(avgValue) };
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

function avg(points){
  if (!Array.isArray(points) || !points.length) return 0;
  const total = points.reduce((acc, point) => acc + (Number(point.value) || 0), 0);
  return Math.round(total / points.length);
}

function spark(points){
  if (!Array.isArray(points)) return [];
  return points.map(point => Math.round(Number(point.value) || 0));
}

function compositeSpark(stress, burnout, fatigue){
  const length = Math.min(stress.length, burnout.length, fatigue.length);
  if (!length) return [];
  const combined = [];
  for (let i = 0; i < length; i += 1){
    const s = Number(stress[i]?.value) || 0;
    const b = Number(burnout[i]?.value) || 0;
    const f = Number(fatigue[i]?.value) || 0;
    combined.push(calcWellbeing(s, b, f));
  }
  return combined;
}

function buildAtRiskRows(range){
  if (!Array.isArray(range) || !range.length) return [];
  const latestByPerson = new Map();
  range.forEach(sample => {
    if (!sample?.person_id) return;
    const existing = latestByPerson.get(sample.person_id);
    if (!existing || new Date(sample.ts).getTime() > new Date(existing.ts).getTime()){
      latestByPerson.set(sample.person_id, sample);
    }
  });

  return Array.from(latestByPerson.values())
    .map(sample => {
      const stress = clampScore(sample?.scores?.stress);
      const burnout = clampScore(sample?.scores?.burnout);
      const fatigue = clampScore(sample?.scores?.fatigue);
      const statuses = [
        mapToStatus('stress', stress),
        mapToStatus('burnout', burnout),
        mapToStatus('fatigue', fatigue)
      ].filter(Boolean);
      const worstStatus = statuses.reduce((worst, next) =>
        STATUS_PRIORITY[next] > STATUS_PRIORITY[worst] ? next : worst
      , statuses[0] || 'OK');
      const riskScore = (stress + burnout + fatigue) / 3;
      return {
        id: sample.person_id,
        name: formatPerson(sample.person_id),
        stress,
        burnout,
        fatigue,
        status: worstStatus,
        riskScore,
        drivers: collectDrivers(sample)
      };
    })
    .sort((a, b) => {
      const statusDiff = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
      if (statusDiff !== 0) return statusDiff;
      return b.riskScore - a.riskScore;
    });
}

const STATUS_PRIORITY = { OK: 0, WARN: 1, ALERT: 2 };

function clampScore(value){
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

function formatPerson(personId){
  if (!personId) return 'Unknown';
  const suffix = personId.split('_')[1];
  return suffix ? `Employee ${suffix}` : personId;
}

function collectDrivers(sample){
  const explain = sample?.explain;
  if (!explain) return [];
  const drivers = new Set();
  ['stress', 'burnout', 'fatigue', 'wellbeing'].forEach(metric => {
    const list = explain[metric];
    if (Array.isArray(list)){
      list.forEach(item => drivers.add(item));
    }
  });
  return Array.from(drivers).slice(0, 4);
}

function createSparkSvg(values){
  if (!Array.isArray(values) || !values.length){
    return '<svg class="spark" viewBox="0 0 100 32" aria-hidden="true"></svg>';
  }
  const normalised = values.map((value, index) => ({
    x: index,
    y: clampScore(value)
  }));
  const min = Math.min(...normalised.map(point => point.y));
  const max = Math.max(...normalised.map(point => point.y));
  const range = max - min || 1;
  const length = Math.max(1, normalised.length - 1);
  const path = normalised
    .map(point => {
      const x = (point.x / length) * 100;
      const y = 32 - ((point.y - min) / range) * 32;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .reduce((acc, value, index) => acc + (index ? ' L ' : 'M ') + value, '');
  return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

function formatScore(value){
  const num = clampScore(value);
  return `${num}`;
}

function normaliseStatus(status){
  if (typeof status !== 'string') return 'OK';
  return STATUS_PRIORITY[status] != null ? status : 'OK';
}
