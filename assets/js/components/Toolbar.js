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

import { AppState } from '../stores/appState.js';

const RANGE_PRESETS = {
  today: 'Today',
  '7d': '7 Days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date'
};

function normaliseRangeLabel(label){
  if (typeof label !== 'string') return null;
  const normalized = label.trim().toLowerCase();
  if (/^today/.test(normalized) || normalized === 'day' || normalized === '1d') return 'today';
  if (normalized.includes('7') || normalized === '7d' || normalized === 'week') return '7d';
  if (normalized.includes('month') || normalized === 'mtd') return 'mtd';
  if (normalized.includes('quarter') || normalized === 'qtd') return 'qtd';
  if (normalized.includes('year') || normalized === 'ytd') return 'ytd';
  return null;
}

function formatDateForInput(iso, tz = 'Europe/Amsterdam'){
  if (typeof iso !== 'string' || !iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

function updateRangeButtons(quickHost, activeKind){
  if (!quickHost) return;
  const buttons = quickHost.querySelectorAll('button[data-range-kind]');
  buttons.forEach(button => {
    const kind = button.dataset.rangeKind;
    const isActive = kind === activeKind;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

export function renderToolbar(options = {}) {
  const { mount, title, mode, onModeChange, onInfo } = options;
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;
  const resolvedMode = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  const controls = options?.controls || {};
  const ranges = (Array.isArray(controls?.ranges) && controls.ranges.length)
    ? controls.ranges
    : ['Today', '7 Days', 'Month to date', 'Quarter to date', 'Year to date'];
  const showRanges = controls?.showRanges !== false;
  const showTeam = controls?.showTeam !== false;
  const showDates = controls?.showDates !== false;
  host.innerHTML = `
  <div class="toolbar toolbar--filters">
    <div id="tb-quick" class="seg-group" role="group" aria-label="Quick ranges">
      ${showRanges ? ranges.map(r => {
        const kind = normaliseRangeLabel(r) || '';
        const label = typeof r === 'string' ? r : (RANGE_PRESETS[kind] || r);
        return `<button class="seg" data-range-kind="${kind}" type="button" role="button">${label}</button>`;
      }).join('') : ''}
    </div>
    <div id="tb-mode" class="seg-group" role="tablist" aria-label="Mode">
      <button id="btnModeDemo" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='DEMO'}">Demo</button>
      <button id="btnModeLive" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='LIVE'}">Live</button>
    </div>
    <div id="tb-team" class="team-slot"${showTeam ? '' : ' hidden'}>${showTeam ? '<div id="teamSelect"></div>' : ''}</div>
    <div id="tb-dates"${showDates ? '' : ' hidden'}>
      <label class="seg-input">
        <span>Start</span>
        <input type="date" id="tb-date-start" name="date-start" />
      </label>
      <label class="seg-input">
        <span>End</span>
        <input type="date" id="tb-date-end" name="date-end" />
      </label>
    </div>
    <div id="tb-compare" data-compare-slot></div>
  </div>`;

  const pageHeader = document.querySelector('.page-header');
  const headerTitle = pageHeader?.querySelector('.page-title');
  if (headerTitle && title) {
    headerTitle.textContent = title;
  }

  const infoBtn = document.getElementById('page-info');
  if (infoBtn) {
    infoBtn.type = 'button';
    infoBtn.setAttribute('aria-label', 'About this page');
    infoBtn.hidden = false;
    infoBtn.onclick = typeof onInfo === 'function' ? onInfo : null;
  }

  const headerLangSwitch = document.querySelector('#header-actions .lang-switch');
  setupLangSwitch(headerLangSwitch);

  const exportBtn = document.getElementById('tb-export');
  if (exportBtn && exportBtn.dataset.bound !== 'true') {
    exportBtn.dataset.bound = 'true';
    exportBtn.addEventListener('click', exportCurrentView);
  }

  const demo = host.querySelector('#btnModeDemo');
  const live = host.querySelector('#btnModeLive');
  const quickHost = host.querySelector('#tb-quick');
  if (quickHost && !showRanges) {
    quickHost.hidden = true;
    quickHost.setAttribute('aria-hidden', 'true');
  }
  const teamHost = host.querySelector('#tb-team');
  if (teamHost && !showTeam) {
    teamHost.setAttribute('aria-hidden', 'true');
  }
  const datesHost = host.querySelector('#tb-dates');
  if (datesHost && !showDates) {
    datesHost.setAttribute('aria-hidden', 'true');
  }

  const toolbarEl = host.querySelector('.toolbar');
  if (toolbarEl && datesHost) {
    toolbarEl.appendChild(datesHost);
  }

  const compareSlot = host.querySelector('#tb-compare');
  if (compareSlot) {
    compareSlot.innerHTML = '';
  }

  const updateSelected = value => {
    const next = value === 'LIVE' ? 'LIVE' : 'DEMO';
    if (demo) demo.setAttribute('aria-selected', String(next === 'DEMO'));
    if (live) live.setAttribute('aria-selected', String(next === 'LIVE'));
  };

  const emitModeChange = value => {
    const next = value === 'LIVE' ? 'LIVE' : 'DEMO';
    document.dispatchEvent(new CustomEvent('state:mode-changed', { detail: { mode: next } }));
    onModeChange?.(next);
  };

  if (demo) {
    demo.addEventListener('click', () => {
      updateSelected('DEMO');
      emitModeChange('DEMO');
    });
  }
  if (live) {
    live.addEventListener('click', () => {
      updateSelected('LIVE');
      emitModeChange('LIVE');
    });
  }

  if (quickHost) {
    quickHost.addEventListener('click', event => {
      const btn = event.target?.closest?.('button[data-range-kind]');
      if (!btn) return;
      const kind = btn.dataset.rangeKind || '';
      AppState.setRangeKind(kind);
    });
  }

  const startInput = host.querySelector('#tb-date-start');
  const endInput = host.querySelector('#tb-date-end');

  const applyRangeToInputs = (resolved, selection) => {
    if (!startInput || !endInput || !resolved) return;
    const tz = 'Europe/Amsterdam';
    if (selection?.kind === 'custom' && selection.start && selection.end) {
      startInput.value = selection.start;
      endInput.value = selection.end;
      return;
    }
    const startValue = formatDateForInput(resolved.start, tz);
    let endValue = startValue;
    if (typeof resolved.end === 'string') {
      const exclusive = new Date(resolved.end);
      if (!Number.isNaN(exclusive.valueOf())) {
        const inclusive = new Date(exclusive.getTime() - 1);
        endValue = formatDateForInput(inclusive.toISOString(), tz) || endValue;
      }
    }
    startInput.value = startValue;
    endInput.value = endValue;
  };

  if (startInput) {
    startInput.addEventListener('change', () => {
      if (!startInput.value || !endInput?.value) {
        AppState.setCustomRange(startInput.value, endInput?.value ?? '');
        return;
      }
      if (startInput.value > endInput.value) return;
      AppState.setCustomRange(startInput.value, endInput.value);
    });
  }

  if (endInput) {
    endInput.addEventListener('change', () => {
      if (!startInput?.value || !endInput.value) {
        AppState.setCustomRange(startInput?.value ?? '', endInput.value);
        return;
      }
      if (startInput.value > endInput.value) return;
      AppState.setCustomRange(startInput.value, endInput.value);
    });
  }

  const syncRange = event => {
    const detail = event?.detail || {};
    const resolved = detail.range || AppState.getResolvedRange();
    const selection = detail.selection || AppState.getRangeSelection();
    updateRangeButtons(quickHost, selection?.kind || 'today');
    applyRangeToInputs(resolved, selection);
  };

  document.addEventListener('state:range-changed', syncRange);
  requestAnimationFrame(() => {
    const applyInitial = resolved => {
      const selection = AppState.getRangeSelection();
      updateRangeButtons(quickHost, selection?.kind || 'today');
      applyRangeToInputs(resolved || AppState.getResolvedRange(), selection);
    };
    const maybePromise = AppState.getResolvedRangeAsync?.();
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(applyInitial).catch(() => {
        applyInitial(AppState.getResolvedRange());
      });
    } else {
      applyInitial(AppState.getResolvedRange());
    }
  });
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
      const upperTarget = target.toUpperCase();
      localStorage.setItem('demo-lang', upperTarget);
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
      return normalise(
        localStorage.getItem('demo-lang')
        || localStorage.getItem('lang')
        || localStorage.getItem('hr:lang')
        || window.I18N?.getLang?.()
      );
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
