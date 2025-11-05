import { DEMO_ORG, SHIFT_BOUNDARIES, TEAM_KEYS } from './onDuty.constants.js';
const CET_TIME_ZONE = 'Europe/Amsterdam';
const TEAM_KEY_ALIASES = {
    all: TEAM_KEYS.ALL,
    '*': TEAM_KEYS.ALL,
    'team.all': TEAM_KEYS.ALL,
    'team:all': TEAM_KEYS.ALL,
    ops: TEAM_KEYS.PROD,
    production: TEAM_KEYS.PROD,
    prod: TEAM_KEYS.PROD,
    'team.production': TEAM_KEYS.PROD,
    'team:production': TEAM_KEYS.PROD,
    it: TEAM_KEYS.MAINT,
    maint: TEAM_KEYS.MAINT,
    maintenance: TEAM_KEYS.MAINT,
    'team.maint': TEAM_KEYS.MAINT,
    'team.maintenance': TEAM_KEYS.MAINT,
    lab: TEAM_KEYS.LAB,
    'team.lab': TEAM_KEYS.LAB,
    'team:lab': TEAM_KEYS.LAB,
    cs: TEAM_KEYS.DAY_SUPPORT,
    support: TEAM_KEYS.DAY_SUPPORT,
    day_support: TEAM_KEYS.DAY_SUPPORT,
    'day-support': TEAM_KEYS.DAY_SUPPORT,
    'team.day_support': TEAM_KEYS.DAY_SUPPORT,
    'team:day_support': TEAM_KEYS.DAY_SUPPORT,
};
export function resolveTeamKey(value) {
    if (!value) {
        return TEAM_KEYS.ALL;
    }
    const key = String(value).trim().toLowerCase();
    return TEAM_KEY_ALIASES[key] ?? TEAM_KEYS.ALL;
}
export function isNightCET(d) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: CET_TIME_ZONE,
        hour: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const hourPart = parts.find((part) => part.type === 'hour');
    const hh = Number(hourPart?.value ?? '0');
    return hh >= SHIFT_BOUNDARIES.nightStart || hh < SHIFT_BOUNDARIES.dayStart;
}
function split3(n) {
    // even split, higher remainders go first (e.g., 32 -> 11,11,10)
    const q = Math.floor(n / 3);
    const r = n % 3;
    return [q + (r > 0 ? 1 : 0), q + (r > 1 ? 1 : 0), q];
}
export function expectedMap(now) {
    const night = isNightCET(now);
    const [prodA, prodB] = split3(DEMO_ORG.production); // -> 11,11,10
    const [maintA, maintB] = split3(DEMO_ORG.maintenance); // -> 6,6,6
    const [labA, labB] = split3(DEMO_ORG.lab); // -> 6,5,5
    // day: one brigade on Day, night: one brigade on Night (others Off)
    const prod = night ? prodA : prodB; // 11/11
    const maint = night ? maintA : maintB; // 6/6
    const lab = night ? labA : labB; // 6/5
    const daySupport = night ? 0 : DEMO_ORG.daySupport; // day-only 34
    const overall = prod + maint + lab + daySupport;
    return new Map([
        [TEAM_KEYS.ALL, overall],
        [TEAM_KEYS.PROD, prod],
        [TEAM_KEYS.MAINT, maint],
        [TEAM_KEYS.LAB, lab],
        [TEAM_KEYS.DAY_SUPPORT, daySupport],
    ]);
}
export function expectedOnDuty(team, at) {
    return expectedMap(at).get(team) ?? 0;
}
export const CET_TIMEZONE = CET_TIME_ZONE;
