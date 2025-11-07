const DAILY_URL = new URL('../../data/demo/daily.json', import.meta.url);

let _cache = null;
let _promise = null;
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

function normaliseRows(rows){
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => ({
      date: typeof row?.date === 'string' ? row.date : null,
      stress: Number(row?.stress),
      burnout: Number(row?.burnout),
      fatigue: Number(row?.fatigue),
      wellbeing: Number(row?.wellbeing)
    }))
    .filter(entry => typeof entry.date === 'string' && entry.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function updateBounds(list){
  if (list.length === 0) {
    _bounds = null;
    return;
  }
  const first = list[0]?.date || null;
  const last = list[list.length - 1]?.date || null;
  _bounds = first && last ? { min: first, max: last } : null;
}

export function getCachedDemoBounds(){
  return _bounds ? { ..._bounds } : null;
}

export async function loadDemoDaily(){
  if (_cache) return _cache;
  if (_promise) return _promise;
  const fetchJSON = getFetcher();
  _promise = fetchJSON(DAILY_URL.toString())
    .then(normaliseRows)
    .then(list => {
      _cache = list;
      updateBounds(list);
      return list;
    })
    .catch(err => {
      _cache = [];
      _bounds = null;
      throw err;
    })
    .finally(() => {
      _promise = null;
    });
  return _promise;
}

export async function demoBounds(){
  if (_bounds) {
    return { ..._bounds };
  }
  try {
    const rows = await loadDemoDaily();
    updateBounds(rows);
  } catch (err) {
    /* ignore and fall through */
  }
  return _bounds ? { ..._bounds } : { min: null, max: null };
}

export function preloadDemoDaily(){
  return loadDemoDaily().catch(() => []);
}
