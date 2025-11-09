import { RISK_LEVELS, levelFor } from './ai-config.js';

export function applyRiskBadge(risk, elId = 'ai-assistant') {
  const el = document.getElementById(elId);
  if (!el) return;
  if (typeof risk !== 'number' || Number.isNaN(risk)) {
    el.removeAttribute('data-risk-level');
    return;
  }
  const level = levelFor(risk);
  let key = 'low';
  if (level === RISK_LEVELS.high) key = 'high';
  else if (level === RISK_LEVELS.mid) key = 'mid';

  el.dataset.riskLevel = key;
}
