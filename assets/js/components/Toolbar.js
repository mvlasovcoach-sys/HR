export function exportCurrentView(){
  const payload = window.__currentView || {};
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'export.json';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => {
    link.remove();
    URL.revokeObjectURL(url);
  });
}

export function renderToolbar({
  mount, title, mode, onModeChange, onInfo
}){
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;
  const resolvedMode = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
  host.innerHTML = `
  <div class="toolbar">
    <div class="toolbar-row">
      <div class="title"><h1 class="page-title">${title || ''}</h1>
        <button class="info" aria-label="About this page">i</button>
      </div>
      <div class="lang-stack">
        <div class="lang-switch" id="langSwitch">
          <button data-lang="EN">EN</button>
          <button data-lang="NL">NL</button>
          <button data-lang="RU">RU</button>
        </div>
        <button id="btnExport" class="export">Export</button>
      </div>
    </div>
    <div class="toolbar-row">
      <div class="toolbar-left">
        <div id="rangeSwitch" class="seg-group">
          <button class="seg">Today</button>
          <button class="seg">7 Days</button>
          <button class="seg">Month to date</button>
          <button class="seg">Quarter to date</button>
          <button class="seg">Year to date</button>
        </div>
        <div id="modeSwitch" class="seg-group" role="tablist" aria-label="Mode">
          <button id="btnModeDemo" class="seg" role="tab" aria-selected="${resolvedMode==='DEMO'}">Demo</button>
          <button id="btnModeLive" class="seg" role="tab" aria-selected="${resolvedMode==='LIVE'}">Live</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div id="teamSelect"></div>
        <div id="dateStart"></div>
        <div id="dateEnd"></div>
        <label class="compare"><input type="checkbox" id="compareChk"/> Compare</label>
      </div>
    </div>
  </div>`;

  const demo = host.querySelector('#btnModeDemo');
  const live = host.querySelector('#btnModeLive');
  const exportBtn = host.querySelector('#btnExport');
  const infoBtn = host.querySelector('.title .info');

  const updateSelected = value => {
    const next = value === 'LIVE' ? 'LIVE' : 'DEMO';
    if (demo) demo.setAttribute('aria-selected', String(next === 'DEMO'));
    if (live) live.setAttribute('aria-selected', String(next === 'LIVE'));
  };

  if (demo) {
    demo.addEventListener('click', () => {
      updateSelected('DEMO');
      onModeChange?.('DEMO');
    });
  }
  if (live) {
    live.addEventListener('click', () => {
      updateSelected('LIVE');
      onModeChange?.('LIVE');
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCurrentView);
  }
  if (infoBtn && typeof onInfo === 'function') {
    infoBtn.addEventListener('click', onInfo);
  }
}
