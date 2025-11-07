import { devError } from '../utils/env.js';
import { resolveRange } from '../utils/dateRange.js';

const TEAM_KEY = 'hr:team';
const TEAMS_KEY = 'hr:teams';
const TEAM_NAMES_KEY = 'hr:team:names';
const DATA_PATH = './data/org/teams.json';

const loaderGlobals = window.loaderGlobals || {};
const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : url => url;
const loadJson = typeof loaderGlobals.fetchJson === 'function'
  ? loaderGlobals.fetchJson
  : async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response.json();
    };

function readStoredTeams(){
  try {
    const rawList = localStorage.getItem(TEAMS_KEY);
    if (rawList) {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) {
        return parsed.map(value => String(value)).filter(Boolean);
      }
    }
    const single = localStorage.getItem(TEAM_KEY);
    if (single && single !== 'all') {
      return [String(single)];
    }
  } catch (err) {
    /* storage optional */
  }
  return [];
}

async function fetchTeams(){
  const url = new URL(DATA_PATH, document.baseURI);
  try {
    const data = await loadJson(applyVersion(url.toString()));
    const list = Array.isArray(data?.depts) ? data.depts : [];
    const options = list.map(item => ({
      id: String(item?.id ?? ''),
      label: item?.name || String(item?.id ?? '')
    })).filter(option => option.id);
    const nameMap = options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {});
    try {
      localStorage.setItem(TEAM_NAMES_KEY, JSON.stringify(nameMap));
    } catch (err) {
      /* ignore */
    }
    return options;
  } catch (err) {
    devError('Failed to load teams', err);
    return [];
  }
}

function arraysEqual(a = [], b = []){
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function normaliseTeams(values){
  if (!Array.isArray(values) || !values.length) return [];
  const seen = new Set();
  const output = [];
  values.forEach(value => {
    const id = String(value ?? '');
    if (!id) return;
    if (seen.has(id)) return;
    seen.add(id);
    output.push(id);
  });
  return output;
}

const DEFAULT_RANGE_KIND = 'today';

const state = {
  teams: readStoredTeams(),
  teamOptions: [],
  allTeamsIds: [],
  rangeKind: DEFAULT_RANGE_KIND,
  rangeStart: null,
  rangeEnd: null,
  rangeResolved: null
};

function rangesEqual(a, b){
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end && a.compare?.start === b.compare?.start && a.compare?.end === b.compare?.end;
}

function dispatchRangeChange(){
  const selection = { kind: state.rangeKind, start: state.rangeStart, end: state.rangeEnd };
  const resolved = resolveRange(selection);
  if (!resolved) return;
  if (rangesEqual(state.rangeResolved, resolved)) return;
  state.rangeResolved = resolved;
  document.dispatchEvent(new CustomEvent('state:range-changed', { detail: { range: resolved, selection } }));
}

function normaliseKind(kind){
  if (typeof kind !== 'string') return DEFAULT_RANGE_KIND;
  const value = kind.trim().toLowerCase();
  switch (value) {
    case 'today':
    case 'day':
    case '1d':
      return 'today';
    case '7d':
    case '7':
    case 'week':
      return '7d';
    case 'mtd':
    case 'month':
      return 'mtd';
    case 'qtd':
    case 'quarter':
      return 'qtd';
    case 'ytd':
    case 'year':
      return 'ytd';
    case 'custom':
      return 'custom';
    default:
      return DEFAULT_RANGE_KIND;
  }
}

let teamsPromise = null;

export const AppState = {
  state,
  async getTeams(){
    if (Array.isArray(state.teamOptions) && state.teamOptions.length) {
      return state.teamOptions;
    }
    if (!teamsPromise) {
      teamsPromise = fetchTeams().then(options => {
        state.teamOptions = options;
        state.allTeamsIds = Array.isArray(options) ? options.map(option => option.id) : [];
        return options;
      }).catch(err => {
        devError('Teams request failed', err);
        return [];
      });
    }
    const options = await teamsPromise;
    return Array.isArray(options) ? options : [];
  },
  setTeams(nextValues){
    const normalised = normaliseTeams(nextValues);
    if (arraysEqual(state.teams, normalised)) {
      return;
    }
    state.teams = normalised;
    try {
      if (normalised.length) {
        localStorage.setItem(TEAMS_KEY, JSON.stringify(normalised));
        localStorage.setItem(TEAM_KEY, normalised[0]);
      } else {
        localStorage.removeItem(TEAMS_KEY);
        localStorage.setItem(TEAM_KEY, 'all');
      }
    } catch (err) {
      /* storage optional */
    }
    const primary = normalised[0] || 'all';
    try {
      const evt = new StorageEvent('storage', { key: TEAM_KEY, newValue: primary });
      window.dispatchEvent(evt);
    } catch (err) {
      /* dispatch optional */
    }
  },
  getActiveTeams(){
    return Array.isArray(state.teams) && state.teams.length
      ? state.teams
      : state.allTeamsIds;
  },
  getRangeSelection(){
    return {
      kind: state.rangeKind,
      start: state.rangeStart,
      end: state.rangeEnd
    };
  },
  getResolvedRange(){
    if (!state.rangeResolved) {
      state.rangeResolved = resolveRange({ kind: state.rangeKind, start: state.rangeStart, end: state.rangeEnd });
    }
    return state.rangeResolved;
  },
  setRangeKind(kind){
    const nextKind = normaliseKind(kind);
    if (state.rangeKind === nextKind && state.rangeStart == null && state.rangeEnd == null) {
      dispatchRangeChange();
      return;
    }
    state.rangeKind = nextKind;
    if (nextKind !== 'custom') {
      state.rangeStart = null;
      state.rangeEnd = null;
    }
    state.rangeResolved = null;
    dispatchRangeChange();
  },
  setCustomRange(start, end){
    const cleanStart = typeof start === 'string' && start ? start : null;
    const cleanEnd = typeof end === 'string' && end ? end : null;
    state.rangeKind = 'custom';
    state.rangeStart = cleanStart;
    state.rangeEnd = cleanEnd;
    state.rangeResolved = null;
    if (!cleanStart || !cleanEnd) return;
    dispatchRangeChange();
  },
  notifyRange(){
    state.rangeResolved = null;
    dispatchRangeChange();
  }
};
