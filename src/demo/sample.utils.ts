import { expectedOnDuty, TeamKey } from './onDuty.utils';

// pluggable coverage provider; for DEMO fallback to 0.75
export type CoverageProvider = (team: TeamKey, at: Date) => number; // 0..1
export const demoCoverage: CoverageProvider = () => 0.75;

export function sampleSize(
  team: TeamKey,
  at: Date,
  coverage: CoverageProvider = demoCoverage,
) {
  const exp = expectedOnDuty(team, at);
  const cov = Math.max(0, Math.min(1, coverage(team, at)));
  return {
    expected: exp,
    sample: Math.round(exp * cov),
    coveragePct: Math.round(cov * 100),
  };
}
