(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('btn-legend');
    const popover = document.getElementById('legend-pop');
    if (!trigger || !popover) return;

    let open = false;
    trigger.setAttribute('aria-expanded', 'false');

    function t(key, fallback){
      return window.I18N?.t(key) || fallback;
    }

    function render(){
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
      const title = t('legend.title', 'Legend');
      const closeLabel = t('legend.close', 'Close');
      popover.innerHTML = `
        <div class="legend__header">
          <span id="legend-title" class="legend__title">${title}</span>
          <button type="button" class="legend__close" aria-label="${closeLabel}">${closeLabel}</button>
        </div>
        <ul class="legend__metrics">${metricList}</ul>
        <div class="legend__colors">
          <div class="legend-row"><strong>${t('legend.colors', 'Colors')}</strong></div>
          ${colorRows}
        </div>
        <p class="legend__footer">${privacy}</p>
      `;
      popover.setAttribute('role', 'dialog');
      popover.setAttribute('aria-modal', 'true');
      popover.setAttribute('aria-labelledby', 'legend-title');
      popover.querySelector('.legend__close')?.addEventListener('click', close);
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

    function openPopover(){
      if (open) return;
      render();
      popover.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', handleKeydown);
      open = true;
    }

    function close(){
      if (!open) return;
      popover.hidden = true;
      popover.innerHTML = '';
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeydown);
      open = false;
      trigger.focus();
    }

    function toggle(evt){
      evt?.stopPropagation();
      if (open) {
        close();
      } else {
        openPopover();
      }
    }

    function handleDocumentClick(evt){
      if (popover.contains(evt.target) || trigger.contains(evt.target)) {
        return;
      }
      close();
    }

    function handleKeydown(evt){
      if (evt.key === 'Escape') {
        close();
      }
    }

    trigger.addEventListener('click', toggle);

    document.addEventListener('i18n:change', () => {
      if (open) {
        render();
      }
    });
  });
})();
