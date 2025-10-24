(function(g, d){
  if (!g || !d) return;

  const SOURCE_SELECTOR = '.panel[data-source-id], .card.panel[data-source-id]';

  const api = g.Sources || (g.Sources = {});

  function getLang(){
    return (g.I18N?.getLang?.() || d.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  }

  function translate(key, fallback){
    const translated = g.I18N?.t?.(key);
    if (typeof translated === 'string' && translated.trim() && translated !== key) {
      return translated;
    }
    return fallback;
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSourceNote(host, options={}){
    if (!host) return;
    const sourceId = options.sourceId;
    const lang = getLang();
    const t = (key, fallback) => (g.I18N?.t?.(key, fallback)) || translate(key, fallback);
    const getSource = g.Sources?.get;
    const source = sourceId && typeof getSource === 'function' ? getSource.call(g.Sources, sourceId) : null;

    if (!source) {
      host.innerHTML = `<span class="note__label">${escapeHtml(t('source.short', 'Source'))}:</span> —`;
      if (sourceId) {
        console.warn('[SOURCE] Missing source for panel', sourceId);
      }
      return;
    }

    const rawTitle = source.title;
    const title = typeof rawTitle === 'object'
      ? (rawTitle?.[lang] || rawTitle?.en || rawTitle?.default || '')
      : (typeof rawTitle === 'string' ? rawTitle : '');

    const threshold = options.threshold;
    const period = options.period;

    const labelSource = title
      ? `<span class="note__label">${escapeHtml(t('source.short', 'Source'))}:</span> ${escapeHtml(title)}`
      : '';
    const labelThreshold = threshold
      ? `<span class="note__label">${escapeHtml(t('source.threshold', 'Threshold'))}:</span> ${escapeHtml(threshold)}`
      : '';
    const labelPeriod = period
      ? `<span class="note__label">${escapeHtml(t('source.period', 'Period'))}:</span> ${escapeHtml(period)}`
      : '';

    const chunks = [labelSource, labelThreshold, labelPeriod].filter(Boolean);
    host.innerHTML = chunks.join('<span class="note__sep">·</span>');
  }

  function formatStats(stats){
    if (typeof api.formatStats === 'function') {
      return api.formatStats(stats);
    }
    const items = Array.isArray(stats) ? stats.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : [];
    return items.join('; ');
  }

  function applyValue(dataset, key, value){
    if (!dataset) return;
    if (value === undefined) return;
    if (value === null || value === '') {
      delete dataset[key];
      return;
    }
    dataset[key] = String(value);
  }

  function refreshPanel(panel){
    if (!panel || typeof panel !== 'object') return null;
    const id = panel.getAttribute('data-source-id');
    if (!id) return null;
    const lang = getLang();
    const descriptor = typeof api.describe === 'function' ? api.describe(id, lang) : null;
    const source = descriptor || (typeof api.get === 'function' ? api.get(id) : null);
    if (!source) return null;

    const title = descriptor?.title || (typeof source.title === 'string' ? source.title : id);
    const publisher = descriptor?.publisher || '';
    const coverage = descriptor?.coverage || '';
    const updatedAt = descriptor?.updatedAt || source.updatedAt || '';
    const link = descriptor?.link || source.link || '';
    const disclaimer = descriptor?.disclaimer
      || (source.isDemo ? translate('source.disclaimerDemo', 'Demo data (synthetic), for product preview only.') : '');

    const methodologyStats = descriptor?.methodology?.stats || source.methodology?.stats || [];
    const methodologyThreshold = descriptor?.methodology?.threshold || source.methodology?.threshold || '';
    const statsLine = formatStats(methodologyStats);

    const defaultPeriod = descriptor?.periodDefault || source.periodDefault || '';
    const periodOverride = panel.dataset.sourcePeriod;
    const periodDisplay = periodOverride && periodOverride.trim() ? periodOverride : defaultPeriod;

    const thresholdOverride = panel.dataset.sourceThreshold;
    const thresholdBase = methodologyThreshold;
    const thresholdDisplay = (thresholdOverride && thresholdOverride.trim()) || thresholdBase || '';
    const demoTag = source.isDemo ? translate('source.demoTag', '(demo)') : '';
    const thresholdWithTag = thresholdDisplay ? `${thresholdDisplay}${demoTag ? ` ${demoTag}` : ''}` : '';

    const sampleUnitOverride = panel.dataset.sourceSampleUnit;
    const sampleUnit = sampleUnitOverride || descriptor?.sample?.unit || source.sample?.unit || '';
    const sampleNOverride = panel.dataset.sourceSampleN;
    const sampleN = sampleNOverride != null && sampleNOverride !== ''
      ? Number(sampleNOverride)
      : descriptor?.sample?.nTotal;

    panel.dataset.sourceTitleDisplay = title;
    panel.dataset.sourcePublisher = publisher;
    panel.dataset.sourceCoverage = coverage;
    panel.dataset.sourceUpdated = updatedAt;
    panel.dataset.sourceLink = link;
    panel.dataset.sourceDisclaimer = disclaimer;
    panel.dataset.sourceStats = statsLine;
    panel.dataset.sourceThresholdBase = thresholdBase;
    panel.dataset.sourcePeriodBase = defaultPeriod;
    if (sampleUnit) {
      panel.dataset.sourceSampleUnit = sampleUnit;
    } else {
      delete panel.dataset.sourceSampleUnit;
    }
    if (Number.isFinite(sampleN)) {
      panel.dataset.sourceSampleN = String(sampleN);
    } else if (panel.dataset.sourceSampleN === '') {
      delete panel.dataset.sourceSampleN;
    }
    panel.dataset.sourceThresholdDisplay = thresholdWithTag;
    panel.dataset.sourcePeriodDisplay = periodDisplay;

    const titleEl = panel.querySelector('.note__src');
    if (titleEl) titleEl.textContent = title;
    const thresholdEl = panel.querySelector('.note__threshold');
    if (thresholdEl) thresholdEl.textContent = thresholdWithTag || '—';
    const periodEl = panel.querySelector('.note__period');
    if (periodEl) periodEl.textContent = periodDisplay || '—';
    const disclaimerEl = panel.querySelector('.note__disclaimer');
    if (disclaimerEl) {
      if (disclaimer) {
        disclaimerEl.textContent = disclaimer;
        disclaimerEl.hidden = false;
      } else {
        disclaimerEl.textContent = '';
        disclaimerEl.hidden = true;
      }
    }

    return { panel, source: descriptor || source };
  }

  function refreshAll(){
    const panels = d.querySelectorAll(SOURCE_SELECTOR);
    panels.forEach(panel => refreshPanel(panel));
  }

  function applyOverrides(panel, overrides = {}){
    if (!panel || typeof panel !== 'object') return;
    applyValue(panel.dataset, 'sourcePeriod', overrides.period);
    applyValue(panel.dataset, 'sourceThreshold', overrides.threshold);
    applyValue(panel.dataset, 'sourceSampleN', overrides.sampleN);
    applyValue(panel.dataset, 'sourceSampleUnit', overrides.sampleUnit);
    refreshPanel(panel);
  }

  function buildField(labelKey, fallback, value){
    if (!value) return null;
    const wrapper = d.createElement('div');
    const strong = d.createElement('b');
    strong.textContent = translate(labelKey, fallback);
    wrapper.appendChild(strong);
    wrapper.appendChild(d.createTextNode(`: ${value}`));
    return wrapper;
  }

  function openDialog(btn, panel, src){
    if (!src) return;
    refreshPanel(panel);
    const id = src.id;
    const lang = getLang();
    const descriptor = typeof api.describe === 'function' ? api.describe(id, lang) : src;
    const title = panel?.dataset?.sourceTitleDisplay || descriptor?.title || id;
    const publisher = panel?.dataset?.sourcePublisher || descriptor?.publisher || '';
    const coverage = panel?.dataset?.sourceCoverage || descriptor?.coverage || '';
    const updatedAt = panel?.dataset?.sourceUpdated || descriptor?.updatedAt || '';
    const period = panel?.dataset?.sourcePeriodDisplay || descriptor?.periodDefault || '';
    const threshold = panel?.dataset?.sourceThresholdDisplay || descriptor?.methodology?.threshold || '';
    const statsLine = panel?.dataset?.sourceStats || formatStats(descriptor?.methodology?.stats);
    const link = panel?.dataset?.sourceLink || descriptor?.link || '';
    const disclaimer = panel?.dataset?.sourceDisclaimer || descriptor?.disclaimer || '';
    const sampleUnit = panel?.dataset?.sourceSampleUnit || descriptor?.sample?.unit || '';
    const sampleN = panel?.dataset?.sourceSampleN || (descriptor?.sample?.nTotal != null ? descriptor.sample.nTotal : '');

    const modal = d.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'src-h');
    modal.tabIndex = -1;

    const card = d.createElement('div');
    card.className = 'modal__card';
    modal.appendChild(card);

    const header = d.createElement('header');
    header.className = 'modal__head';
    card.appendChild(header);

    const heading = d.createElement('h3');
    heading.id = 'src-h';
    heading.textContent = title;
    header.appendChild(heading);

    const closeBtn = d.createElement('button');
    closeBtn.className = 'modal__close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', translate('ui.close', 'Close'));
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);

    const body = d.createElement('div');
    body.className = 'modal__body';
    card.appendChild(body);

    const publisherField = buildField('source.publisher', 'Publisher', publisher);
    if (publisherField) body.appendChild(publisherField);
    const coverageField = buildField('source.coverage', 'Coverage', coverage);
    if (coverageField) body.appendChild(coverageField);

    if (statsLine || threshold) {
      const block = d.createElement('div');
      const label = d.createElement('b');
      label.textContent = translate('source.methodology', 'Methodology');
      block.appendChild(label);
      if (statsLine) {
        const text = d.createElement('p');
        text.className = 'modal__methodology';
        text.textContent = statsLine;
        block.appendChild(text);
      }
      if (threshold) {
        const thresh = d.createElement('div');
        thresh.className = 'modal__threshold';
        thresh.textContent = `${translate('source.threshold', 'Threshold')}: ${threshold}`;
        block.appendChild(thresh);
      }
      body.appendChild(block);
    }

    if (sampleN || sampleUnit) {
      const sampleValue = `${sampleN ? `n=${sampleN}` : ''}${sampleN && sampleUnit ? ' ' : ''}${sampleUnit || ''}`.trim();
      const sampleField = buildField('source.sample', 'Sample', sampleValue);
      if (sampleField) body.appendChild(sampleField);
    }

    const periodField = buildField('source.period', 'Period', period);
    if (periodField) body.appendChild(periodField);

    const updatedField = buildField('source.updated', 'Updated', updatedAt);
    if (updatedField) body.appendChild(updatedField);

    if (link) {
      const linkWrap = d.createElement('div');
      const anchor = d.createElement('a');
      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.textContent = translate('source.link', 'Open source / methodology');
      linkWrap.appendChild(anchor);
      body.appendChild(linkWrap);
    }

    if (disclaimer) {
      const note = d.createElement('p');
      note.className = 'modal__disclaimer muted';
      note.textContent = disclaimer;
      body.appendChild(note);
    }

    d.body.appendChild(modal);

    const close = () => {
      modal.remove();
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    };

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) {
        close();
      }
    });

    const escListener = event => {
      if (event.key === 'Escape') {
        close();
        d.removeEventListener('keydown', escListener, true);
      }
    };
    d.addEventListener('keydown', escListener, true);

    btn.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }

  d.addEventListener('click', event => {
    const button = event.target.closest('.src-info');
    if (!button) return;
    const panel = button.closest(SOURCE_SELECTOR);
    if (!panel) return;
    const id = panel.getAttribute('data-source-id');
    if (!id) return;
    const source = typeof api.get === 'function' ? api.get(id) : null;
    if (!source) return;
    openDialog(button, panel, source);
  });

  if (d.readyState !== 'loading') {
    refreshAll();
  } else {
    d.addEventListener('DOMContentLoaded', refreshAll, { once: true });
  }

  g.addEventListener?.('i18n:change', refreshAll);
  g.addEventListener?.('source:refresh', refreshAll);

  api.refreshPanel = refreshPanel;
  api.refresh = refreshAll;
  api.applyOverrides = applyOverrides;
  api.renderSourceNote = renderSourceNote;
  g.renderSourceNote = renderSourceNote;
})(window, document);
