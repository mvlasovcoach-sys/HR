import { expectedOnDuty } from './onDuty.utils.js';

export const demoCoverage = () => 0.75;

export function sampleSize(team, at, coverage = demoCoverage) {
  const expected = expectedOnDuty(team, at);
  const cov = Math.max(0, Math.min(1, coverage(team, at)));
  return {
    expected,
    sample: Math.round(expected * cov),
    coveragePct: Math.round(cov * 100),
  };
}
