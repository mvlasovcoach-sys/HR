import { renderToolbar } from '../components/Toolbar.js';
import { ModeStore } from '../stores/modeStore.js';

function applyMode(mode){
  ModeStore.set(mode);
}

function initPage(){
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Corporate',
    mode: ModeStore.mode,
    onModeChange: applyMode
  });
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
