import {fmtPct, fmtScore, fmtPts, fmtUpdated} from '../format.js';

let autoId = 0;

function t(key, fallback){
  return window.I18N?.t?.(key) || fallback;
}

function splitValue(formatted){
  const match = typeof formatted === 'string' ? formatted.trim().match(/^([^\s]+)\s*(.*)$/) : null;
  if (!match) {
    return {number: formatted ?? '', unit: ''};
  }
  return {number: match[1], unit: match[2]};
}

function normaliseSeries(values){
  if (!Array.isArray(values)) return [];
  return values
    .map((value, index) => {
      if (value == null) return null;
      const num = Number(value);
      return Number.isFinite(num) ? {x: index, y: num} : null;
    })
    .filter(Boolean);
}

function buildSparkPath(series, width, height){
  if (!series.length) return '';
  if (series.length === 1) {
    const y = height / 2;
    return `M 0 ${y} L ${width} ${y}`;
  }
  const ys = series.map(point => point.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const length = series[series.length - 1].x || 1;
  return series
    .map(point => {
      const x = length ? (point.x / length) * width : 0;
      const y = height - ((point.y - min) / range) * height;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .reduce((acc, value, index) => acc + (index ? ' L ' : 'M ') + value, '');
}

function buildCiPath(ci, width, height){
  if (!Array.isArray(ci) || !ci.length) return '';
  const pairs = ci
    .map((value, index) => {
      if (Array.isArray(value) && value.length >= 2) {
        const lo = Number(value[0]);
        const hi = Number(value[1]);
        if (Number.isFinite(lo) && Number.isFinite(hi)) {
          return {x: index, lo, hi};
        }
      }
      if (value && typeof value === 'object') {
        const lo = Number(value.lo ?? value.low ?? value.min);
        const hi = Number(value.hi ?? value.high ?? value.max);
        if (Number.isFinite(lo) && Number.isFinite(hi)) {
          return {x: index, lo, hi};
        }
      }
      return null;
    })
    .filter(Boolean);
  if (!pairs.length) return '';
  const lows = pairs.map(point => point.lo);
  const highs = pairs.map(point => point.hi);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const length = pairs[pairs.length - 1].x || 1;
  const upper = pairs.map(point => {
    const x = length ? (point.x / length) * width : 0;
    const y = height - ((point.hi - min) / range) * height;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const lower = pairs
    .slice()
    .reverse()
    .map(point => {
      const x = length ? (point.x / length) * width : 0;
      const y = height - ((point.lo - min) / range) * height;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
  const path = upper.concat(lower);
  return path.reduce((acc, value, index) => acc + (index ? ' L ' : 'M ') + value, '') + ' Z';
}

function describeDelta(delta, unit){
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return t('kpi.delta.noChange', 'No change');
  }
  const value = Math.abs(Math.round(delta));
  const unitText = unit ? (unit === '/100' ? ' /100' : ` ${unit}`) : '';
  if (delta > 0) {
    return t('kpi.delta.increase', {value, unit: unitText}) || `Increase of ${value}${unitText}`;
  }
  return t('kpi.delta.decrease', {value, unit: unitText}) || `Decrease of ${value}${unitText}`;
}

export function mountKpi(host, options = {}){
  if (!host) return null;
  const template = document.getElementById('tpl-kpi');
  const base = template?.content?.firstElementChild;
  if (!base) return null;

  const node = base.cloneNode(true);
  const titleEl = node.querySelector('.kpi-title');
  const numberEl = node.querySelector('.kpi-number');
  const unitEl = node.querySelector('.kpi-unit');
  const deltaEl = node.querySelector('.delta');
  const deltaTextEl = deltaEl?.querySelector('.delta-text');
  const arrowPath = deltaEl?.querySelector('path');
  const spark = node.querySelector('.spark');
  const line = spark?.querySelector('.line');
  const ciPath = spark?.querySelector('.ci');
  const updatedEl = node.querySelector('.updated');
  const ptsEl = node.querySelector('.pts');

  const titleText = options.title ?? '';
  const unit = options.unit === '/100' ? '/100' : '%';
  const value = Number(options.value);
  const delta = Number(options.delta);
  const series = normaliseSeries(options.series);
  const ci = Array.isArray(options.ci) ? options.ci : [];
  const updated = options.updated ?? '—';

  const titleId = `kpi-title-${++autoId}`;
  node.setAttribute('aria-labelledby', titleId);
  titleEl.id = titleId;
  titleEl.textContent = titleText;

  if (options.key) {
    node.dataset.kpiKey = String(options.key);
  }
  if (Number.isFinite(options.index)) {
    node.dataset.index = String(options.index);
  }

  if (Number.isFinite(value)) {
    const formatted = unit === '/100' ? fmtScore(value) : fmtPct(value);
    const parts = splitValue(formatted);
    numberEl.textContent = parts.number || '—';
    unitEl.textContent = parts.unit || '';
  } else {
    numberEl.textContent = '—';
    unitEl.textContent = '';
  }

  const arrowUp = t('kpi.delta.arrowUp', '▲');
  const arrowDown = t('kpi.delta.arrowDown', '▼');
  const hasDelta = Number.isFinite(delta) && Math.abs(delta) > 0;
  const polarity = options.polarity === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better';
  if (deltaEl && deltaTextEl && arrowPath) {
    deltaEl.classList.remove('up', 'down', 'same');
    if (hasDelta) {
      const rounded = Math.round(delta);
      const isUp = delta > 0;
      // invert for 'lower_is_better'
      const goodWhenUp = (polarity === 'higher_is_better');
      const isGood = (isUp && goodWhenUp) || (!isUp && !goodWhenUp);

      if (isGood) {
        deltaEl.classList.add('up'); // зелёный чип
      } else {
        deltaEl.classList.add('down'); // красный чип
      }

      const arrowSymbol = isUp ? arrowUp : arrowDown;
      deltaTextEl.textContent = `${arrowSymbol} ${Math.abs(rounded)}`.trim();
      arrowPath.setAttribute('d', isUp ? 'M1 6 L5 2 L9 6' : 'M1 4 L5 8 L9 4');
    } else {
      deltaEl.classList.add('same');
      deltaTextEl.textContent = t('kpi.delta.noChange', 'No change');
      arrowPath.setAttribute('d', '');
    }
    const ariaLabel = describeDelta(delta, unit === '%' ? '%' : '/100');
    deltaEl.setAttribute('aria-label', ariaLabel);
  }

  if (spark) {
    const box = (spark.getAttribute('viewBox') || '').split(' ').map(Number);
    const width = Number.isFinite(box[2]) ? box[2] : 100;
    const height = Number.isFinite(box[3]) ? box[3] : 36;
    const path = buildSparkPath(series, width, height);
    if (line) {
      line.setAttribute('d', path);
      line.setAttribute('aria-hidden', 'true');
    }
    if (ciPath) {
      const ciD = buildCiPath(ci, width, height);
      ciPath.setAttribute('d', ciD);
    }
    if (!path) {
      spark.setAttribute('aria-hidden', 'true');
    } else {
      spark.removeAttribute('aria-hidden');
    }
  }

  if (updatedEl) {
    updatedEl.textContent = fmtUpdated(updated);
  }
  if (ptsEl) {
    ptsEl.textContent = fmtPts(delta);
  }

  host.appendChild(node);
  return node;
}

export function renderKpiSkeletons(host, count = 4){
  if (!host) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const node = document.createElement('article');
    node.className = 'kpi--brand skeleton';
    fragment.appendChild(node);
  }
  host.replaceChildren(fragment);
}

export function renderKpiEmpty(host, message){
  if (!host) return;
  const empty = document.createElement('div');
  empty.className = 'kpi-empty';
  empty.textContent = message || t('kpi.empty', 'No data available');
  host.replaceChildren(empty);
}
