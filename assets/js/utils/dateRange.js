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

export function resolveRange(selection, now = new Date(), tz = 'Europe/Amsterdam'){
  const kind = normaliseKind(selection) || 'today';
  const base = startOfDayZoned(now, tz);
  if (kind === 'custom' && typeof selection === 'object') {
    const custom = resolveCustomRange(selection, tz);
    if (!custom) return null;
    return {
      kind: custom.kind,
      label: custom.label,
      start: custom.start.toISOString(),
      end: custom.end.toISOString(),
      compare: {
        start: custom.compareStart.toISOString(),
        end: custom.compareEnd.toISOString()
      }
    };
  }

  let start = base;
  let end = addDaysZoned(base, tz, 1);
  let compareStart = addDaysZoned(base, tz, -1);
  let compareEnd = base;
  let label = RANGE_LABELS.today;

  switch (kind) {
    case 'today': {
      label = RANGE_LABELS.today;
      break;
    }
    case '7d': {
      label = RANGE_LABELS['7d'];
      end = base;
      start = addDaysZoned(end, tz, -7);
      compareEnd = start;
      compareStart = addDaysZoned(compareEnd, tz, -7);
      break;
    }
    case 'mtd': {
      label = RANGE_LABELS.mtd;
      start = startOfMonthZoned(base, tz);
      end = base;
      const span = countDays(start, end, tz);
      compareEnd = start;
      compareStart = addDaysZoned(compareEnd, tz, -span);
      break;
    }
    case 'qtd': {
      label = RANGE_LABELS.qtd;
      start = startOfQuarterZoned(base, tz);
      end = base;
      const span = countDays(start, end, tz);
      compareEnd = start;
      compareStart = addDaysZoned(compareEnd, tz, -span);
      break;
    }
    case 'ytd': {
      label = RANGE_LABELS.ytd;
      start = startOfYearZoned(base, tz);
      end = base;
      const span = countDays(start, end, tz);
      compareEnd = start;
      compareStart = addDaysZoned(compareEnd, tz, -span);
      break;
    }
    default: {
      label = RANGE_LABELS.today;
      break;
    }
  }

  return {
    kind,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    compare: {
      start: compareStart.toISOString(),
      end: compareEnd.toISOString()
    }
  };
}

export function keyForRange({ start, end, teamId = 'all', mode = 'DEMO', lang = 'en' } = {}){
  const safeStart = typeof start === 'string' ? start : '';
  const safeEnd = typeof end === 'string' ? end : '';
  const safeTeam = teamId != null ? String(teamId) : 'all';
  const safeMode = mode != null ? String(mode) : 'DEMO';
  const safeLang = lang != null ? String(lang) : 'en';
  return `range:${safeStart}:${safeEnd}:team:${safeTeam}:mode:${safeMode}:lang:${safeLang}`;
}
