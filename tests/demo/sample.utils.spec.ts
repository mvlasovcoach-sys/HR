import { describe, expect, it, vi } from 'vitest';
import { TEAM_KEYS } from '../../src/demo/onDuty.constants';
import { expectedOnDuty } from '../../src/demo/onDuty.utils';
import { coverageFromData, demoCoverage, sampleSize } from '../../src/demo/sample.utils';
import type { PersonSample } from '../../src/types/metrics';

const day = new Date('2024-01-01T09:00:00Z'); // 10:00 CET
const night = new Date('2024-01-01T21:00:00Z'); // 22:00 CET

const dataset: PersonSample[] = [
  {
    person_id: 'prod-1',
    ts: '2024-01-01T09:15:00Z',
    signals: { shift: 'day', team: 'ops' },
    scores: { stress: 40, burnout: 22, fatigue: 28, wellbeing: 60 },
  },
  {
    person_id: 'prod-2',
    ts: '2024-01-01T10:05:00Z',
    signals: { shift: 'day', team: 'prod' },
    scores: { stress: 42, burnout: 24, fatigue: 30, wellbeing: 58 },
  },
  {
    person_id: 'maint-1',
    ts: '2024-01-01T09:45:00Z',
    signals: { shift: 'day', team: 'it' },
    scores: { stress: 35, burnout: 20, fatigue: 26, wellbeing: 65 },
  },
  {
    person_id: 'prod-3',
    ts: '2024-01-01T21:10:00Z',
    signals: { shift: 'night', team: 'production' },
    scores: { stress: 52, burnout: 30, fatigue: 40, wellbeing: 55 },
  },
  {
    person_id: 'prod-1',
    ts: '2024-01-01T21:30:00Z',
    signals: { shift: 'night', team: 'ops' },
    scores: { stress: 54, burnout: 32, fatigue: 42, wellbeing: 52 },
  },
  {
    person_id: 'support-1',
    ts: '2024-01-01T08:05:00Z',
    signals: { shift: 'day' },
    scores: { stress: 30, burnout: 18, fatigue: 20, wellbeing: 70 },
  },
];

describe('demoCoverage', () => {
  it('defaults to 75%', () => {
    expect(demoCoverage(TEAM_KEYS.ALL, day)).toBe(0.75);
  });
});

describe('coverageFromData', () => {
  it('computes coverage ratio for overall day shift', () => {
    const ratio = coverageFromData(TEAM_KEYS.ALL, day, dataset);
    const expected = 3 / 57; // prod-1, prod-2, maint-1 => expected overall day headcount 57
    expect(ratio).toBeCloseTo(expected, 5);
  });

  it('computes coverage ratio for production night shift', () => {
    const ratio = coverageFromData(TEAM_KEYS.PROD, night, dataset);
    // prod-3 and prod-1 counted once => 2 / expected night production (11)
    expect(ratio).toBeCloseTo(2 / 11, 5);
  });

  it('returns null when no team-specific samples are present', () => {
    const noTeamData = dataset.filter((sample) => !sample.signals.team);
    const ratio = coverageFromData(TEAM_KEYS.DAY_SUPPORT, day, noTeamData);
    expect(ratio).toBeNull();
  });

  it('ignores mismatched shifts', () => {
    const ratio = coverageFromData(TEAM_KEYS.ALL, night, dataset);
    // only prod-3 and prod-1 should be counted for night
    expect(ratio).toBeCloseTo(2 / 22, 5);
  });
});

describe('sampleSize', () => {
  it('uses default coverage when not provided', () => {
    const result = sampleSize(TEAM_KEYS.ALL, day);
    const expected = expectedOnDuty(TEAM_KEYS.ALL, day);
    expect(result).toEqual({ expected, sample: Math.round(expected * 0.75), coveragePct: 75 });
  });

  it('clamps coverage to [0,1]', () => {
    const coverage = vi.fn().mockReturnValue(1.2);
    const result = sampleSize(TEAM_KEYS.PROD, night, coverage);
    expect(coverage).toHaveBeenCalledWith(TEAM_KEYS.PROD, night);
    expect(result.coveragePct).toBe(100);
    expect(result.sample).toBe(expectedOnDuty(TEAM_KEYS.PROD, night));
  });

  it('handles negative coverage', () => {
    const coverage = vi.fn().mockReturnValue(-0.5);
    const result = sampleSize(TEAM_KEYS.DAY_SUPPORT, day, coverage);
    expect(result.coveragePct).toBe(0);
    expect(result.sample).toBe(0);
    expect(result.expected).toBe(expectedOnDuty(TEAM_KEYS.DAY_SUPPORT, day));
  });

  it('supports real coverage provider with fallback logic', () => {
    const provider = (team: string, at: Date) => coverageFromData(team as never, at, dataset) ?? demoCoverage(team as never, at);
    const result = sampleSize(TEAM_KEYS.PROD, night, provider);
    const expected = expectedOnDuty(TEAM_KEYS.PROD, night);
    expect(result.sample).toBe(Math.round(expected * (2 / 11)));
    expect(result.coveragePct).toBe(Math.round((2 / 11) * 100));
  });
});
