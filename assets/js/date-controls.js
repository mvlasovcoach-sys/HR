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

  function readRange(){
    try {
      const raw = localStorage.getItem(RANGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
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
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(value));
    } catch (err) {
      /* ignore quota errors */
    }
    dispatchEvent(new StorageEvent('storage', {key: RANGE_KEY}));
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
    const host = typeof hostSelector === 'string' ? document.querySelector(hostSelector) : hostSelector;
    if (!host) return;

    const config = {
      presets: Array.isArray(options.presets) && options.presets.length
        ? options.presets.map(normalizePreset)
        : DEFAULT_PRESETS,
      compare: Boolean(options.compare)
    };

    host.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'dc';
    host.appendChild(wrapper);

    const presetButtons = config.presets.map(key => createPresetButton(key, wrapper));

    const separator = document.createElement('span');
    separator.className = 'dc__sep';
    wrapper.appendChild(separator);

    const start = document.createElement('input');
    start.type = 'date';
    start.id = 'dc-start';
    start.className = 'dc__input date-input';
    wrapper.appendChild(start);

    const end = document.createElement('input');
    end.type = 'date';
    end.id = 'dc-end';
    end.className = 'dc__input date-input';
    wrapper.appendChild(end);

    [start, end].forEach(input => {
      input.addEventListener('change', () => {
        if (start.value && end.value) {
          saveRange({start: start.value, end: end.value});
        }
      });
    });

    let compareToggle = null;
    if (config.compare) {
      compareToggle = createCompareToggle(wrapper);
    }

    function updateLocale(){
      presetButtons.forEach(button => {
        const key = button.dataset.preset;
        button.textContent = translateRange(key, key.toUpperCase());
      });
      start.setAttribute('aria-label', translate('range.start', 'Start date'));
      end.setAttribute('aria-label', translate('range.end', 'End date'));
      if (compareToggle) {
        const label = compareToggle.querySelector('.dc__compare-label');
        if (label) label.textContent = translate('range.compare', 'Compare');
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
      if (range && range.start) start.value = range.start; else start.value = '';
      if (range && range.end) end.value = range.end; else end.value = '';
    }

    function updateCompareState(){
      if (!compareToggle) return;
      const input = compareToggle.querySelector('input[type="checkbox"]');
      if (input) {
        input.checked = readCompare();
      }
    }

    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.preset;
        if (key) {
          saveRange({preset: key});
          start.value = '';
          end.value = '';
          updateActive();
        }
      });
    });

    if (compareToggle) {
      const input = compareToggle.querySelector('input[type="checkbox"]');
      input.addEventListener('change', () => {
        saveCompare(Boolean(input.checked));
      });
    }

    document.addEventListener('i18n:change', updateLocale);
    if (g.I18N?.onReady) {
      g.I18N.onReady(updateLocale);
    } else {
      updateLocale();
    }

    updateActive();
    updateCompareState();

    if (!readRange()) {
      saveRange({preset: DEFAULT_PRESET});
    } else {
      updateActive();
    }

    if (config.compare && !localStorage.getItem(COMPARE_KEY)) {
      saveCompare(false);
    }

    window.addEventListener('storage', (evt) => {
      if (!evt) return;
      if (evt.key === RANGE_KEY) {
        updateActive();
      } else if (evt.key === COMPARE_KEY) {
        updateCompareState();
      }
    });
  }

  function createPresetButton(key, wrapper){
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.preset = key;
    button.className = 'dc__preset range-pill';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = translateRange(key, key.toUpperCase());
    wrapper.appendChild(button);
    return button;
  }

  function createCompareToggle(wrapper){
    const label = document.createElement('label');
    label.className = 'dc__compare';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'dc__compare-input';
    const span = document.createElement('span');
    span.className = 'dc__compare-label';
    span.textContent = translate('range.compare', 'Compare');
    label.appendChild(input);
    label.appendChild(span);
    wrapper.appendChild(label);
    return label;
  }

  g.DateControls = {
    mount,
    readRange,
    readCompare
  };
})(window);
