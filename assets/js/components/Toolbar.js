import { FF_DEMO_ONDUTY_BADGE } from '../modules/config/flags.js';
import { sampleSize, demoCoverage } from '../modules/demo/sample.utils.js';
import { resolveTeamKey } from '../modules/demo/onDuty.utils.js';

const TEAM_STORAGE_KEY = 'hr:team';
const TEAM_LIST_STORAGE_KEY = 'hr:teams';
const BADGE_REFRESH_MS = 60_000;
const BADGE_PLACEHOLDER = '—';

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

export function renderToolbar(options = {}) {
  const { mount, title, mode, onModeChange, onInfo } = options;
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;
  if (host.__onDutyBadgeController) {
    host.__onDutyBadgeController.destroy?.();
    host.__onDutyBadgeController = null;
  }
  const resolvedMode = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  const controls = options?.controls || {};
  const ranges = (Array.isArray(controls?.ranges) && controls.ranges.length)
    ? controls.ranges
    : ['Today', '7 Days', 'Month to date', 'Quarter to date', 'Year to date'];
  const showRanges = controls?.showRanges !== false;
  const showTeam = controls?.showTeam !== false;
  const showDates = controls?.showDates !== false;
  const showOnDutyBadge = showTeam && FF_DEMO_ONDUTY_BADGE;
  host.innerHTML = `
  <div class="toolbar">
    <div id="tb-quick" class="seg-group" role="group" aria-label="Quick ranges">
      ${showRanges ? ranges.map(r => `<button class="seg" data-range="${r}">${r}</button>`).join('') : ''}
    </div>
    <div id="tb-mode" class="seg-group" role="tablist" aria-label="Mode">
      <button id="btnModeDemo" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='DEMO'}">Demo</button>
      <button id="btnModeLive" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='LIVE'}">Live</button>
    </div>
    <div id="tb-team" class="team-slot"${showTeam ? '' : ' hidden'}>${showTeam ? `<div id="teamSelect"></div>${showOnDutyBadge ? '<span id="tb-on-duty" class="pill" hidden>—</span>' : ''}` : ''}</div>
    <div id="tb-dates"${showDates ? '' : ' hidden'}>
      <div class="field" data-date-slot="start"></div>
      <div class="field" data-date-slot="end"></div>
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

  const badgeElement = showOnDutyBadge ? host.querySelector('#tb-on-duty') : null;
  const badgeController = badgeElement ? mountOnDutyBadge(badgeElement, resolvedMode) : null;
  if (host) {
    host.__onDutyBadgeController = badgeController;
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

  if (demo) {
    demo.addEventListener('click', () => {
      updateSelected('DEMO');
      badgeController?.setMode?.('DEMO');
      onModeChange?.('DEMO');
    });
  }
  if (live) {
    live.addEventListener('click', () => {
      updateSelected('LIVE');
      badgeController?.setMode?.('LIVE');
      onModeChange?.('LIVE');
    });
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

function readStoredTeam(){
  try {
    const primary = localStorage.getItem(TEAM_STORAGE_KEY);
    if (primary && primary !== 'all') {
      return primary;
    }
    const listRaw = localStorage.getItem(TEAM_LIST_STORAGE_KEY);
    if (listRaw) {
      const parsed = JSON.parse(listRaw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed[0];
      }
    }
  } catch (err) {
    /* storage optional */
  }
  return 'all';
}

function mountOnDutyBadge(element, initialMode){
  if (!element || !FF_DEMO_ONDUTY_BADGE) {
    return null;
  }

  let currentMode = initialMode === 'DEMO' ? 'DEMO' : 'LIVE';
  let intervalId = null;

  const update = () => {
    if (currentMode !== 'DEMO' || !FF_DEMO_ONDUTY_BADGE) {
      element.textContent = BADGE_PLACEHOLDER;
      element.hidden = true;
      return;
    }
    const team = resolveTeamKey(readStoredTeam());
    const now = new Date();
    const { expected, sample, coveragePct } = sampleSize(team, now, demoCoverage);
    element.textContent = `On duty: ${expected} • Sample: ${sample} (${coveragePct}%)`;
    element.hidden = false;
  };

  const startTimer = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
    intervalId = window.setInterval(update, BADGE_REFRESH_MS);
  };

  const stopTimer = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const applyMode = mode => {
    currentMode = mode === 'DEMO' ? 'DEMO' : 'LIVE';
    if (currentMode === 'DEMO') {
      update();
      startTimer();
    } else {
      stopTimer();
      element.textContent = BADGE_PLACEHOLDER;
      element.hidden = true;
    }
  };

  const handleStorage = event => {
    if (event && event.key === TEAM_STORAGE_KEY) {
      update();
    }
  };

  window.addEventListener('storage', handleStorage);
  applyMode(currentMode);

  return {
    setMode: applyMode,
    destroy() {
      stopTimer();
      window.removeEventListener('storage', handleStorage);
    }
  };
}
