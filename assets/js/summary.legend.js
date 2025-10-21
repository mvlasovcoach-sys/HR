(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('btn-legend');
    if (!trigger) return;

    let overlay = null;
    trigger.setAttribute('aria-expanded', 'false');

    function t(key, fallback){
      return window.I18N?.t(key) || fallback;
    }

    function buildBody(){
      const metrics = [
        t('legend.wellbeing', 'Wellbeing — composite score (0–100).'),
        t('legend.stress', 'High Stress % — share of employees with elevated stress.'),
        t('legend.fatigue', 'Elevated Fatigue % — share with elevated fatigue.')
      ];
      const hasEngagement = Boolean(document.querySelector('#sum-kpi-grid .tile[data-index="3"]'));
      if (hasEngagement) {
        metrics.push(t('legend.engagement', 'Engagement Active % — share of employees engaging weekly.'));
      }
      const metricList = metrics.map(item => `<li>${item}</li>`).join('');
      const colorRows = [
        colorRow('wellbeing', window.I18N?.t('kpi.orgWellbeing') || 'Wellbeing /100'),
        colorRow('stressPct', window.I18N?.t('kpi.highStress') || 'High Stress %'),
        colorRow('fatiguePct', window.I18N?.t('kpi.elevatedFatigue') || 'Elevated Fatigue %')
      ].join('');
      const privacy = t('legend.privacy', 'Privacy: aggregates only; k-anonymity n≥5; no raw biosignals; no ML.');
      return `
        <ul class="legend__metrics">${metricList}</ul>
        <div class="legend__colors">
          <div class="legend-row"><strong>${t('legend.colors', 'Colors')}</strong></div>
          ${colorRows}
        </div>
        <p class="legend__footer">${privacy}</p>
      `;
    }

    function colorRow(key, label){
      const thresholds = window.THRESHOLDS?.[key];
      if (!thresholds) return '';
      return `
        <div class="legend-row">
          <span>${label}</span>
          ${renderRange('green', thresholds.green)}
          ${renderRange('amber', thresholds.amber)}
          ${renderRange('red', thresholds.red)}
        </div>
      `;
    }

    function renderRange(color, range){
      if (!Array.isArray(range) || range.length < 2) return '';
      const [min, max] = range;
      let label = '';
      if (min === max) {
        label = `${min}`;
      } else if (min <= 0) {
        label = `≤${max}`;
      } else if (max >= 100) {
        label = `≥${min}`;
      } else {
        label = `${min}–${max}`;
      }
      return `<span><span class="legend-dot dot-${color}"></span>${label}</span>`;
    }

    function openLegend(){
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'legend-overlay';
      overlay.innerHTML = template();
      document.body.appendChild(overlay);
      trigger.setAttribute('aria-expanded', 'true');
      overlay.addEventListener('click', handleOverlayClick);
      overlay.querySelector('.legend-close')?.addEventListener('click', closeLegend);
      document.addEventListener('keydown', handleKeydown);
    }

    function template(){
      const title = t('legend.title', 'Legend');
      const closeLabel = t('legend.close', 'Close');
      return `
        <div class="legend-modal summary-legend" role="dialog" aria-modal="true" aria-labelledby="legend-title">
          <div class="legend-header">
            <h3 id="legend-title">${title}</h3>
            <button type="button" class="legend-close" aria-label="${closeLabel}">×</button>
          </div>
          <div class="legend-body">${buildBody()}</div>
        </div>`;
    }

    function closeLegend(){
      if (!overlay) return;
      overlay.removeEventListener('click', handleOverlayClick);
      overlay.remove();
      overlay = null;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', handleKeydown);
      try { trigger.focus(); } catch (err) { /* ignore focus failures */ }
    }

    function handleOverlayClick(evt){
      if (evt.target?.id === 'legend-overlay') {
        closeLegend();
      }
    }

    function handleKeydown(evt){
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closeLegend();
      }
    }

    function refreshOverlay(){
      if (!overlay) return;
      overlay.innerHTML = template();
      overlay.querySelector('.legend-close')?.addEventListener('click', closeLegend);
    }

    trigger.addEventListener('click', evt => {
      evt.preventDefault();
      if (overlay) {
        closeLegend();
      } else {
        openLegend();
      }
    });

    document.addEventListener('i18n:change', () => {
      if (overlay) {
        refreshOverlay();
      }
    });
  });
})();
