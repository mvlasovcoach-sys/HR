import { ModeStore } from '../stores/modeStore.js';

const RANGE_KEY = 'hr:range';
const COMPARE_KEY = 'hr:compare';
const DEFAULT_PRESETS = ['today', '7d', 'mtd', 'qtd', 'ytd'];
const DEFAULT_PRESET = '7d';

function t(key, fallback){
  try {
    const value = window.I18N?.t?.(key);
    if (value && value !== key) return value;
  } catch (err) {
    /* noop */
  }
  return fallback;
}

function translateRange(key, fallback){
  return t(`range.${key}`, fallback);
}

function normalisePreset(value){
  if (!value && value !== 0) return null;
  const text = String(value).trim().toLowerCase();
  if (text === 'day') return 'today';
  return text || null;
}

function readRange(){
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RANGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.preset) {
      const preset = normalisePreset(parsed.preset);
      return preset ? {preset} : null;
    }
    if (parsed && parsed.start && parsed.end) {
      return {start: parsed.start, end: parsed.end};
    }
  } catch (err) {
    return null;
  }
  return null;
}

function saveRange(value){
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RANGE_KEY, JSON.stringify(value));
  } catch (err) {
    /* ignore quota errors */
  }
  try {
    dispatchEvent(new StorageEvent('storage', {key: RANGE_KEY}));
  } catch (err) {
    /* ignore */
  }
}

function readCompare(){
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.enabled);
  } catch (err) {
    return false;
  }
}

function saveCompare(enabled){
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify({enabled}));
  } catch (err) {
    /* ignore quota errors */
  }
  try {
    dispatchEvent(new StorageEvent('storage', {key: COMPARE_KEY}));
  } catch (err) {
    /* ignore */
  }
}

function ensureDefaultRange(){
  if (typeof localStorage === 'undefined') return;
  if (!readRange()) {
    saveRange({preset: DEFAULT_PRESET});
  }
  if (!localStorage.getItem(COMPARE_KEY)) {
    saveCompare(false);
  }
}

function normaliseMode(value){
  const text = String(value || '').toUpperCase();
  return text === 'LIVE' ? 'LIVE' : 'DEMO';
}

function createButton(label){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'range-pill toolbar-range-btn';
  btn.textContent = label;
  return btn;
}

function createSegmentButton(label, mode){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'seg__btn';
  btn.dataset.mode = mode;
  btn.setAttribute('role', 'tab');
  btn.textContent = label;
  return btn;
}

export function renderToolbar(options = {}){
  const host = typeof options.mount === 'string' ? document.querySelector(options.mount) : options.mount;
  if (!host) return;

  ensureDefaultRange();

  const presets = Array.isArray(options.presets) && options.presets.length
    ? options.presets.map(normalisePreset).filter(Boolean)
    : DEFAULT_PRESETS;

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const titleRow = document.createElement('div');
  titleRow.className = 'toolbar-row toolbar-title-row';
  const titleGroup = document.createElement('div');
  titleGroup.className = 'toolbar-title';
  const title = document.createElement('h1');
  title.className = 'page-title';
  if (options.pageTitleKey) {
    title.dataset.i18n = options.pageTitleKey;
  }
  title.textContent = options.pageTitle || '';
  titleGroup.appendChild(title);

  const infoButton = document.createElement('button');
  infoButton.type = 'button';
  infoButton.className = 'toolbar-info';
  infoButton.textContent = 'i';
  infoButton.setAttribute('aria-label', options.infoButton?.ariaLabel || 'About this page');
  infoButton.setAttribute('aria-haspopup', 'dialog');
  infoButton.setAttribute('aria-expanded', 'false');
  if (options.infoButton?.id) {
    infoButton.id = options.infoButton.id;
  }
  if (options.infoButton?.ariaLabelKey) {
    infoButton.dataset.i18n = options.infoButton.ariaLabelKey;
    infoButton.dataset.i18nAttr = 'aria-label';
  }
  infoButton.addEventListener('click', event => {
    if (typeof options.infoButton?.onClick === 'function') {
      options.infoButton.onClick(event);
    }
  });
  titleGroup.appendChild(infoButton);

  titleRow.appendChild(titleGroup);
  const titleActions = document.createElement('div');
  titleActions.className = 'toolbar-actions';
  titleRow.appendChild(titleActions);

  toolbar.appendChild(titleRow);

  const filterRow = document.createElement('div');
  filterRow.className = 'toolbar-row toolbar-grid';

  const leftCol = document.createElement('div');
  leftCol.className = 'toolbar-stack';

  const rangeLine = document.createElement('div');
  rangeLine.className = 'toolbar-line toolbar-line--ranges';
  rangeLine.setAttribute('role', 'group');
  rangeLine.setAttribute('aria-label', t('range.presets', 'Date range presets'));

  const rangeButtons = presets.map(key => {
    const fallback = (() => {
      switch (key) {
        case 'today': return 'Today';
        case '7d': return '7 Days';
        case 'mtd': return 'Month to date';
        case 'qtd': return 'Quarter to date';
        case 'ytd': return 'Year to date';
        default: return key.toUpperCase();
      }
    })();
    const btn = createButton(translateRange(key, fallback));
    btn.dataset.preset = key;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      saveRange({preset: key});
      updateRangeState();
    });
    return btn;
  });
  rangeButtons.forEach(btn => rangeLine.appendChild(btn));

  const modeLine = document.createElement('div');
  modeLine.className = 'toolbar-line toolbar-line--mode';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'toolbar-mode-label';
  modeLine.appendChild(modeLabel);
  const segment = document.createElement('div');
  segment.className = 'seg';
  segment.setAttribute('role', 'tablist');
  segment.setAttribute('aria-label', t('toolbar.modeGroup', 'Mode toggle'));
  const demoBtn = createSegmentButton('Demo', 'DEMO');
  const liveBtn = createSegmentButton('Live', 'LIVE');
  segment.appendChild(demoBtn);
  segment.appendChild(liveBtn);
  modeLine.appendChild(segment);

  leftCol.appendChild(rangeLine);
  leftCol.appendChild(modeLine);

  const rightCol = document.createElement('div');
  rightCol.className = 'toolbar-right';

  const teamSlot = document.createElement('div');
  teamSlot.id = 'team-filter';
  teamSlot.className = 'toolbar-slot toolbar-slot--team';
  rightCol.appendChild(teamSlot);

  const dateSlot = document.createElement('div');
  dateSlot.id = 'date-controls';
  dateSlot.className = 'toolbar-slot toolbar-slot--dates';
  const datesWrapper = document.createElement('div');
  datesWrapper.className = 'toolbar-dates';
  const startLabel = document.createElement('label');
  const startText = document.createElement('span');
  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.id = 'toolbar-date-start';
  startInput.className = 'toolbar-date-input';
  startInput.placeholder = 'From';
  startLabel.appendChild(startText);
  startLabel.appendChild(startInput);

  const endLabel = document.createElement('label');
  const endText = document.createElement('span');
  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.id = 'toolbar-date-end';
  endInput.className = 'toolbar-date-input';
  endInput.placeholder = 'To';
  endLabel.appendChild(endText);
  endLabel.appendChild(endInput);

  datesWrapper.appendChild(startLabel);
  datesWrapper.appendChild(endLabel);
  dateSlot.appendChild(datesWrapper);

  const compareLabel = document.createElement('label');
  compareLabel.className = 'toolbar-compare';
  const compareInput = document.createElement('input');
  compareInput.type = 'checkbox';
  compareInput.id = 'toolbar-compare';
  const compareText = document.createElement('span');
  compareLabel.appendChild(compareInput);
  compareLabel.appendChild(compareText);
  dateSlot.appendChild(compareLabel);

  rightCol.appendChild(dateSlot);

  const langSlot = document.createElement('div');
  langSlot.id = 'lang-switch';
  langSlot.className = 'toolbar-slot toolbar-slot--lang lang-switch';
  rightCol.appendChild(langSlot);

  filterRow.appendChild(leftCol);
  filterRow.appendChild(rightCol);
  toolbar.appendChild(filterRow);

  host.innerHTML = '';
  host.appendChild(toolbar);

  function updatePresetLabels(){
    rangeButtons.forEach(btn => {
      const key = btn.dataset.preset;
      const fallback = (() => {
        switch (key) {
          case 'today': return 'Today';
          case '7d': return '7 Days';
          case 'mtd': return 'Month to date';
          case 'qtd': return 'Quarter to date';
          case 'ytd': return 'Year to date';
          default: return key.toUpperCase();
        }
      })();
      btn.textContent = translateRange(key, fallback);
    });
    startText.textContent = t('range.start', 'From');
    endText.textContent = t('range.end', 'To');
    startInput.setAttribute('aria-label', startText.textContent);
    endInput.setAttribute('aria-label', endText.textContent);
    compareText.textContent = t('range.compare', 'Compare');
    compareInput.setAttribute('aria-label', compareText.textContent);
    modeLabel.textContent = `${t('toolbar.modeLabel', 'Mode')}:`;
  }

  function updateRangeState(){
    const range = readRange();
    const preset = range && range.preset ? normalisePreset(range.preset) : null;
    rangeButtons.forEach(btn => {
      const isActive = Boolean(preset && btn.dataset.preset === preset);
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    if (range && range.start) {
      startInput.value = range.start;
    } else {
      startInput.value = '';
    }
    if (range && range.end) {
      endInput.value = range.end;
    } else {
      endInput.value = '';
    }
  }

  function updateCompareState(){
    compareInput.checked = readCompare();
  }

  function handleDateChange(){
    if (startInput.value && endInput.value) {
      saveRange({start: startInput.value, end: endInput.value});
      updateRangeState();
    }
  }

  startInput.addEventListener('change', handleDateChange);
  endInput.addEventListener('change', handleDateChange);

  compareInput.addEventListener('change', () => {
    saveCompare(Boolean(compareInput.checked));
    updateCompareState();
  });

  const modeButtons = {DEMO: demoBtn, LIVE: liveBtn};
  let currentMode = normaliseMode(options.mode || ModeStore.mode);

  function updateModeButtons(mode){
    currentMode = normaliseMode(mode);
    Object.entries(modeButtons).forEach(([key, btn]) => {
      const isActive = key === currentMode;
      btn.classList.toggle('seg-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('aria-pressed', String(isActive));
      if (isActive) {
        btn.setAttribute('tabindex', '0');
      } else {
        btn.setAttribute('tabindex', '-1');
      }
    });
  }

  Object.values(modeButtons).forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.mode;
      if (!targetMode || targetMode === currentMode) {
        return;
      }
      updateModeButtons(targetMode);
      if (typeof options.onModeChange === 'function') {
        options.onModeChange(targetMode);
      } else {
        ModeStore.set(targetMode);
      }
    });
  });

  const onModeChangeEvent = event => {
    const next = normaliseMode(event?.detail?.mode);
    if (next && next !== currentMode) {
      updateModeButtons(next);
    }
  };
  document.addEventListener('mode:change', onModeChangeEvent);

  window.addEventListener('storage', event => {
    if (!event) return;
    if (event.key === RANGE_KEY) {
      updateRangeState();
    } else if (event.key === COMPARE_KEY) {
      updateCompareState();
    } else if (event.key === 'hr:scenario') {
      const next = event.newValue === 'night' ? 'DEMO' : event.newValue === 'live' ? 'LIVE' : ModeStore.mode;
      ModeStore.mode = next;
      updateModeButtons(next);
    }
  });

  document.addEventListener('i18n:change', updatePresetLabels);
  if (window.I18N?.onReady) {
    window.I18N.onReady(updatePresetLabels);
  } else {
    updatePresetLabels();
  }

  updateRangeState();
  updateCompareState();
  updateModeButtons(currentMode);
}
