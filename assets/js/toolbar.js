(function initMode(){
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get('mode');
  const mode = urlMode === 'live' ? 'live' : 'demo';
  document.body.dataset.mode = mode;
  toggleModeUI(mode);
  window.renderScenarioBadge?.();

  const demoBtn = document.getElementById('btn-demo');
  const liveBtn = document.getElementById('btn-live');

  demoBtn?.addEventListener('click', () => setMode('demo'));
  liveBtn?.addEventListener('click', () => setMode('live'));

  function setMode(nextMode){
    const resolved = nextMode === 'live' ? 'live' : 'demo';
    if (resolved === document.body.dataset.mode) return;
    document.body.dataset.mode = resolved;
    toggleModeUI(resolved);
    window.App?.reload?.(resolved);
    const sp = new URLSearchParams(window.location.search);
    sp.set('mode', resolved);
    const query = sp.toString();
    const hash = window.location.hash || '';
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
    window.history.replaceState(null, '', nextUrl);
    window.renderScenarioBadge?.();
  }

  function toggleModeUI(current){
    const demoActive = current === 'demo';
    const liveActive = current === 'live';
    const demoButton = document.getElementById('btn-demo');
    const liveButton = document.getElementById('btn-live');
    if (demoButton) {
      demoButton.classList.toggle('is-active', demoActive);
      demoButton.setAttribute('aria-pressed', String(demoActive));
    }
    if (liveButton) {
      liveButton.classList.toggle('is-active', liveActive);
      liveButton.setAttribute('aria-pressed', String(liveActive));
    }
  }
})();

(function initRangeControls(){
  const RANGE_KEY = 'hr:range';
  const quickButtons = Array.from(document.querySelectorAll('#toolbar .tb-quick [data-range]'));
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');

  if (!quickButtons.length && !startInput && !endInput) {
    return;
  }

  const updateFromStorage = () => {
    const range = readRange();
    if (!range) {
      const fallback = {preset: '7d'};
      writeRange(fallback);
      applyRange(fallback);
      return;
    }
    applyRange(range);
  };

  quickButtons.forEach(button => {
    button.type = 'button';
    button.addEventListener('click', () => {
      const preset = normalise(button.dataset.range);
      if (!preset) return;
      writeRange({preset});
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';
      applyRange({preset});
    });
  });

  const handleDateChange = () => {
    const start = (startInput?.value || '').trim();
    const end = (endInput?.value || '').trim();
    if (!start || !end) return;
    writeRange({start, end});
    applyRange({start, end});
  };

  startInput?.addEventListener('change', handleDateChange);
  endInput?.addEventListener('change', handleDateChange);

  window.addEventListener('storage', event => {
    if (!event || event.key !== RANGE_KEY) return;
    updateFromStorage();
  });

  updateFromStorage();

  function applyRange(range){
    const preset = normalise(range?.preset);
    const hasDates = range && range.start && range.end;
    quickButtons.forEach(button => {
      const key = normalise(button.dataset.range);
      const isActive = Boolean(preset && key === preset);
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    if (startInput) {
      startInput.value = hasDates ? range.start : '';
    }
    if (endInput) {
      endInput.value = hasDates ? range.end : '';
    }
  }

  function readRange(){
    try {
      const raw = localStorage.getItem(RANGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed) return null;
      if (parsed.preset) {
        return {preset: normalise(parsed.preset)};
      }
      if (parsed.start && parsed.end) {
        return {start: parsed.start, end: parsed.end};
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function writeRange(value, options = {}){
    const payload = value && typeof value === 'object' ? value : null;
    if (!payload) return;
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* ignore quota errors */
    }
    if (!options.silent) {
      dispatchEvent(new StorageEvent('storage', {key: RANGE_KEY}));
    }
  }

  function normalise(value){
    if (value == null) return '';
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'day' ? 'today' : normalized;
  }
})();
