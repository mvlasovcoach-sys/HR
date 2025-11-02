import { devError } from '../utils/env.js';

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

const state = {
  teams: readStoredTeams(),
  teamOptions: [],
  allTeamsIds: []
};

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
  }
};
