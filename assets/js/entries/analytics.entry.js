import '../utils/env.js';
import '../data-loader.js';
import '../audio-guard.js';
import '../api.js';
import '../i18n.js';
import '../team-filter.js';
import '../version.js';
import '../site.js';
import '../nav.js';
import '../app-shell.js';
import '../date-controls.js';
import '../caption.js';
import '../lazy-charts.js';
import '../guard.js';
import '../analytics.js';
import '../about.js';
import '../exporter.js';
import '../auth.js';
import '../guards.js';
import '../theme.js';
import '../sources.js';
import '../source-badge.js';
import '../stress.overview.js';
import '../ui/modal.js';
import '../asof.js';

import '../stores/modeStore.js';
import '../components/Toolbar.js';
import '../pages/analytics.js';

const devError = globalThis.devError || ((...args) => console.error(...args));

function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initAnalyticsIntro() {
  const introKey = 'analytics_tour_dismissed_v2';
  const modalId = 'legend-modal';
  const modal = document.getElementById(modalId);
  if (!modal) return;

  let forceTour = false;
  try {
    const params = new URLSearchParams(window.location.search);
    forceTour = params.get('tour') === '1';
  } catch (err) {
    forceTour = false;
  }

  let dismissed = false;
  if (!forceTour) {
    try {
      dismissed = localStorage.getItem(introKey) === '1';
    } catch (err) {
      dismissed = false;
    }
  }
  if (dismissed && !forceTour) return;

  const closeBtn = modal.querySelector('[data-close]');
  const backdrop = modal.querySelector('.modal__backdrop');
  let isOpen = false;
  let previousOverflow = '';

  const persistDismissed = () => {
    try {
      localStorage.setItem(introKey, '1');
    } catch (err) {
      /* noop */
    }
  };

  const unlockScroll = () => {
    document.body.style.overflow = previousOverflow || '';
  };

  const dismiss = () => {
    if (!isOpen) return;
    persistDismissed();
    isOpen = false;
    document.removeEventListener('keydown', handleKeydown, true);
    unlockScroll();
    if (typeof window.closeModal === 'function') {
      window.closeModal(modalId);
    } else {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  const handleKeydown = event => {
    if (!event || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    dismiss();
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (typeof window.openModal === 'function') {
      window.openModal(modalId);
    } else {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    }
    document.addEventListener('keydown', handleKeydown, true);
  };

  closeBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  });

  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  });

  backdrop?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  });

  open();
}

function applyScenarioFromQuery() {
  const canonicalScenarioFn = (() => {
    const fn = window.loaderGlobals?.canonicalScenarioKey;
    if (typeof fn === 'function') {
      return fn;
    }
    return value => {
      const key = String(value || '').toLowerCase().trim();
      if (key === 'night' || key === 'night-shift' || key === 'night_shift' || key === 'nightshift') return 'night';
      if (key === 'demo' || key === 'sandbox' || key === 'preview') return 'demo';
      return 'live';
    };
  })();

  const knownScenarioKeys = new Set([
    'live', 'production', 'prod', 'default', 'main',
    'night', 'night-shift', 'night_shift', 'nightshift',
    'demo', 'sandbox', 'preview'
  ]);

  let queryValue = null;
  try {
    queryValue = new URLSearchParams(window.location.search).get('scenario');
  } catch (err) {
    queryValue = null;
  }
  if (!queryValue) return;
  const raw = String(queryValue || '').toLowerCase().trim();
  if (!knownScenarioKeys.has(raw)) return;
  const canonical = canonicalScenarioFn(raw);
  try {
    localStorage.setItem('hr:scenario', canonical);
  } catch (err) {
    /* ignore storage issues */
  }
}

function createCaptionRenderer() {
  const t = (key, fallback) => window.I18N?.t?.(key) || fallback;

  const periodLabel = () => {
    const raw = (() => {
      try {
        return localStorage.getItem('hr:range');
      } catch (err) {
        return null;
      }
    })();
    if (!raw) return t('range.7d', '7 Days');
    try {
      const parsed = JSON.parse(raw);
      const preset = String(parsed?.preset || '').toLowerCase();
      const key = preset === 'today' || preset === 'day'
        ? 'today'
        : preset === 'mtd' || preset === 'month'
          ? 'mtd'
          : preset === 'qtd' || preset === 'quarter'
            ? 'qtd'
            : preset === 'ytd' || preset === 'year'
              ? 'ytd'
              : '7d';
      return t(`range.${key}`, '7 Days');
    } catch (err) {
      return t('range.7d', '7 Days');
    }
  };

  const teamLabel = () => {
    let team = 'all';
    try {
      team = localStorage.getItem('hr:team') || 'all';
    } catch (err) {
      team = 'all';
    }
    if (!team || team === 'all') return t('caption.teamAll', 'All Teams');
    try {
      const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
      if (map && map[team]) return map[team];
    } catch (err) {
      /* noop */
    }
    return team;
  };

  const captionInsight = () => {
    const prefix = (() => {
      try {
        return localStorage.getItem('hr:scenario') === 'night'
          ? t('caption.scenarioPrefix', 'Night-Shift Scenario · ')
          : '';
      } catch (err) {
        return '';
      }
    })();
    const base = `${t('caption.orgAvg', 'Org avg')} • ${periodLabel()} • ${teamLabel()}`;
    return `${prefix}${base}`;
  };

  return () => {
    window.Caption?.render?.('#global-caption', {
      asOf: new Date(),
      insight: captionInsight()
    });
  };
}

function setupLayoutChrome() {
  try {
    window.renderSideNav?.('analytics');
  } catch (err) {
    devError('Side nav render failed:', err);
  }

  try {
    window.DateControls?.mount('#tb-quick', {
      presets: ['Today', '7D', 'MTD', 'QTD', 'YTD'],
      compare: false,
      startSlot: '#tb-dates [data-date-slot="start"]',
      endSlot: '#tb-dates [data-date-slot="end"]',
      compareSlot: '#tb-compare'
    });
  } catch (err) {
    devError('Date controls mount failed:', err);
  }
}

function bootstrap() {
  initAnalyticsIntro();
  applyScenarioFromQuery();
  setupLayoutChrome();

  const renderCaption = createCaptionRenderer();
  renderCaption();
  document.addEventListener('i18n:change', renderCaption);
  window.addEventListener('storage', event => {
    if (!event) return;
    if (event.key === 'hr:range' || event.key === 'hr:team' || event.key === 'hr:scenario') {
      renderCaption();
    }
  });

  try {
    window.StressOverview?.mount('so-chart', 'day');
  } catch (err) {
    devError('Stress overview mount failed:', err);
  }
}

onDomReady(() => {
  try {
    bootstrap();
  } catch (err) {
    devError('Analytics bootstrap failed:', err);
  }
});
