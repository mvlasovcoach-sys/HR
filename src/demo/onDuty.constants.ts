export const DEMO_ORG = {
  production: 32,
  maintenance: 18,
  lab: 16,
  daySupport: 8 + 12 + 14, // Admin + Catering + OIM/ControlRoom/TechMgmt
};

export const SHIFT_BOUNDARIES = { dayStart: 8, nightStart: 20 }; // CET, 12h

export const TEAM_KEYS = {
  ALL: 'team.all',
  PROD: 'team.production',
  MAINT: 'team.maint',
  LAB: 'team.lab',
  DAY_SUPPORT: 'team.day_support',
} as const;
