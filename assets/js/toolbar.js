(function(){
  const page = document.body?.dataset?.page || '';
  const isDemo = page === 'demo';

  function init(){
    const host = document.getElementById('toolbar');
    if (!host) return;

    if (isDemo) {
      renderToolbarCompactDemo(host);
      const titleEl = host.querySelector('.toolbar__title');
      const pageHeading = document.querySelector('.page-title');
      if (titleEl && pageHeading) {
        titleEl.textContent = pageHeading.textContent.trim();
      }
      const langSwitch = host.querySelector('.lang-switch');
      setupLangSwitch(langSwitch);
      const exportBtn = host.querySelector('#btnExport');
      bindDemoExport(exportBtn);
      return;
    }

    renderToolbarFull(host);
    initMode();
    initRangeControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function renderToolbarCompactDemo(rootEl){
    if (!rootEl) return;
    rootEl.innerHTML = `
      <div class="toolbar">
        <div class="toolbar__title"></div>
        <div class="toolbar__spacer"></div>
        <div class="toolbar__actions">
          <div class="lang-switch" role="group" aria-label="Language">
            <button class="chip is-active" type="button" data-lang="EN">EN</button>
            <button class="chip" type="button" data-lang="NL">NL</button>
            <button class="chip" type="button" data-lang="RU">RU</button>
          </div>
          <button class="chip chip--ghost" type="button" id="btnExport">Export</button>
        </div>
      </div>`;
  }

  function renderToolbarFull(rootEl){
    // Placeholder for legacy full toolbar rendering.
    if (!rootEl) return;
  }

  function bindDemoExport(button){
    if (!button) return;
    button.addEventListener('click', () => {
      if (typeof window.exportCurrentView === 'function') {
        window.exportCurrentView();
        return;
      }
      if (window.exporter && typeof window.exporter.exportCurrentView === 'function') {
        window.exporter.exportCurrentView();
      }
    });
  }

  function initMode(){
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
  }

  function initRangeControls(){
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
        const fallback = { preset: '7d' };
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
        writeRange({ preset });
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        applyRange({ preset });
      });
    });

    const handleDateChange = () => {
      const start = (startInput?.value || '').trim();
      const end = (endInput?.value || '').trim();
      if (!start || !end) return;
      writeRange({ start, end });
      applyRange({ start, end });
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
          return { preset: normalise(parsed.preset) };
        }
        if (parsed.start && parsed.end) {
          return { start: parsed.start, end: parsed.end };
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
        dispatchEvent(new StorageEvent('storage', { key: RANGE_KEY }));
      }
    }

    function normalise(value){
      if (value == null) return '';
      const normalized = String(value).trim().toLowerCase();
      return normalized === 'day' ? 'today' : normalized;
    }
  }

  function setupLangSwitch(container){
    if (!container || container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';
    const buttons = Array.from(container.querySelectorAll('button[data-lang]'));
    if (!buttons.length) return;

    const normalise = value => String(value || '').toLowerCase();

    const updateActive = lang => {
      const resolved = normalise(lang) || 'en';
      buttons.forEach(btn => {
        const isActive = normalise(btn.dataset.lang) === resolved;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
    };

    const updateLabel = () => {
      const label = window.I18N?.t?.('label.language');
      container.setAttribute('aria-label', label || 'Language');
    };

    const apply = lang => {
      const target = normalise(lang) || 'en';
      const run = resolved => {
        const next = normalise(resolved) || target;
        updateActive(next);
        document.dispatchEvent(new CustomEvent('language:changed', { detail: { lang: next } }));
      };

      try {
        localStorage.setItem('lang', target);
        localStorage.setItem('hr:lang', target);
      } catch (err) {
        /* storage optional */
      }

      if (typeof window.I18N?.setLang === 'function') {
        Promise.resolve(window.I18N.setLang(target))
          .then(() => run(window.I18N?.getLang?.()))
          .catch(() => run(window.I18N?.getLang?.() || target));
      } else if (typeof window.I18N?.set === 'function') {
        try {
          window.I18N.set(target);
        } catch (err) {
          /* noop */
        }
        run(window.I18N?.getLang?.() || target);
      } else {
        run(target);
      }
    };

    const saved = (() => {
      try {
        return normalise(localStorage.getItem('lang') || localStorage.getItem('hr:lang') || window.I18N?.getLang?.());
      } catch (err) {
        return normalise(window.I18N?.getLang?.());
      }
    })() || 'en';

    updateLabel();
    updateActive(saved);
    apply(saved);

    container.addEventListener('click', event => {
      const btn = event.target?.closest?.('button[data-lang]');
      if (!btn) return;
      const lang = normalise(btn.dataset.lang);
      if (!lang || btn.classList.contains('is-active')) {
        return;
      }
      apply(lang);
    });

    window.addEventListener('i18n:change', evt => {
      const lang = normalise(evt?.detail?.lang || window.I18N?.getLang?.() || saved);
      updateActive(lang);
      updateLabel();
    });
  }
})();
