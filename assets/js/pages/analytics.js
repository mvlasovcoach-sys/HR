import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';

function t(key, fallback){
  try {
    const value = window.I18N?.t?.(key);
    if (value && value !== key) return value;
  } catch (err) {
    /* noop */
  }
  return fallback;
}

function initAnalyticsToolbar(){
  const mount = document.getElementById('toolbar');
  if (!mount) return;
  const initialMode = ModeStore.init();
  renderToolbar({
    mount,
    pageTitle: t('header.analytics', 'Analytics'),
    pageTitleKey: 'header.analytics',
    mode: initialMode,
    infoButton: {
      id: 'info-btn',
      ariaLabel: t('ui.about', 'About this page'),
      ariaLabelKey: 'ui.about',
      onClick: () => {
        const button = document.getElementById('info-btn');
        if (button) {
          button.setAttribute('aria-expanded', 'true');
        }
        if (typeof window.openModal === 'function') {
          window.openModal('legend-modal');
        }
      }
    },
    onModeChange: mode => {
      ModeStore.set(mode);
    }
  });
  ModeStore.set(initialMode);
}

function boot(){
  initAnalyticsToolbar();
}

if (document.readyState !== 'loading') {
  boot();
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
