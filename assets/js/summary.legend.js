(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('info-btn');
    const modal = document.getElementById('legend-modal');
    if (!trigger || !modal) return;

    const body = modal.querySelector('.legend-body');
    const titleEl = modal.querySelector('#legend-title');
    const closeBtn = modal.querySelector('[data-close]');

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');

    function t(key, fallback){
      return window.I18N?.t?.(key) ?? fallback;
    }

    function buildBody(){
      const metrics = [
        t('legend.wellbeing', 'Wellbeing — composite score (0–100).'),
        t('legend.stress', 'High Stress % — share of employees with elevated stress.'),
        t('legend.fatigue', 'Elevated Fatigue % — share with elevated fatigue.')
      ];
      const engagementSelector = '#kpi-top [data-kpi-key="engagement"], #kpi-top [data-index="3"]';
      const legacySelector = '#kpi-grid .tile[data-index="3"]';
      const hasEngagement = Boolean(document.querySelector(engagementSelector) || document.querySelector(legacySelector));
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

    function insertDisclaimers(container){
      if (!container) return;
      container.querySelector('.legend-disclaimer')?.remove?.();
      const text = disclaimersText();
      if (!text) return;
      container.insertAdjacentHTML('beforeend', `<p class="legend-disclaimer">${text}</p>`);
    }

    function disclaimersText(){
      return [
        window.I18N?.t('badge.aggregatesOnly'),
        window.I18N?.t('badge.noBiosignals'),
        window.I18N?.t('badge.fixedThresholds'),
        window.I18N?.t('badge.noMl')
      ].filter(Boolean).join(' · ');
    }

    function renderLegend(){
      if (titleEl) titleEl.textContent = t('legend.title', 'Legend');
      if (closeBtn) closeBtn.setAttribute('aria-label', t('legend.close', 'Close'));
      if (body) {
        body.innerHTML = buildBody();
        insertDisclaimers(body);
      }
    }

    trigger.addEventListener('click', event => {
      event.preventDefault();
      renderLegend();
      openModal('legend-modal');
    });

    document.addEventListener('i18n:change', () => {
      renderLegend();
    });

    renderLegend();
  });
})();
