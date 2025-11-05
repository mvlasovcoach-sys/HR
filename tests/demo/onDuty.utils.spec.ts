import { describe, expect, it } from 'vitest';
import { TEAM_KEYS } from '../../src/demo/onDuty.constants';
import { expectedMap, expectedOnDuty, isNightCET } from '../../src/demo/onDuty.utils';

const day = new Date('2024-01-01T09:00:00Z'); // 10:00 CET
const night = new Date('2024-01-01T21:00:00Z'); // 22:00 CET

describe('isNightCET', () => {
  it('detects day time in CET', () => {
    expect(isNightCET(day)).toBe(false);
  });

  it('detects night time in CET', () => {
    expect(isNightCET(night)).toBe(true);
  });
});

describe('expectedMap', () => {
  it('returns expected headcount map for day shift', () => {
    const map = expectedMap(day);
    expect(map.get(TEAM_KEYS.ALL)).toBe(57);
    expect(map.get(TEAM_KEYS.PROD)).toBe(11);
    expect(map.get(TEAM_KEYS.MAINT)).toBe(6);
    expect(map.get(TEAM_KEYS.LAB)).toBe(6);
    expect(map.get(TEAM_KEYS.DAY_SUPPORT)).toBe(34);
  });

  it('returns expected headcount map for night shift', () => {
    const map = expectedMap(night);
    expect(map.get(TEAM_KEYS.ALL)).toBe(22);
    expect(map.get(TEAM_KEYS.PROD)).toBe(11);
    expect(map.get(TEAM_KEYS.MAINT)).toBe(6);
    expect(map.get(TEAM_KEYS.LAB)).toBe(5);
    expect(map.get(TEAM_KEYS.DAY_SUPPORT)).toBe(0);
  });
});

describe('expectedOnDuty', () => {
  it('returns value for known team', () => {
    expect(expectedOnDuty(TEAM_KEYS.LAB, night)).toBe(5);
  });

  it('defaults to zero for unknown team', () => {
    expect(expectedOnDuty('team.unknown' as never, day)).toBe(0);
  });
});
