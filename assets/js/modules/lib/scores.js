import { WELLBEING_WEIGHTS } from '../config/thresholds.js';

export function calcWellbeing(stress, burnout, fatigue) {
  const weights = WELLBEING_WEIGHTS;
  const raw = stress * weights.stress + burnout * weights.burnout + fatigue * weights.fatigue;
  const inverted = 100 - raw;
  const clamped = Math.max(0, Math.min(100, Math.round(inverted)));
  return clamped;
}
