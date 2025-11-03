(function(g){
  const RANGE_KEY = 'hr:range';
  const COMPARE_KEY = 'hr:compare';
  const DEFAULT_PRESETS = ['today', '7d', 'mtd', 'qtd', 'ytd'];
  const DEFAULT_PRESET = '7d';

  function normalizePreset(value){
    if (!value && value !== 0) return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'day') return 'today';
    return normalized;
  }

  function translateRange(key, fallback){
    const translated = g.I18N?.t?.(`range.${key}`);
    if (translated && translated !== `range.${key}`) return translated;
    if (fallback) return fallback;
    return key.toUpperCase();
  }

  function translate(key, fallback){
    const translated = g.I18N?.t?.(key);
    if (translated && translated !== key) return translated;
    return fallback != null ? fallback : key;
  }

  function mapPresetToKpiRange(range){
    const preset = normalizePreset(range?.preset);
    if (preset === 'today') return '1d';
    if (preset === '7d') return '7d';
    if (preset === 'mtd' || preset === 'qtd' || preset === 'ytd') return '30d';
    if (range?.start && range?.end) return '30d';
    return '7d';
  }

  function emitToolbarRange(range){
    if (typeof document?.dispatchEvent !== 'function') return;
    const resolved = mapPresetToKpiRange(range);
    if (!resolved) return;
    document.dispatchEvent(new CustomEvent('toolbar:range', { detail: { range: resolved } }));
  }

  function parseRangeString(raw){
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function readRange(){
    try {
      const raw = localStorage.getItem(RANGE_KEY);
      if (!raw) return null;
      const parsed = parseRangeString(raw);
      if (!parsed) return null;
      if (parsed.preset) return {preset: parsed.preset};
      if (parsed.start && parsed.end) {
        return {start: parsed.start, end: parsed.end};
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function readCompare(){
    try {
      const raw = localStorage.getItem(COMPARE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.enabled);
    } catch (err) {
      return false;
    }
  }

  function saveRange(value){
    const payload = value && typeof value === 'object' ? value : null;
    if (!payload) return;
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* ignore quota errors */
    }
    emitToolbarRange(payload);
    const evt = new StorageEvent('storage', {key: RANGE_KEY});
    try {
      Object.defineProperty(evt, 'synthetic', { value: true });
    } catch (err) {
      try {
        evt.synthetic = true;
      } catch (err2) {
        /* ignore */
      }
    }
    dispatchEvent(evt);
  }

  function saveCompare(enabled){
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify({enabled}));
    } catch (err) {
      /* ignore quota errors */
    }
    dispatchEvent(new StorageEvent('storage', {key: COMPARE_KEY}));
  }

  function mount(hostSelector, options={}){
    const host = resolveElement(hostSelector);
    if (!host) return;

    const config = {
      presets: Array.isArray(options.presets) && options.presets.length
        ? options.presets.map(normalizePreset)
        : DEFAULT_PRESETS,
      compare: Boolean(options.compare)
    };

    const startSlot = resolveElement(options.startSlot) || document.querySelector('[data-date-slot="start"]');
    const endSlot = resolveElement(options.endSlot) || document.querySelector('[data-date-slot="end"]');
    const compareSlot = resolveElement(options.compareSlot) || document.querySelector('[data-compare-slot]');

    host.innerHTML = '';
    host.classList.add('seg-group');
    host.setAttribute('role', 'group');

    const presetButtons = config.presets.map(key => createPresetButton(key, host));

    const startField = ensureDateField(startSlot, 'dc-start', 'range.start', 'Start');
    const endField = ensureDateField(endSlot, 'dc-end', 'range.end', 'End');
    const compareToggle = ensureCompareField(compareSlot, config.compare);

    const handleDateChange = () => {
      if (startField?.input?.value && endField?.input?.value) {
        saveRange({start: startField.input.value, end: endField.input.value});
      }
    };

    if (startField?.input) {
      startField.input.addEventListener('change', handleDateChange);
    }
    if (endField?.input) {
      endField.input.addEventListener('change', handleDateChange);
    }

    if (compareToggle?.input) {
      compareToggle.input.addEventListener('change', () => {
        saveCompare(Boolean(compareToggle.input.checked));
      });
    }

    function updateLocale(){
      const groupLabel = translate('range.group', 'Date range');
      host.setAttribute('aria-label', groupLabel);
      presetButtons.forEach(button => {
        const key = button.dataset.preset;
        button.textContent = translateRange(key, key.toUpperCase());
      });
      if (startField?.label) {
        const text = translate('range.start', 'Start');
        startField.label.textContent = text;
        startField.input?.setAttribute('aria-label', text);
      }
      if (endField?.label) {
        const text = translate('range.end', 'End');
        endField.label.textContent = text;
        endField.input?.setAttribute('aria-label', text);
      }
      if (compareToggle?.label) {
        compareToggle.label.textContent = translate('range.compare', 'Compare');
      }
    }

    function updateActive(){
      const range = readRange();
      const preset = range && range.preset ? normalizePreset(range.preset) : null;
      presetButtons.forEach(button => {
        const isActive = Boolean(preset && button.dataset.preset === preset);
        button.classList.toggle('is-active', isActive);
        button.classList.remove('active');
        button.setAttribute('aria-pressed', String(isActive));
      });
      if (startField?.input) {
        startField.input.value = range && range.start ? range.start : '';
      }
      if (endField?.input) {
        endField.input.value = range && range.end ? range.end : '';
      }
    }

    function updateCompareState(){
      if (!compareToggle?.input) return;
      compareToggle.input.checked = readCompare();
    }

    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.preset;
        if (!key) return;
        saveRange({preset: key});
        if (startField?.input) startField.input.value = '';
        if (endField?.input) endField.input.value = '';
        updateActive();
      });
    });

    document.addEventListener('i18n:change', updateLocale);
    if (g.I18N?.onReady) {
      g.I18N.onReady(updateLocale);
    } else {
      updateLocale();
    }

    updateActive();
    updateCompareState();

    const initialRange = readRange();
    if (!initialRange) {
      saveRange({preset: DEFAULT_PRESET});
    } else {
      emitToolbarRange(initialRange);
    }

    if (config.compare && !localStorage.getItem(COMPARE_KEY)) {
      saveCompare(false);
    }

    window.addEventListener('storage', (evt) => {
      if (!evt) return;
      if (evt.key === RANGE_KEY) {
        updateActive();
        if (!evt.synthetic) {
          const nextRange = evt.newValue ? parseRangeString(evt.newValue) : readRange();
          emitToolbarRange(nextRange || readRange());
        }
      } else if (evt.key === COMPARE_KEY) {
        updateCompareState();
      }
    });
  }

  function resolveElement(target){
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof Element) return target;
    if (target && target.nodeType === 1) return target;
    return null;
  }

  function createPresetButton(key, wrapper){
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.preset = key;
    button.className = 'seg range-pill';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = translateRange(key, key.toUpperCase());
    wrapper.appendChild(button);
    return button;
  }

  function ensureDateField(slot, id, key, fallback){
    const host = resolveElement(slot);
    if (!host) return null;
    host.classList.add('toolbar-date-slot');
    let label = host.querySelector('.toolbar-date-slot__label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'toolbar-date-slot__label';
      host.prepend(label);
    }
    let input = host.querySelector('input[type="date"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'date';
      host.appendChild(input);
    }
    label.id = label.id || `${id}-label`;
    input.id = id;
    input.classList.add('toolbar-date-slot__input');
    input.classList.add('date-input');
    input.setAttribute('aria-labelledby', label.id);
    label.textContent = translate(key, fallback);
    input.setAttribute('aria-label', translate(key, fallback));
    return {host, label, input};
  }

  function ensureCompareField(slot, enabled){
    const host = resolveElement(slot);
    if (!host) return null;
    if (!enabled) {
      host.hidden = true;
      host.setAttribute('aria-hidden', 'true');
      return null;
    }
    host.hidden = false;
    host.removeAttribute('aria-hidden');
    host.classList.add('compare');
    let input = host.querySelector('input[type="checkbox"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'checkbox';
      host.prepend(input);
    }
    let label = host.querySelector('.compare__label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'compare__label';
      host.appendChild(label);
    }
    label.textContent = translate('range.compare', 'Compare');
    return {host, input, label};
  }

  g.DateControls = {
    mount,
    readRange,
    readCompare
  };
})(window);
