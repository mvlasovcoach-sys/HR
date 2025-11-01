import { WELLBEING_WEIGHTS } from '@/config/thresholds';

export function calcWellbeing(stress: number, burnout: number, fatigue: number): number {
  const w = WELLBEING_WEIGHTS;
  const raw = stress * w.stress + burnout * w.burnout + fatigue * w.fatigue;
  const inverted = 100 - raw;
  const clamped = Math.max(0, Math.min(100, Math.round(inverted)));
  return clamped;
}
