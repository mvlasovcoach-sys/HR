import { DEMO_ORG, SHIFT_BOUNDARIES, TEAM_KEYS } from './onDuty.constants';

export type TeamKey = typeof TEAM_KEYS[keyof typeof TEAM_KEYS];

export function isNightCET(d: Date): boolean {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .find((p) => p.type === 'hour')!.value;
  const hh = Number(h);
  return hh >= SHIFT_BOUNDARIES.nightStart || hh < SHIFT_BOUNDARIES.dayStart;
}

function split3(n: number): [number, number, number] {
  // even split, higher remainders go first (e.g., 32 -> 11,11,10)
  const q = Math.floor(n / 3);
  const r = n % 3;
  return [q + (r > 0 ? 1 : 0), q + (r > 1 ? 1 : 0), q];
}

export function expectedMap(now: Date): Map<TeamKey, number> {
  const night = isNightCET(now);
  const [prodDay, prodNight] = split3(DEMO_ORG.production); // -> 11,11
  const [maintDay, maintNight] = split3(DEMO_ORG.maintenance); // -> 6,6
  const [labDay, labNight] = split3(DEMO_ORG.lab); // -> 6,5
  // day: one brigade on Day, night: one brigade on Night (others Off)
  const prod = night ? prodNight : prodDay; // 11/11
  const maint = night ? maintNight : maintDay; // 6/6
  const lab = night ? labNight : labDay; // 5/6
  const daySupport = night ? 0 : DEMO_ORG.daySupport; // day-only 34

  const overall = prod + maint + lab + daySupport;

  return new Map<TeamKey, number>([
    [TEAM_KEYS.ALL, overall],
    [TEAM_KEYS.PROD, prod],
    [TEAM_KEYS.MAINT, maint],
    [TEAM_KEYS.LAB, lab],
    [TEAM_KEYS.DAY_SUPPORT, daySupport],
  ]);
}

export function expectedOnDuty(team: TeamKey, at: Date): number {
  return expectedMap(at).get(team) ?? 0;
}
