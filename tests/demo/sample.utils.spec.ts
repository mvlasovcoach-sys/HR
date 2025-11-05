import { describe, expect, it, vi } from 'vitest';
import { TEAM_KEYS } from '../../src/demo/onDuty.constants';
import { expectedOnDuty } from '../../src/demo/onDuty.utils';
import { demoCoverage, sampleSize } from '../../src/demo/sample.utils';

const day = new Date('2024-01-01T09:00:00Z'); // 10:00 CET
const night = new Date('2024-01-01T21:00:00Z'); // 22:00 CET

describe('demoCoverage', () => {
  it('defaults to 75%', () => {
    expect(demoCoverage(TEAM_KEYS.ALL, day)).toBe(0.75);
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
});
