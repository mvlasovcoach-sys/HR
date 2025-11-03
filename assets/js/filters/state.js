const MODE_DEFAULT = 'demo';
const TEAM_ALL_TOKEN = '*';
const RANGE_DEFAULT = { preset: '7d' };

const hasDocument = typeof document !== 'undefined';

const safeDocument = hasDocument ? document : null;

function normaliseMode(value){
  const key = String(value || '').toLowerCase();
  if (key === 'live') return 'live';
  return MODE_DEFAULT;
}

function parseJsonList(value){
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    /* noop */
  }
  return null;
}

function normaliseTeam(value){
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (key === TEAM_ALL_TOKEN || key === 'all' || key === 'all-teams' || key === 'all teams') {
    return TEAM_ALL_TOKEN;
  }
  return trimmed;
}

function unique(list){
  const seen = new Set();
  const output = [];
  list.forEach(item => {
    const value = normaliseTeam(item);
    if (!value) return;
    if (value !== TEAM_ALL_TOKEN && seen.has(value)) return;
    if (value === TEAM_ALL_TOKEN) {
      output.length = 0;
      output.push(TEAM_ALL_TOKEN);
      seen.clear();
      return;
    }
    seen.add(value);
    output.push(value);
  });
  if (!output.length) {
    return [TEAM_ALL_TOKEN];
  }
  return output;
}

function readElementValue(el){
  if (!el) return null;
  if (typeof el.value === 'string') {
    return el.value;
  }
  const datasetValue = el.getAttribute?.('data-value') || el.getAttribute?.('data-selected') || el.dataset?.value || el.dataset?.selected;
  if (typeof datasetValue === 'string') {
    return datasetValue;
  }
  return null;
}

function readSelectedOptions(el){
  if (!el) return [];
  if (el.selectedOptions && typeof el.selectedOptions === 'object') {
    return Array.from(el.selectedOptions).map(option => option?.value).filter(Boolean);
  }
  if (Array.isArray(el.options)) {
    return el.options.filter(option => option?.selected).map(option => option.value);
  }
  return [];
}

function readCheckboxValues(container){
  if (!container) return [];
  return Array.from(container.querySelectorAll?.('input[type="checkbox"], input[type="radio"]') || [])
    .filter(input => input?.checked)
    .map(input => input.value)
    .filter(Boolean);
}

function readChipValues(container){
  if (!container) return [];
  return Array.from(container.querySelectorAll?.('[data-team], [data-value], [data-id]') || [])
    .filter(node => {
      if (node.matches?.('[aria-pressed]')) {
        return node.getAttribute('aria-pressed') === 'true';
      }
      if (node.classList?.contains('is-active')) {
        return true;
      }
      if (node.getAttribute?.('data-active')) {
        const attr = node.getAttribute('data-active');
        return attr === '' || attr === 'true';
      }
      return false;
    })
    .map(node => node.dataset?.team || node.dataset?.value || node.dataset?.id || node.getAttribute?.('data-team') || node.getAttribute?.('data-value'))
    .filter(Boolean);
}

function parseTeamPayload(value){
  if (!value) return [];
  const json = parseJsonList(value);
  if (json) {
    return json;
  }
  return String(value)
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function readPresetFromButton(container){
  if (!container) return null;
  const active = container.querySelector('[data-range].is-active, [data-range][aria-pressed="true"], [data-preset].is-active, [data-preset][aria-pressed="true"], button.is-active[data-value], button[aria-pressed="true"][data-value]');
  if (active) {
    return active.dataset?.range || active.dataset?.preset || active.dataset?.value || active.getAttribute('data-range') || active.getAttribute('data-preset') || active.getAttribute('data-value') || active.value;
  }
  const direct = container.getAttribute?.('data-selected') || container.dataset?.selected || container.getAttribute?.('data-value') || container.dataset?.value;
  if (direct) {
    return direct;
  }
  const pressed = container.querySelector('[aria-pressed="true"]');
  if (pressed) {
    return pressed.dataset?.range || pressed.dataset?.preset || pressed.dataset?.value || pressed.value;
  }
  return null;
}

function normalisePreset(value){
  if (!value && value !== 0) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  return normalised === 'day' ? 'today' : normalised;
}

function readDateValue(el){
  if (!el) return null;
  const value = readElementValue(el);
  if (!value) return null;
  return String(value).trim();
}

function readStoredRange(){
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hr:range');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.preset) {
        return { preset: normalisePreset(parsed.preset) || '7d' };
      }
      if (parsed.start && parsed.end) {
        return { start: String(parsed.start), end: String(parsed.end) };
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

export function getMode(){
  if (!hasDocument) return MODE_DEFAULT;
  const q = new URLSearchParams(location.search);
  if (document.body?.dataset?.page === 'demo') return MODE_DEFAULT;
  return normaliseMode(q.get('mode'));
}

export function getSelectedTeams(){
  if (!hasDocument) return [TEAM_ALL_TOKEN];
  const el = safeDocument?.querySelector?.('[data-filter="teams"]');
  if (!el) return [TEAM_ALL_TOKEN];

  const collected = [];
  const directValue = readElementValue(el);
  if (directValue) {
    collected.push(...parseTeamPayload(directValue));
  }

  collected.push(...readSelectedOptions(el));
  collected.push(...readCheckboxValues(el));
  collected.push(...readChipValues(el));

  if (el !== safeDocument) {
    collected.push(...readCheckboxValues(el.parentElement));
    collected.push(...readChipValues(el.parentElement));
  }

  const datasetList = parseTeamPayload(el.getAttribute?.('data-teams'));
  if (datasetList.length) {
    collected.push(...datasetList);
  }

  if (!collected.length) {
    const stored = (() => {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem('hr:teams');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
        const single = localStorage.getItem('hr:team');
        if (single) return [single];
      } catch (err) {
        return null;
      }
      return null;
    })();
    if (stored && stored.length) {
      collected.push(...stored);
    }
  }

  return unique(collected);
}

export function getDateRange(){
  if (!hasDocument) return { ...RANGE_DEFAULT };
  const startEl = safeDocument?.querySelector?.('[data-filter="start"]');
  const endEl = safeDocument?.querySelector?.('[data-filter="end"]');
  const presetHost = safeDocument?.querySelector?.('[data-filter="preset"], [data-filter="presets"]');

  if (!startEl && !presetHost) {
    return { ...RANGE_DEFAULT };
  }

  const start = readDateValue(startEl);
  const end = readDateValue(endEl);
  if (start && end) {
    return { start, end };
  }

  const presetRaw = readPresetFromButton(presetHost);
  const preset = normalisePreset(presetRaw);
  if (preset) {
    return { preset };
  }

  if (start || end) {
    return { ...RANGE_DEFAULT };
  }

  const stored = readStoredRange();
  if (stored) {
    if (stored.preset) {
      return { preset: stored.preset };
    }
    if (stored.start && stored.end) {
      return { start: stored.start, end: stored.end };
    }
  }

  return { ...RANGE_DEFAULT };
}

if (typeof window !== 'undefined') {
  window.HR_FILTERS = Object.assign(window.HR_FILTERS || {}, {
    getMode,
    getSelectedTeams,
    getDateRange
  });
}

export default {
  getMode,
  getSelectedTeams,
  getDateRange
};
