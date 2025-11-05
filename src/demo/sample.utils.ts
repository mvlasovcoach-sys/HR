import type { PersonSample } from '@/types/metrics';
import { appStore } from '@/store/appState';
import { TEAM_KEYS } from './onDuty.constants';
import { expectedOnDuty, isNightCET, resolveTeamKey, TeamKey } from './onDuty.utils';

// pluggable coverage provider; for DEMO fallback to 0.75
export type CoverageProvider = (team: TeamKey, at: Date) => number; // 0..1
export const demoCoverage: CoverageProvider = () => 0.75;

const SHIFT_LOOKBACK_MS = 36 * 60 * 60 * 1000; // 36h window to avoid stale data

function parseTimestamp(value: string | number | Date | undefined): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function hasValidScores(sample: PersonSample): boolean {
  const { scores } = sample;
  if (!scores || typeof scores !== 'object') {
    return false;
  }
  const values = [scores.stress, scores.burnout, scores.fatigue];
  return values.some((value) => typeof value === 'number' && Number.isFinite(value));
}

function resolveSampleTeam(sample: PersonSample): TeamKey | null {
  const candidate =
    (sample as unknown as { team?: string }).team ??
    (sample as unknown as { department?: string }).department ??
    (sample.signals as unknown as { team?: string; department?: string } | undefined)?.team ??
    (sample.signals as unknown as { team?: string; department?: string } | undefined)?.department;
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  const resolved = resolveTeamKey(candidate);
  return resolved === TEAM_KEYS.ALL ? null : resolved;
}

function selectSamples(team: TeamKey, at: Date, dataset: readonly PersonSample[]): number | null {
  const denominator = expectedOnDuty(team, at);
  if (denominator <= 0) {
    return denominator === 0 ? 0 : null;
  }

  const referenceTs = at.getTime();
  const targetNight = isNightCET(at);
  const perPerson = new Map<string, { ts: number; team: TeamKey | null }>();

  for (const sample of dataset) {
    if (!sample || typeof sample !== 'object') {
      continue;
    }
    const ts = parseTimestamp(sample.ts);
    if (ts === null) {
      continue;
    }
    if (Math.abs(referenceTs - ts) > SHIFT_LOOKBACK_MS) {
      continue;
    }
    const sampleNight = isNightCET(new Date(ts));
    if (sampleNight !== targetNight) {
      continue;
    }
    if (!hasValidScores(sample)) {
      continue;
    }
    const entry = perPerson.get(sample.person_id);
    if (!entry || entry.ts < ts) {
      perPerson.set(sample.person_id, {
        ts,
        team: resolveSampleTeam(sample),
      });
    }
  }

  if (!perPerson.size) {
    return 0;
  }

  const targetTeam = team === TEAM_KEYS.ALL ? null : team;
  let numerator = 0;
  let matchedTeamData = false;

  perPerson.forEach((value) => {
    if (!targetTeam) {
      numerator += 1;
      matchedTeamData = true;
      return;
    }
    if (value.team === targetTeam) {
      numerator += 1;
      matchedTeamData = true;
    }
  });

  if (!matchedTeamData) {
    return null;
  }

  const ratio = numerator / Math.max(1, denominator);
  if (!Number.isFinite(ratio)) {
    return null;
  }
  return Math.max(0, Math.min(1, ratio));
}

export function coverageFromData(team: TeamKey, at: Date, samples?: readonly PersonSample[]): number | null {
  const dataset = samples && Array.isArray(samples) ? samples : appStore.getState().samples;
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return null;
  }
  return selectSamples(team, at, dataset);
}

export function sampleSize(
  team: TeamKey,
  at: Date,
  coverage: CoverageProvider = demoCoverage,
) {
  const exp = expectedOnDuty(team, at);
  const raw = coverage(team, at);
  const cov = Math.max(0, Math.min(1, Number.isFinite(raw) ? Number(raw) : 0));
  return {
    expected: exp,
    sample: Math.round(exp * cov),
    coveragePct: Math.round(cov * 100),
  };
}
