export function renderOrgWellbeing({ containerId, value }) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const valueEl = root.querySelector('.kpi-value, .kpi-card__number');
  if (!valueEl) return;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    valueEl.textContent = String(Math.round(numericValue));
  } else {
    valueEl.textContent = '—';
  }
}
