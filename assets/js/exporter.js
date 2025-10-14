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

  async function exportPilotSummary(sections, filename){
    await ensureLibs();
    const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
    let y = 10;
    for (const section of sections) {
      if (!section || !section.element) continue;
      const canvas = await window.html2canvas(section.element, {backgroundColor: '#06131b', scale: 2});
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth() - 20;
      const pageHeight = doc.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
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

  window.exporter = {exportPilotSummary};
})();
