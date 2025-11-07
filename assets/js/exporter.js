const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
const LIBS = [
  {
    global: 'html2canvas',
    src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    integrity: 'sha512-BNaXQ4i9M/dwZ0pniS3pSkeYMt2rt7NmBGG99nmHn7+O+kO5OVwOB1p5MNDoAuCEi0aKBslZx2drXr/7ju0R2w=='
  },
  {
    global: 'jspdf',
    src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    integrity: 'sha512-/sP9H8byN6D+PfYZ7R6pujISiFDUFxIr05oig3NbS1Ry6j3Tz6kRXKuX3sI5Yucs5cjox96D65V6pZeRA7IJRg=='
  }
];
const EXPORT_SELECTOR = '[data-export-key]';
const SOURCE_SELECTOR = '.panel[data-source-id], .card.panel[data-source-id]';

export async function ensureExportLibs(){
  for (const lib of LIBS) {
    if (window[lib.global]) continue;
    await loadScript(lib.src, { integrity: lib.integrity, crossOrigin: 'anonymous' });
  }
}

export function loadScript(src, options = {}){
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (options.integrity) {
      script.integrity = options.integrity;
      script.crossOrigin = options.crossOrigin || 'anonymous';
      if (options.referrerPolicy) {
        script.referrerPolicy = options.referrerPolicy;
      }
    }
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

  async function exportPilotSummary(options, legacyFilename){
    await ensureExportLibs();
    if (Array.isArray(options)) {
      const legacyName = typeof legacyFilename === 'string' ? legacyFilename : 'pilot_summary.pdf';
      await legacyExport(options, legacyName);
      return;
    }

    const payload = options || {};
    const filename = payload.filename || 'pilot_summary.pdf';
    const meta = payload.meta || {};
    const kpis = Array.isArray(payload.kpis) ? payload.kpis : [];
    const events = Array.isArray(payload.events) ? payload.events : [];
    const note = typeof payload.note === 'string' ? payload.note.trim() : '';
    const heatmapEl = payload.heatmapEl || null;

    const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
    const pageWidth = doc.internal.pageSize.getWidth() - 24;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(meta.title || 'Pilot Summary', 12, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const metaLines = [meta.team, meta.range, meta.generated].filter(Boolean);
    metaLines.forEach(line => {
      ensureSpace(5);
      doc.text(String(line), 12, y);
      y += 5;
    });
    if (metaLines.length) y += 2;

    if (kpis.length) {
      addHeading(meta.kpiTitle || 'Engagement KPIs');
      kpis.forEach(item => {
        ensureSpace(14);
        doc.setFont('helvetica', 'bold');
        doc.text(item.label, 14, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const rows = [
          `Value: ${item.valueText || '—'}`,
          item.targetText ? `Target: ${item.targetText}${item.statusText ? ` · ${item.statusText}` : ''}` : null,
          item.deltaText ? `Δ: ${item.deltaText}` : null
        ].filter(Boolean);
        const wrapped = rows.flatMap(line => doc.splitTextToSize(line, pageWidth));
        doc.text(wrapped, 14, y);
        y += wrapped.length * 4 + 2;
      });
      y += 2;
    }

    if (heatmapEl) {
      addHeading(meta.heatmapTitle || 'Heatmap snapshot');
      await ensureHeatmap();
    }

    if (events.length) {
      addHeading(meta.eventsTitle || 'Events summary');
      events.forEach(evt => {
        ensureSpace(5);
        doc.text(`${evt.label}: ${evt.count}`, 14, y);
        y += 5;
      });
      y += 2;
    }

    if (note) {
      addHeading(meta.noteTitle || '');
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(180, 200, 210);
      const noteLines = doc.splitTextToSize(note, pageWidth);
      ensureSpace(noteLines.length * 4 + 4);
      doc.text(noteLines, 12, y);
      y += noteLines.length * 4 + 2;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    doc.save(filename);

    function ensureSpace(space){
      if (y + space > pageHeight - 12) {
        doc.addPage();
        y = 15;
      }
    }

    function addHeading(title){
      if (!title) return;
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, 12, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }

    async function ensureHeatmap(){
      ensureSpace(60);
      const canvas = await window.html2canvas(heatmapEl, {backgroundColor: '#06131b', scale: 2});
      const imgData = canvas.toDataURL('image/png');
      const ratio = canvas.width / canvas.height || 1;
      const renderWidth = pageWidth;
      const renderHeight = renderWidth / ratio;
      ensureSpace(renderHeight + 6);
      doc.addImage(imgData, 'PNG', 12, y, renderWidth, renderHeight, undefined, 'FAST');
      y += renderHeight + 6;
    }
  }

  function currentLang(){
    return (window.I18N?.getLang?.() || document?.documentElement?.lang || 'en').slice(0, 2).toLowerCase();
  }

  function translate(key, fallback){
    const value = window.I18N?.t?.(key);
    if (typeof value === 'string' && value.trim()) return value;
    return fallback;
  }

  function describePanelSource(panel, id, lang){
    const sources = window.Sources;
    if (!sources) return null;
    const descriptor = typeof sources.describe === 'function' ? sources.describe(id, lang) : null;
    const source = descriptor || (typeof sources.get === 'function' ? sources.get(id) : null);
    if (!source) return null;
    const statsLine = panel.dataset?.sourceStats
      || (typeof sources.formatStats === 'function'
        ? sources.formatStats(descriptor?.methodology?.stats || source.methodology?.stats)
        : '');
    const threshold = panel.dataset?.sourceThresholdDisplay
      || panel.dataset?.sourceThreshold
      || descriptor?.methodology?.threshold
      || source.methodology?.threshold
      || '';
    const period = panel.dataset?.sourcePeriodDisplay
      || panel.dataset?.sourcePeriod
      || descriptor?.periodDefault
      || source.periodDefault
      || '';
    const sampleN = panel.dataset?.sourceSampleN
      || (descriptor?.sample?.nTotal != null ? descriptor.sample.nTotal : '');
    const sampleUnit = panel.dataset?.sourceSampleUnit
      || descriptor?.sample?.unit
      || source.sample?.unit
      || '';
    const sampleText = sampleN || sampleUnit
      ? `${sampleN ? `n=${sampleN}` : ''}${sampleN && sampleUnit ? ' ' : ''}${sampleUnit}`.trim()
      : '';
    return {
      id,
      title: panel.dataset?.sourceTitleDisplay
        || descriptor?.title
        || (typeof source.title === 'string' ? source.title : id),
      publisher: panel.dataset?.sourcePublisher || descriptor?.publisher || '',
      coverage: panel.dataset?.sourceCoverage || descriptor?.coverage || '',
      updatedAt: panel.dataset?.sourceUpdated || descriptor?.updatedAt || source.updatedAt || '',
      link: panel.dataset?.sourceLink || descriptor?.link || source.link || '',
      threshold,
      period,
      stats: statsLine,
      sample: sampleText,
      disclaimer: panel.dataset?.sourceDisclaimer || descriptor?.disclaimer || '',
      isDemo: descriptor?.isDemo ?? !!source.isDemo
    };
  }

  function panelsWithin(scope){
    if (typeof document === 'undefined') return [];
    if (!scope) {
      return Array.from(document.querySelectorAll(SOURCE_SELECTOR));
    }
    const isElement = typeof Element !== 'undefined' && scope instanceof Element;
    if (isElement || (scope && scope.nodeType === 1)) {
      const element = scope;
      const direct = element.matches?.(SOURCE_SELECTOR) ? element : element.closest?.(SOURCE_SELECTOR);
      if (direct) return [direct];
      return Array.from(element.querySelectorAll?.(SOURCE_SELECTOR) || []);
    }
    return [];
  }

  function collectSourceSummaries(scope){
    if (typeof document === 'undefined') return [];
    window.Sources?.refresh?.();
    const lang = currentLang();
    const panels = panelsWithin(scope);
    const seen = new Map();
    panels.forEach(panel => {
      const id = panel?.dataset?.sourceId;
      if (!id || seen.has(id)) return;
      const summary = describePanelSource(panel, id, lang);
      if (summary) {
        seen.set(id, summary);
      }
    });
    return Array.from(seen.values());
  }

  function buildSourceCsvHeader(summaries){
    if (!Array.isArray(summaries) || !summaries.length) return [];
    const lines = [`# ${translate('source.section', 'Sources & Methodology')}`];
    summaries.forEach(summary => {
      lines.push(`# ${summary.title}`);
      if (summary.publisher) lines.push(`#   ${translate('source.publisher', 'Publisher')}: ${summary.publisher}`);
      if (summary.coverage) lines.push(`#   ${translate('source.coverage', 'Coverage')}: ${summary.coverage}`);
      if (summary.period) lines.push(`#   ${translate('source.period', 'Period')}: ${summary.period}`);
      if (summary.threshold) lines.push(`#   ${translate('source.threshold', 'Threshold')}: ${summary.threshold}`);
      if (summary.stats) lines.push(`#   ${translate('source.methodology', 'Methodology')}: ${summary.stats}`);
      if (summary.sample) lines.push(`#   ${translate('source.sample', 'Sample')}: ${summary.sample}`);
      if (summary.updatedAt) lines.push(`#   ${translate('source.updated', 'Updated')}: ${summary.updatedAt}`);
      if (summary.link) lines.push(`#   ${translate('source.link', 'Open source / methodology')}: ${summary.link}`);
      if (summary.disclaimer) lines.push(`#   ${summary.disclaimer}`);
    });
    return lines;
  }

  async function exportSiteBriefPDF(options={}){
    await ensureExportLibs();
    const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
    const margin = 12;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const title = window.I18N?.t?.('demo.title') || 'Demo';
    const badgeText = typeof options.badgeText === 'string'
      ? options.badgeText
      : document.getElementById('site-badge')?.textContent?.trim?.() || '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, margin, y);
    y += 8;

    if (badgeText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const badgeLines = doc.splitTextToSize(badgeText, contentWidth);
      doc.text(badgeLines, margin, y);
      y += badgeLines.length * 5 + 2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    await addSectionImage(document.getElementById('demo-hero'), {maxHeight: 90, spacing: 8});
    await addSectionImage(document.getElementById('demo-overview'), {spacing: 10});
    await addSectionImage(document.querySelector('#org-table table') || document.getElementById('org-table'), {maxHeight: 140, spacing: 10});
    await addSectionImage(document.getElementById('chart-gender-overall'), {maxHeight: 110, spacing: 6});
    await addSectionImage(document.getElementById('chart-age-overall'), {maxHeight: 110, spacing: 10});
    await addSectionImage(document.getElementById('chart-by-dept'), {maxHeight: 130, spacing: 10});
    await addSectionImage(document.getElementById('shift-grid'), {maxHeight: 140, spacing: 10});

    const sources = collectSourceSummaries();
    if (sources.length) {
      addHeading(translate('source.section', 'Sources & Methodology'));
      sources.forEach(summary => {
        ensureSpace(14);
        doc.setFont('helvetica', 'bold');
        doc.text(summary.title, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const details = [];
        if (summary.publisher) details.push(`${translate('source.publisher', 'Publisher')}: ${summary.publisher}`);
        if (summary.coverage) details.push(`${translate('source.coverage', 'Coverage')}: ${summary.coverage}`);
        if (summary.period) details.push(`${translate('source.period', 'Period')}: ${summary.period}`);
        if (summary.threshold) details.push(`${translate('source.threshold', 'Threshold')}: ${summary.threshold}`);
        if (summary.stats) details.push(`${translate('source.methodology', 'Methodology')}: ${summary.stats}`);
        if (summary.sample) details.push(`${translate('source.sample', 'Sample')}: ${summary.sample}`);
        if (summary.updatedAt) details.push(`${translate('source.updated', 'Updated')}: ${summary.updatedAt}`);
        if (summary.link) details.push(`${translate('source.link', 'Open source / methodology')}: ${summary.link}`);
        if (details.length) {
          const wrapped = details.flatMap(line => doc.splitTextToSize(line, contentWidth));
          ensureSpace(wrapped.length * 4 + 2);
          doc.text(wrapped, margin + 2, y);
          y += wrapped.length * 4 + 2;
        }
        if (summary.disclaimer) {
          const disclaimerLines = doc.splitTextToSize(summary.disclaimer, contentWidth);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(150, 170, 190);
          ensureSpace(disclaimerLines.length * 4 + 2);
          doc.text(disclaimerLines, margin + 2, y);
          y += disclaimerLines.length * 4 + 2;
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        }
        y += 2;
      });
      y += 2;
    }

    const note = 'Fictional demo data; aggregates only; no PII.';
    if (y > pageHeight - margin - 12) {
      doc.addPage();
      y = pageHeight - margin - 12;
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 170, 190);
    doc.text(note, margin, pageHeight - margin);
    doc.setTextColor(0, 0, 0);

    const date = new Date();
    const iso = date.toISOString().slice(0, 10);
    doc.save(`aurora_site_brief_${iso}.pdf`);

    function ensureSpace(space){
      if (y + space > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function addHeading(title){
      if (!title) return;
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }

    async function addSectionImage(element, opts={}){
      if (!element) return;
      const options = Object.assign({spacing: 6, maxHeight: pageHeight - margin * 2}, opts);
      try {
        const canvas = await window.html2canvas(element, {backgroundColor: '#06131b', scale: 2});
        const ratio = canvas.width / canvas.height || 1;
        let renderWidth = contentWidth;
        let renderHeight = renderWidth / ratio;
        const maxHeight = Math.max(60, options.maxHeight || contentWidth / ratio);
        if (renderHeight > maxHeight) {
          const scale = maxHeight / renderHeight;
          renderHeight = maxHeight;
          renderWidth = renderWidth * scale;
        }
        ensureSpace(renderHeight + options.spacing + 4);
        const x = margin + (contentWidth - renderWidth) / 2;
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
        y += renderHeight + options.spacing;
      } catch (err) {
        devWarn('exportSiteBriefPDF: capture failed', err);
      }
    }
  }

  async function legacyExport(sections, filename){
    const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
    let y = 10;
    for (const section of sections) {
      if (!section || !section.element) continue;
      const canvas = await window.html2canvas(section.element, {backgroundColor: '#06131b', scale: 2});
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth() - 20;
      const pageHeight = doc.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height || 1;
      const renderWidth = pageWidth;
      const renderHeight = renderWidth / ratio;
      if (y + renderHeight > pageHeight - 10) {
        doc.addPage();
        y = 10;
      }
      doc.addImage(imgData, 'PNG', 10, y, renderWidth, renderHeight, undefined, 'FAST');
      y += renderHeight + 8;
      if (section.caption) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 15;
        }
        doc.setFontSize(10);
        doc.text(section.caption, 12, y);
        y += 10;
      }
    }
    doc.save(filename);
  }

  function sortTable(table, colIndex, dir='asc', options={}){
    if (!table || !table.tBodies || !table.tBodies.length) return [];
    const index = Number(colIndex);
    if (!Number.isFinite(index) || index < 0) return [];
    const tbody = table.tBodies[0];
    if (!tbody) return [];
    const rows = Array.from(tbody.rows || []);
    if (!rows.length) return [];
    const direction = String(dir).toLowerCase() === 'desc' ? -1 : 1;
    const requestedType = (options.type || rows[0]?.cells?.[index]?.dataset?.sortType || 'text').toString().toLowerCase();
    const type = requestedType === 'text' ? 'text' : 'number';
    const locale = options.locale || (typeof window !== 'undefined' && window.I18N?.getLang?.());
    let collator = null;
    if (type === 'text') {
      try {
        collator = locale ? new Intl.Collator(locale, {sensitivity: 'base'}) : new Intl.Collator(undefined, {sensitivity: 'base'});
      } catch (err) {
        collator = null;
      }
    }
    const sorted = rows
      .map((row, order) => ({row, order}))
      .sort((a, b) => {
        const cellA = a.row.cells[index];
        const cellB = b.row.cells[index];
        const aVal = readCellValue(cellA);
        const bVal = readCellValue(cellB);
        const cmp = compareValues(aVal, bVal, type, collator);
        if (cmp !== 0) return cmp * direction;
        return a.order - b.order;
      })
      .map(entry => entry.row);
    sorted.forEach(row => tbody.appendChild(row));
    return sorted;

    function readCellValue(cell){
      if (!cell) return type === 'number' ? Number.NEGATIVE_INFINITY : '';
      const raw = cell.dataset?.sortValue;
      if (raw != null) return raw;
      return cell.textContent?.trim?.() ?? '';
    }

    function compareValues(a, b, valueType, collatorInstance){
      if (valueType === 'number') {
        const numA = Number(a);
        const numB = Number(b);
        const finiteA = Number.isFinite(numA);
        const finiteB = Number.isFinite(numB);
        if (!finiteA && !finiteB) return 0;
        if (!finiteA) return -1;
        if (!finiteB) return 1;
        if (numA === numB) return 0;
        return numA < numB ? -1 : 1;
      }
      const textA = String(a ?? '').trim();
      const textB = String(b ?? '').trim();
      if (collatorInstance) {
        return collatorInstance.compare(textA, textB);
      }
      if (textA === textB) return 0;
      return textA < textB ? -1 : 1;
    }
  }

  function ensureExportStructure(button, key){
    if (typeof document === 'undefined' || !button) return;
    if (!button.classList.contains('btn--export')) {
      button.classList.add('btn--export');
    }
    if (!button.querySelector('.btn__icon')) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'btn__icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = button.dataset.exportIcon || '⇩';
      button.insertBefore(iconSpan, button.firstChild || null);
    }
    const iconEl = button.querySelector('.btn__icon');
    if (iconEl) {
      iconEl.textContent = button.dataset.exportIcon || iconEl.textContent || '⇩';
    }
    let labelSpan = button.querySelector('.btn__label');
    if (!labelSpan) {
      labelSpan = document.createElement('span');
      labelSpan.className = 'btn__label';
      button.appendChild(labelSpan);
    }
    if (key && !labelSpan.getAttribute('data-i18n')) {
      labelSpan.setAttribute('data-i18n', key);
    }
  }

  function updateExportButtons(){
    if (typeof document === 'undefined') return;
    const buttons = document.querySelectorAll(EXPORT_SELECTOR);
    buttons.forEach(button => {
      const key = button.dataset.exportKey;
      if (!key) return;
      ensureExportStructure(button, key);
      const label = window.I18N?.t?.(key) || button.dataset.exportFallback || button.getAttribute('data-export-label') || button.textContent.trim() || 'Export';
      const iconEl = button.querySelector('.btn__icon');
      if (iconEl) {
        iconEl.textContent = button.dataset.exportIcon || iconEl.textContent || '⇩';
      }
      const labelEl = button.querySelector('.btn__label');
      if (labelEl) {
        labelEl.textContent = label;
      }
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('data-export-label', label);
    });
  }

  function notifyStart(button, key){
    if (button?.disabled) return;
    const labelKey = key || button?.dataset?.exportKey;
    const baseLabel = labelKey ? (window.I18N?.t?.(labelKey) || button?.getAttribute('data-export-label') || '') : (button?.getAttribute('data-export-label') || '');
    const message = window.I18N?.t?.('toast.exportStarted', baseLabel ? {label: baseLabel} : undefined)
      || window.I18N?.t?.('toast.exportStarted')
      || 'Export started';
    showExportToast(message);
  }

  function showExportToast(message){
    if (!message || typeof document === 'undefined') return;
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

  function readStoredRange(){
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem('hr:range');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function readStoredCompareFlag(){
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem('hr:compare');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.enabled);
    } catch (err) {
      return false;
    }
  }

  function exportCurrentView(options = {}){
    if (typeof document === 'undefined') return;
    const button = options.button || null;
    notifyStart(button, 'toolbar.export');
    const base = {
      title: document.querySelector('.page-title')?.textContent?.trim?.() || document.title || 'HR Dashboard',
      mode: window.ModeStore?.mode || window.AppState?.mode || 'DEMO',
      range: readStoredRange(),
      compare: readStoredCompareFlag(),
      generatedAt: new Date().toISOString()
    };
    const extra = options.extra && typeof options.extra === 'object' ? options.extra : {};
    const payload = Object.assign({}, base, extra);
    const filename = (() => {
      if (typeof options.filename === 'string' && options.filename.trim()) {
        return options.filename.trim();
      }
      const iso = new Date().toISOString().slice(0, 10);
      return `export_${iso}.json`;
    })();
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      devError('exportCurrentView failed', err);
    }
  }

  if (typeof document !== 'undefined') {
    const refresh = () => updateExportButtons();
    if (document.readyState !== 'loading') {
      refresh();
    } else {
      document.addEventListener('DOMContentLoaded', refresh, {once: true});
    }
    window.addEventListener?.('i18n:ready', updateExportButtons);
    document.addEventListener('i18n:change', updateExportButtons);
  }

const api = Object.assign({}, window.exporter, {
  exportPilotSummary,
  sortTable,
  exportSiteBriefPDF,
  exportCurrentView,
  notifyStart,
  updateExportButtons,
  collectSourceSummaries,
  buildSourceCsvHeader
});
window.exporter = api;
window.EXPORTER = api;

export async function handleExportClick(options = {}) {
  await ensureExportLibs();
  const { trigger, onExport } = options;
  if (typeof onExport === 'function') {
    await onExport();
    return;
  }
  if (typeof api.exportCurrentView === 'function') {
    await api.exportCurrentView({ button: trigger || null });
  }
}
