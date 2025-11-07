const DEMO_DAILY_PATH = 'assets/data/demo/daily.json';

let _rows = null;
let _bounds = null;

function getFetcher(){
  const apiFetch = typeof window !== 'undefined' && window.API?.fetchJSON;
  if (typeof apiFetch === 'function') {
    return url => apiFetch(url);
  }
  return async url => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load demo daily dataset (${response.status})`);
    }
    return response.json();
  };
}

function toNumber(value){
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normaliseRows(rows){
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => ({
      date: typeof row?.date === 'string' ? row.date : null,
      stress: toNumber(row?.stress),
      burnout: toNumber(row?.burnout),
      fatigue: toNumber(row?.fatigue),
      wellbeing: toNumber(row?.wellbeing)
    }))
    .filter(entry => typeof entry.date === 'string' && entry.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function updateBounds(list){
  if (!list.length) {
    _bounds = { min: null, max: null };
    return;
  }
  _bounds = {
    min: list[0].date,
    max: list[list.length - 1].date
  };
}

export async function loadDemoDaily(){
  if (_rows) return _rows;
  const fetchJSON = getFetcher();
  const data = await fetchJSON(DEMO_DAILY_PATH).catch(() => []);
  _rows = normaliseRows(data);
  updateBounds(_rows);
  return _rows;
}

export async function demoBounds(){
  if (!_bounds) {
    await loadDemoDaily().catch(() => []);
  }
  if (!_bounds) {
    return { min: null, max: null };
  }
  return { ..._bounds };
}
