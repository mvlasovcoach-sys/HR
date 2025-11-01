(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const legendTrigger = document.getElementById('legend-trigger')
      || document.getElementById('info-btn')
      || document.getElementById('btn-legend');
    const legendModal = document.getElementById('legend-modal');
    if (!legendTrigger || !legendModal) return;

    const legendPanel = legendModal.querySelector('.modal__panel');
    const legendBody = legendModal.querySelector('.legend-body');
    const titleEl = legendModal.querySelector('#legend-title');
    const closeBtn = document.getElementById('legend-close') || legendModal.querySelector('.legend-close');
    const pageRoot = document.getElementById('app') || document.querySelector('.page') || document.body;
    let lastFocus = null;

    legendTrigger.setAttribute('aria-haspopup', 'dialog');
    legendTrigger.setAttribute('aria-expanded', 'false');

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
      if (legendBody) {
        legendBody.innerHTML = buildBody();
        insertDisclaimers(legendBody);
      }
    }

    function openLegend(){
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      renderLegend();
      legendModal.classList.add('is-open');
      legendModal.removeAttribute('aria-hidden');
      legendTrigger.setAttribute('aria-expanded', 'true');
      if (pageRoot && !pageRoot.contains(legendModal)) {
        pageRoot.setAttribute('inert', '');
      }
      if (document.body){
        document.body.dataset.prevOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
      }
      requestAnimationFrame(() => {
        if (legendPanel) legendPanel.focus();
      });
      document.addEventListener('keydown', onLegendKey);
    }

    function closeLegend(){
      legendModal.classList.remove('is-open');
      legendModal.setAttribute('aria-hidden', 'true');
      legendTrigger.setAttribute('aria-expanded', 'false');
      if (pageRoot) {
        pageRoot.removeAttribute('inert');
      }
      document.removeEventListener('keydown', onLegendKey);
      if (document.body){
        const prev = document.body.dataset.prevOverflow ?? '';
        document.body.style.overflow = prev;
        delete document.body.dataset.prevOverflow;
      }
      const focusTarget = (lastFocus instanceof HTMLElement ? lastFocus : legendTrigger);
      try {
        focusTarget?.focus();
      } catch (err) {
        // ignore focus errors
      }
      lastFocus = null;
    }

    function onLegendKey(event){
      if (event.key === 'Escape') {
        event.preventDefault();
        return closeLegend();
      }
      if (event.key === 'Tab') {
        trapFocus(event, legendModal);
      }
    }

    function trapFocus(event, root){
      if (!root) return;
      const selector = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
      const nodes = Array.from(root.querySelectorAll(selector))
        .filter(node => {
          if (node.disabled || node.getAttribute('aria-hidden') === 'true') return false;
          const rects = node.getClientRects();
          return rects.length > 0;
        });
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          last.focus();
          event.preventDefault();
        }
      } else if (active === last) {
        first.focus();
        event.preventDefault();
      }
    }

    legendTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      openLegend();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        closeLegend();
      });
    }

    legendModal.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target === legendModal || target?.classList.contains('modal__backdrop')) {
        closeLegend();
      }
    });

    document.addEventListener('i18n:change', () => {
      renderLegend();
    });

    renderLegend();

    if (new URLSearchParams(window.location.search).get('legend') === '1') {
      openLegend();
    }
  });
})();
