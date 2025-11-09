import { initKpiInfo } from './kpi-info.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKpiInfo, { once: true });
} else {
  initKpiInfo();
}
