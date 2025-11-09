import { levelForWellbeing } from '../kpi-config.js';

const CARD_LEVEL_CLASSES = ['kwb--good', 'kwb--medium', 'kwb--anomaly'];
const BADGE_LEVEL_CLASSES = ['badge--good', 'badge--medium', 'badge--anomaly'];

function applyBadgeTone(badge, level) {
  if (!badge) return;
  BADGE_LEVEL_CLASSES.forEach(className => badge.classList.remove(className));
  if (!level) {
    badge.textContent = '—';
    return;
  }
  switch (level.name) {
    case 'green':
      badge.classList.add('badge--good');
      break;
    case 'yellow':
      badge.classList.add('badge--medium');
      break;
    case 'red':
      badge.classList.add('badge--anomaly');
      break;
    default:
      break;
  }
  badge.textContent = level.label;
}

function toggleAffected(affected, level, value) {
  if (!affected) return;
  if (!level || level.name !== 'red' || !Number.isFinite(value)) {
    affected.style.display = 'none';
    affected.textContent = '';
    affected.removeAttribute('title');
    return;
  }
  const pct = Math.max(0, Math.round(100 - value));
  affected.textContent = `Affected ≈ ${pct}%`;
  affected.style.display = 'inline-flex';
  affected.setAttribute(
    'title',
    'Оценка доли сотрудников с высоким стрессом/усталостью/признаками выгорания на текущем срезе'
  );
}

export function renderOrgWellbeing({ containerId, value }) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const valueEl = root.querySelector('.kpi-value');
  const badge = root.querySelector('.kpi-badge');
  const affected = root.querySelector('.kpi-affected');

  const numericValue = Number(value);
  const hasValue = Number.isFinite(numericValue);
  const level = hasValue ? levelForWellbeing(numericValue) : null;

  if (valueEl) {
    valueEl.textContent = hasValue ? String(Math.round(numericValue)) : '—';
  }

  CARD_LEVEL_CLASSES.forEach(className => root.classList.remove(className));
  if (level) {
    root.classList.add(level.className);
  }

  applyBadgeTone(badge, level);
  toggleAffected(affected, level, numericValue);
}
