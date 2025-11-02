import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';
import { devWarn } from '../utils/env.js';

function applyMode(mode){
  ModeStore.set(mode);
}

  function initPage(){
    ModeStore.init();
    if (ModeStore.mode === 'LIVE' && !window.APP_LIVE_ENDPOINT) {
      devWarn('[live] endpoint not configured; switching to demo');
      ModeStore.set('DEMO');
    }
    renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Analytics',
    mode: ModeStore.mode,
    onModeChange: applyMode,
    onInfo: () => {
      if (typeof window.openModal === 'function') {
        window.openModal('legend-modal');
      }
    }
  });
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
