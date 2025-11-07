const defaultThresholds = {
  wellbeing: value => {
    if (!Number.isFinite(value)) return 'neutral';
    if (value >= 75) return 'green';
    if (value >= 60) return 'amber';
    return 'red';
  },
  stress: value => {
    if (!Number.isFinite(value)) return 'neutral';
    if (value <= 35) return 'green';
    if (value <= 55) return 'amber';
    return 'red';
  },
  burnout: value => {
    if (!Number.isFinite(value)) return 'neutral';
    if (value <= 10) return 'green';
    if (value <= 20) return 'amber';
    return 'red';
  },
  fatigue: value => {
    if (!Number.isFinite(value)) return 'neutral';
    if (value <= 20) return 'green';
    if (value <= 30) return 'amber';
    return 'red';
  }
};

export function resolveBand(metric, value, overrides = {}){
  const key = metric || '';
  const resolver = overrides[key] || defaultThresholds[key];
  if (typeof resolver === 'function') {
    return resolver(value);
  }
  return 'neutral';
}

export const KPI_THRESHOLDS = Object.freeze({ ...defaultThresholds });
