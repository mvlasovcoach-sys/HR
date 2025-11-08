const RANGE_LABELS = {
  today: 'Today',
  '7d': '7 Days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  custom: 'Custom'
};

const VALID_KINDS = new Set(['today', '7d', 'mtd', 'qtd', 'ytd', 'custom']);

const dtfCache = new Map();

function getFormatter(tz, options){
  const key = `${tz}:${JSON.stringify(options)}`;
  if (!dtfCache.has(key)) {
    dtfCache.set(key, new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...options }));
  }
  return dtfCache.get(key);
}

function getParts(date, tz){
  const formatter = getFormatter(tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    ms: Number(map.fractionalSecond || '0')
  };
}

function getOffset(date, tz){
  const { year, month, day, hour, minute, second, ms } = getParts(date, tz);
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return asUTC - date.getTime();
}

function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, ms = 0 }, tz){
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offset = getOffset(new Date(utcGuess), tz);
  return new Date(utcGuess - offset);
}

function getZonedDate(date, tz){
  const { year, month, day, hour, minute, second, ms } = getParts(date, tz);
  return { year, month, day, hour, minute, second, ms };
}

function startOfDayZoned(date, tz){
  const { year, month, day } = getZonedDate(date, tz);
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
}

function addDaysZoned(date, tz, days){
  const local = getZonedDate(date, tz);
  const base = new Date(Date.UTC(local.year, local.month - 1, local.day));
  base.setUTCDate(base.getUTCDate() + days);
  const { year, month, day } = {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate()
  };
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
}

function startOfMonthZoned(date, tz){
  const { year, month } = getZonedDate(date, tz);
  return zonedTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
}

function startOfQuarterZoned(date, tz){
  const { year, month } = getZonedDate(date, tz);
  const quarterMonth = month - ((month - 1) % 3);
  return zonedTimeToUtc({ year, month: quarterMonth, day: 1, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
}

function startOfYearZoned(date, tz){
  const { year } = getZonedDate(date, tz);
  return zonedTimeToUtc({ year, month: 1, day: 1, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
}

function countDays(start, end, tz){
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 0;
  if (end.getTime() <= start.getTime()) return 0;
  let days = 0;
  for (let cursor = start; cursor.getTime() < end.getTime(); cursor = addDaysZoned(cursor, tz, 1)) {
    days += 1;
    if (days > 1000) break;
  }
  return days;
}

function parseCustomInput(value){
  if (typeof value !== 'string' || !value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}

function normaliseKind(input){
  if (!input) return null;
  if (typeof input === 'string') {
    const lowered = input.trim().toLowerCase();
    if (VALID_KINDS.has(lowered)) return lowered;
    return null;
  }
  if (typeof input === 'object') {
    const kind = normaliseKind(input.kind || input.type || input.range);
    if (!kind) return null;
    return kind;
  }
  return null;
}

function resolveCustomRange(selection, tz){
  const startParts = parseCustomInput(selection.start);
  const endParts = parseCustomInput(selection.end);
  if (!startParts || !endParts) return null;
  const start = zonedTimeToUtc({ ...startParts, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
  const end = zonedTimeToUtc({ ...endParts, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
  const exclusiveEnd = addDaysZoned(end, tz, 1);
  if (exclusiveEnd.getTime() <= start.getTime()) {
    return null;
  }
  const dayCount = countDays(start, exclusiveEnd, tz);
  const compareEnd = start;
  const compareStart = addDaysZoned(compareEnd, tz, -dayCount);
  return {
    kind: 'custom',
    label: RANGE_LABELS.custom,
    start,
    end: exclusiveEnd,
    compareStart,
    compareEnd
  };
}

function toIso(date){
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function normaliseOutput({ kind, label, start, end, compareStart, compareEnd }){
  const startISO = toIso(start);
  const endISO = toIso(end);
  const compareStartISO = toIso(compareStart);
  const compareEndISO = toIso(compareEnd);
  return {
    kind,
    label,
    startISO,
    endISO,
    compareStartISO,
    compareEndISO,
    start: startISO,
    end: endISO,
    compare: {
      startISO: compareStartISO,
      endISO: compareEndISO,
      start: compareStartISO,
      end: compareEndISO
    }
  };
}

function parseIsoDate(value){
  if (!value) return null;
  if (value instanceof Date) {
    const clone = new Date(value.getTime());
    return Number.isNaN(clone.valueOf()) ? null : clone;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function startOfNextMonthUTC(date){
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function startOfNextQuarterUTC(date){
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1));
}

function startOfNextYearUTC(date){
  return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
}

function normaliseShiftedRange({ kind, label, start, end }){
  const windowDays = Math.max(1, countDays(start, end, 'UTC'));
  const compareEnd = start;
  const compareStart = addDaysZoned(compareEnd, 'UTC', -windowDays);
  return normaliseOutput({ kind, label, start, end, compareStart, compareEnd });
}

export function shiftRangeToDemoEnd(resolved, bounds){
  if (!resolved || !bounds?.max) {
    return resolved ? { ...resolved, ok: false } : { ok: false };
  }

  const startDate = parseIsoDate(resolved.startISO || resolved.start);
  const endDate = parseIsoDate(resolved.endISO || resolved.end);
  if (!startDate || !endDate) {
    return { ...resolved, ok: false };
  }

  const maxDay = parseIsoDate(`${bounds.max}T00:00:00Z`);
  if (!maxDay) {
    return { ...resolved, ok: false };
  }

  const endCap = addDaysZoned(maxDay, 'UTC', 1);
  const minDay = bounds.min ? parseIsoDate(`${bounds.min}T00:00:00Z`) : null;

  if (minDay && startDate.getTime() >= minDay.getTime() && endDate.getTime() <= endCap.getTime()) {
    return { ...resolved, ok: true };
  }

  let start = startDate;
  let end = endCap;
  const originalSpan = Math.max(1, countDays(startDate, endDate, 'UTC'));

  switch (resolved.kind) {
    case 'mtd': {
      const monthStart = startOfMonthZoned(maxDay, 'UTC');
      const monthNext = startOfNextMonthUTC(monthStart);
      start = monthStart;
      end = endCap.getTime() < monthNext.getTime() ? endCap : monthNext;
      break;
    }
    case 'qtd': {
      const quarterStart = startOfQuarterZoned(maxDay, 'UTC');
      const quarterNext = startOfNextQuarterUTC(quarterStart);
      start = quarterStart;
      end = endCap.getTime() < quarterNext.getTime() ? endCap : quarterNext;
      break;
    }
    case 'ytd': {
      const yearStart = startOfYearZoned(maxDay, 'UTC');
      const yearNext = startOfNextYearUTC(yearStart);
      start = yearStart;
      end = endCap.getTime() < yearNext.getTime() ? endCap : yearNext;
      break;
    }
    default: {
      start = addDaysZoned(end, 'UTC', -originalSpan);
      break;
    }
  }

  if (end.getTime() <= start.getTime()) {
    end = addDaysZoned(start, 'UTC', 1);
  }

  const label = resolved.label || RANGE_LABELS[resolved.kind] || RANGE_LABELS.today;
  return { ...normaliseShiftedRange({ kind: resolved.kind, label, start, end }), ok: true };
}

export async function resolveRange(selection, now = new Date(), tz = 'Europe/Amsterdam'){
  const kind = normaliseKind(selection) || 'today';
  if (kind === 'custom' && typeof selection === 'object') {
    const custom = resolveCustomRange(selection, tz);
    return custom ? normaliseOutput(custom) : null;
  }

  const base = startOfDayZoned(now, tz);
  let start = base;
  let end = addDaysZoned(base, tz, 1);

  switch (kind) {
    case '7d':
      end = base;
      start = addDaysZoned(end, tz, -7);
      break;
    case 'mtd':
      start = startOfMonthZoned(base, tz);
      end = base;
      break;
    case 'qtd':
      start = startOfQuarterZoned(base, tz);
      end = base;
      break;
    case 'ytd':
      start = startOfYearZoned(base, tz);
      end = base;
      break;
    case 'today':
    default:
      start = base;
      end = addDaysZoned(base, tz, 1);
      break;
  }

  const span = countDays(start, end, tz);
  const compareEnd = start;
  const compareStart = span > 0 ? addDaysZoned(compareEnd, tz, -span) : compareEnd;
  return normaliseOutput({
    kind,
    label: RANGE_LABELS[kind] || RANGE_LABELS.today,
    start,
    end,
    compareStart,
    compareEnd
  });
}

export function keyForRange({ startISO, endISO, start, end, teamId = 'all', mode = 'DEMO', lang = 'en' } = {}){
  const safeStart = typeof startISO === 'string' ? startISO : typeof start === 'string' ? start : '';
  const safeEnd = typeof endISO === 'string' ? endISO : typeof end === 'string' ? end : '';
  const safeTeam = teamId != null ? String(teamId) : 'all';
  const safeMode = mode != null ? String(mode) : 'DEMO';
  const safeLang = lang != null ? String(lang) : 'en';
  return `range:${safeStart}:${safeEnd}:team:${safeTeam}:mode:${safeMode}:lang:${safeLang}`;
}
