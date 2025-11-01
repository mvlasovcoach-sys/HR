export const DEFAULT_THRESHOLDS = {
  stress: { okMax: 39, warnMax: 59 },
  burnout: { okMax: 34, warnMax: 54 },
  fatigue: { okMax: 39, warnMax: 59 },
} as const;

export const WELLBEING_WEIGHTS = {
  stress: 0.30,
  burnout: 0.40,
  fatigue: 0.30,
} as const;
