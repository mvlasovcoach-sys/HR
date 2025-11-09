export const RISK_LEVELS = {
  low:   { min: 0,  max: 39,  label: 'Low',    colorClass: 'risk--low'    },
  mid:   { min: 40, max: 69,  label: 'Medium', colorClass: 'risk--medium' },
  high:  { min: 70, max: 100, label: 'High',   colorClass: 'risk--high'   }
};

export function levelFor(risk) {
  if (risk >= RISK_LEVELS.high.min) return RISK_LEVELS.high;
  if (risk >= RISK_LEVELS.mid.min) return RISK_LEVELS.mid;
  return RISK_LEVELS.low;
}
