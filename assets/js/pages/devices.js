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

function initDevicesToolbar(){
  const mount = document.getElementById('toolbar');
  if (!mount) return;
  const initialMode = ModeStore.init();
  renderToolbar({
    mount,
    pageTitle: t('header.devices', 'Devices'),
    pageTitleKey: 'header.devices',
    mode: initialMode,
    infoButton: {
      id: 'devices-about',
      ariaLabel: t('ui.about', 'About this page'),
      ariaLabelKey: 'ui.about'
    },
    onModeChange: mode => {
      ModeStore.set(mode);
    }
  });
  const infoBtn = document.getElementById('devices-about');
  if (infoBtn) {
    infoBtn.setAttribute('data-about-open', '');
  }
  ModeStore.set(initialMode);
}

function boot(){
  initDevicesToolbar();
}

if (document.readyState !== 'loading') {
  boot();
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
