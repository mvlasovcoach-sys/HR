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

function createExportButton(){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'export-fleet';
  btn.className = 'brand-btn--primary btn--export';
  btn.setAttribute('data-export-key', 'ui.exportCSV');
  btn.setAttribute('data-export-icon', '⇩');
  btn.disabled = true;
  btn.setAttribute('aria-disabled', 'true');
  btn.title = t('devices.export.disabled', 'Load data to export');
  btn.innerHTML = `
    <span class="btn__icon" aria-hidden="true">⇩</span>
    <span class="btn__label" data-i18n="ui.exportCSV">${t('ui.exportCSV', 'Export CSV')}</span>
  `;
  return btn;
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
  const actionsHost = document.querySelector('#toolbar .toolbar-actions');
  if (actionsHost) {
    const exportBtn = createExportButton();
    actionsHost.appendChild(exportBtn);
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
