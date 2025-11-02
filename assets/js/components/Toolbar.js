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

function createRangeButton(label){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'seg toolbar-range-btn';
  btn.textContent = label;
  return btn;
}

function createSegmentButton(label, mode){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'seg toolbar-mode-btn';
  btn.dataset.mode = mode;
  btn.setAttribute('role', 'tab');
  btn.textContent = label;
  return btn;
}

function fallbackExport(button){
  if (typeof document === 'undefined') return;
  const data = {
    title: document.querySelector('.page-title')?.textContent?.trim?.() || document.title || 'HR Dashboard',
    mode: window.ModeStore?.mode || ModeStore.mode || 'DEMO',
    range: (() => {
      try {
        return JSON.parse(localStorage.getItem(RANGE_KEY) || 'null');
      } catch (err) {
        return null;
      }
    })(),
    compare: readCompare(),
    generatedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const iso = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `export_${iso}.json`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
  if (button && window.exporter?.notifyStart) {
    window.exporter.notifyStart(button, 'toolbar.export');
  }
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

  const titleLeft = document.createElement('div');
  titleLeft.className = 'toolbar-title-left';

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

  titleLeft.appendChild(titleGroup);
  titleRow.appendChild(titleLeft);

  const titleRight = document.createElement('div');
  titleRight.className = 'toolbar-title-right';

  const langStack = document.createElement('div');
  langStack.className = 'lang-stack';

  const langHost = document.createElement('div');
  langHost.id = 'lang-switch';
  langHost.className = 'lang-switch';
  langStack.appendChild(langHost);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'toolbar-export';
  exportButton.id = options.exportButtonId || 'toolbar-export';
  const exportIcon = document.createElement('span');
  exportIcon.className = 'toolbar-export__icon';
  exportIcon.setAttribute('aria-hidden', 'true');
  exportIcon.textContent = '⤓';
  const exportText = document.createElement('span');
  exportText.className = 'toolbar-export__label';
  exportButton.appendChild(exportIcon);
  exportButton.appendChild(exportText);
  exportButton.addEventListener('click', () => {
    if (typeof options.onExport === 'function') {
      options.onExport({button: exportButton});
      return;
    }
    if (window.exporter?.exportCurrentView) {
      window.exporter.exportCurrentView({button: exportButton});
    } else {
      fallbackExport(exportButton);
    }
  });
  langStack.appendChild(exportButton);

  titleRight.appendChild(langStack);
  titleRow.appendChild(titleRight);
  toolbar.appendChild(titleRow);

  const controlsRow = document.createElement('div');
  controlsRow.className = 'toolbar-row toolbar-controls';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'toolbar-left';

  const rangeGroup = document.createElement('div');
  rangeGroup.className = 'toolbar-range';
  rangeGroup.setAttribute('role', 'group');
  rangeGroup.setAttribute('aria-label', t('range.presets', 'Date range presets'));

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
    const btn = createRangeButton(translateRange(key, fallback));
    btn.dataset.preset = key;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      saveRange({preset: key});
      updateRangeState();
    });
    return btn;
  });
  rangeButtons.forEach(btn => rangeGroup.appendChild(btn));

  leftGroup.appendChild(rangeGroup);

  const modeGroup = document.createElement('div');
  modeGroup.className = 'mode-switch';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'mode-switch__label';
  const modeLabelId = `toolbar-mode-${Math.random().toString(36).slice(2, 9)}`;
  modeLabel.id = modeLabelId;
  modeGroup.appendChild(modeLabel);
  const segment = document.createElement('div');
  segment.className = 'mode-switch__tabs';
  segment.setAttribute('role', 'tablist');
  segment.setAttribute('aria-labelledby', modeLabelId);
  segment.setAttribute('aria-label', t('toolbar.modeGroup', 'Mode toggle'));
  const demoBtn = createSegmentButton('Demo', 'DEMO');
  const liveBtn = createSegmentButton('Live', 'LIVE');
  segment.appendChild(demoBtn);
  segment.appendChild(liveBtn);
  modeGroup.appendChild(segment);
  leftGroup.appendChild(modeGroup);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'toolbar-right';

  const teamSlot = document.createElement('div');
  teamSlot.id = 'team-filter';
  teamSlot.className = 'toolbar-team';
  rightGroup.appendChild(teamSlot);

  const startLabel = document.createElement('label');
  startLabel.className = 'toolbar-date';
  startLabel.setAttribute('for', 'toolbar-date-start');
  const startText = document.createElement('span');
  startText.className = 'toolbar-date__label';
  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.id = 'toolbar-date-start';
  startInput.className = 'toolbar-date__input';
  startLabel.appendChild(startText);
  startLabel.appendChild(startInput);

  const endLabel = document.createElement('label');
  endLabel.className = 'toolbar-date';
  endLabel.setAttribute('for', 'toolbar-date-end');
  const endText = document.createElement('span');
  endText.className = 'toolbar-date__label';
  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.id = 'toolbar-date-end';
  endInput.className = 'toolbar-date__input';
  endLabel.appendChild(endText);
  endLabel.appendChild(endInput);

  rightGroup.appendChild(startLabel);
  rightGroup.appendChild(endLabel);

  const compareLabel = document.createElement('label');
  compareLabel.className = 'toolbar-compare';
  compareLabel.setAttribute('for', 'toolbar-compare');
  const compareInput = document.createElement('input');
  compareInput.type = 'checkbox';
  compareInput.id = 'toolbar-compare';
  compareInput.className = 'toolbar-compare__checkbox';
  const compareText = document.createElement('span');
  compareText.className = 'toolbar-compare__label';
  compareLabel.appendChild(compareInput);
  compareLabel.appendChild(compareText);
  rightGroup.appendChild(compareLabel);

  controlsRow.appendChild(leftGroup);
  controlsRow.appendChild(rightGroup);
  toolbar.appendChild(controlsRow);

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
          default: return String(key || '').toUpperCase();
        }
      })();
      btn.textContent = translateRange(key, fallback);
    });
    const startLabelText = t('range.start', 'Start date');
    const endLabelText = t('range.end', 'End date');
    startText.textContent = startLabelText;
    endText.textContent = endLabelText;
    startInput.setAttribute('aria-label', startLabelText);
    endInput.setAttribute('aria-label', endLabelText);
    const compareLabelText = t('range.compare', 'Compare');
    compareText.textContent = compareLabelText;
    compareInput.setAttribute('aria-label', compareLabelText);
    const modeLabelText = t('toolbar.modeLabel', 'Mode');
    modeLabel.textContent = modeLabelText;
    const exportLabel = t('toolbar.export', 'Export');
    exportText.textContent = exportLabel;
    exportButton.setAttribute('aria-label', exportLabel);
    exportButton.setAttribute('title', exportLabel);
    exportButton.setAttribute('data-export-label', exportLabel);
  }

  function updateRangeState(){
    const range = readRange();
    const preset = range && range.preset ? normalisePreset(range.preset) : null;
    rangeButtons.forEach(btn => {
      const isActive = Boolean(preset && btn.dataset.preset === preset);
      btn.classList.toggle('seg-active', isActive);
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
    const checked = readCompare();
    compareInput.checked = checked;
    compareInput.setAttribute('aria-checked', String(checked));
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
    const checked = Boolean(compareInput.checked);
    saveCompare(checked);
    compareInput.setAttribute('aria-checked', String(checked));
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
        Promise.resolve(options.onModeChange(targetMode))
          .catch(err => console.error('[Toolbar] mode change handler failed', err));
      } else {
        ModeStore.set(targetMode);
      }
    });
  });

  segment.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const order = [demoBtn, liveBtn];
    const index = order.findIndex(btn => btn.dataset.mode === currentMode);
    let nextIndex = index;
    if (event.key === 'ArrowLeft') {
      nextIndex = index <= 0 ? order.length - 1 : index - 1;
    } else if (event.key === 'ArrowRight') {
      nextIndex = index >= order.length - 1 ? 0 : index + 1;
    }
    const nextBtn = order[nextIndex];
    if (nextBtn) {
      nextBtn.focus();
      nextBtn.click();
    }
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
