export function exportCurrentView(){
  const payload = window.__currentView || {};
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'export.json';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => {
    link.remove();
    URL.revokeObjectURL(url);
  });
}

export function renderToolbar({ mount, title, mode, onModeChange, onInfo }) {
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;
  const resolvedMode = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  host.innerHTML = `
  <div class="toolbar">
    <div class="toolbar-row">
      <div class="toolbar-left">
        <div class="title">
          <h1 class="page-title">${title || ''}</h1>
          <button class="info" type="button" aria-label="About this page">i</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="lang-stack">
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang="en">EN</button>
            <button type="button" data-lang="nl">NL</button>
            <button type="button" data-lang="ru">RU</button>
          </div>
          <button id="btnExport" class="export" type="button">Export</button>
        </div>
      </div>
    </div>
    <div class="toolbar-row">
      <div class="toolbar-left">
        <div id="rangeSwitch" class="seg-group" data-range-slot></div>
        <div id="modeSwitch" class="seg-group" role="tablist" aria-label="Mode">
          <button id="btnModeDemo" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='DEMO'}">Demo</button>
          <button id="btnModeLive" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='LIVE'}">Live</button>
        </div>
        <div id="teamSelect" class="team-slot"></div>
        <div id="dateStart" class="toolbar-date-slot" data-date-slot="start">
          <span class="toolbar-date-slot__label" id="dc-start-label">Start</span>
          <input id="dc-start" class="toolbar-date-slot__input date-input" type="date" aria-labelledby="dc-start-label">
        </div>
        <div id="dateEnd" class="toolbar-date-slot" data-date-slot="end">
          <span class="toolbar-date-slot__label" id="dc-end-label">End</span>
          <input id="dc-end" class="toolbar-date-slot__input date-input" type="date" aria-labelledby="dc-end-label">
        </div>
        <label class="compare" data-compare-slot>
          <input type="checkbox" id="compareChk">
          <span class="compare__label">Compare</span>
        </label>
      </div>
    </div>
  </div>`;

  const demo = host.querySelector('#btnModeDemo');
  const live = host.querySelector('#btnModeLive');
  const exportBtn = host.querySelector('#btnExport');
  const infoBtn = host.querySelector('.title .info');
  const langSwitch = host.querySelector('.lang-switch');

  const updateSelected = value => {
    const next = value === 'LIVE' ? 'LIVE' : 'DEMO';
    if (demo) demo.setAttribute('aria-selected', String(next === 'DEMO'));
    if (live) live.setAttribute('aria-selected', String(next === 'LIVE'));
  };

  setupLangSwitch(langSwitch);

  if (demo) {
    demo.addEventListener('click', () => {
      updateSelected('DEMO');
      onModeChange?.('DEMO');
    });
  }
  if (live) {
    live.addEventListener('click', () => {
      updateSelected('LIVE');
      onModeChange?.('LIVE');
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCurrentView);
  }
  if (infoBtn && typeof onInfo === 'function') {
    infoBtn.addEventListener('click', onInfo);
  }
}

function setupLangSwitch(container) {
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
