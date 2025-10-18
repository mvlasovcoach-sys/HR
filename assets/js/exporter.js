(function(){
  const LIBS = [
    {global: 'html2canvas', src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'},
    {global: 'jspdf', src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'}
  ];

  async function ensureLibs(){
    for (const lib of LIBS) {
      if (window[lib.global]) continue;
      await loadScript(lib.src);
    }
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function exportPilotSummary(options, legacyFilename){
    await ensureLibs();
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

  async function exportSiteBriefPDF(options={}){
    await ensureLibs();
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
    await addSectionImage(document.getElementById('chart-gender-by-dept'), {maxHeight: 130, spacing: 10});
    await addSectionImage(document.getElementById('shift-grid'), {maxHeight: 140, spacing: 10});

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
        console.warn('exportSiteBriefPDF: capture failed', err);
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

  const api = Object.assign({}, window.exporter, {exportPilotSummary, sortTable, exportSiteBriefPDF});
  window.exporter = api;
  window.EXPORTER = api;
})();
