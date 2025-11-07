import '../utils/env.js';
import '../data-loader.js';
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
import '../devices.js';
import '../about.js';
import '../exporter.js';
import '../auth.js';
import '../guards.js';
import '../theme.js';
import '../asof.js';

import '../stores/modeStore.js';
import '../components/Toolbar.js';
import '../pages/devices.js';

const devError = globalThis.devError || ((...args) => console.error(...args));

function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function setupLayoutChrome() {
  try {
    window.renderSideNav?.('devices');
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

  try {
    window.Caption?.render('#global-caption', {
      asOf: new Date(),
      insight: window.PageInsight || ''
    });
  } catch (err) {
    devError('Caption render failed:', err);
  }
}

onDomReady(() => {
  setupLayoutChrome();
});
