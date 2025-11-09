import { RISK_THRESHOLDS } from './ai-assistant.js';

export function applyRiskBadge(risk, elId = 'ai-assistant') {
  const el = document.getElementById(elId);
  if (!el) return;
  if (typeof risk !== 'number' || Number.isNaN(risk)) {
    el.removeAttribute('data-risk-level');
    return;
  }
  el.dataset.riskLevel = (risk >= RISK_THRESHOLDS.red) ? 'high'
    : (risk >= RISK_THRESHOLDS.yellow) ? 'mid'
    : 'low';
}
