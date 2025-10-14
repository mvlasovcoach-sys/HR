(function(){
  const cardsEl = document.getElementById('devices-cards');
  if (!cardsEl) return;
  const tableEl = document.getElementById('devices-table');
  const histogramEl = document.getElementById('devices-histogram');
  const captionEl = document.getElementById('devices-caption');
  const exportBtn = document.getElementById('devices-export');

  exportBtn?.addEventListener('click', exportCsv);
  window.addEventListener('storage', evt => {
    if (!evt) return;
    if (evt.key === 'hr:range' || evt.key === 'hr:team') {
      render();
    }
  });
  document.addEventListener('i18n:change', render);

  render();

  function readRange(){
    try {
      const raw = localStorage.getItem('hr:range');
      if (!raw) return {preset: '7d'};
      const parsed = JSON.parse(raw);
      if (parsed && parsed.preset) return parsed;
      if (parsed && parsed.start && parsed.end) return parsed;
    } catch (e) {}
    return {preset: '7d'};
  }

  function readTeam(){
    try {
      return localStorage.getItem('hr:team') || 'all';
    } catch (e) {
      return 'all';
    }
  }

  function presetForRange(range){
    if (range.preset) {
      if (range.preset === 'month' || range.preset === 'year') return range.preset;
      return '7d';
    }
    if (range.start && range.end) {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (!isNaN(start) && !isNaN(end)) {
        const diff = (end - start) / (1000 * 60 * 60 * 24);
        if (diff > 120) return 'year';
        if (diff > 21) return 'month';
      }
    }
    return '7d';
  }

  async function render(){
    const range = readRange();
    const team = readTeam();
    const preset = presetForRange(range);
    const data = await loadFleet(preset, range, team);
    if (!data) {
      const emptyText = window.t ? window.t('status.noData') : 'No data available';
      cardsEl.innerHTML = `<p role="status">${emptyText}</p>`;
      tableEl.innerHTML = '';
      histogramEl.innerHTML = '';
      if (captionEl) captionEl.textContent = '';
      return;
    }
    renderCards(data, team);
    renderTable(data, team);
    renderHistogram(data);
    if (captionEl) captionEl.textContent = buildCaption(range, team);
    exportBtn?.setAttribute('aria-label', `${window.t('label.export.csv')} (${preset})`);
  }

  async function loadFleet(preset, range, team){
    try {
      const path = `./data/org/fleet_${preset}.json`;
      return await window.dataLoader.fetch(path, {range, team});
    } catch (e) {
      console.error('Fleet data failed', e);
      return null;
    }
  }

  function renderCards(data, team){
    const source = team !== 'all' ? data.teams?.find(entry => entry.team === team) : data.summary;
    const cards = [
      {key: 'devices_online_pct', label: 'kpi.devicesOnline', value: source?.devices_online_pct ?? source?.online_pct ?? 0, unit: '%'},
      {key: 'avg_battery_pct', label: 'kpi.avgBattery', value: source?.avg_battery_pct ?? source?.avg_battery ?? 0, unit: '%'},
      {key: 'sync_fresh_pct', label: 'kpi.syncFresh', value: source?.sync_fresh_pct ?? source?.sync_fresh ?? 0, unit: '%'}
    ];
    cardsEl.classList.add('devices-cards');
    cardsEl.innerHTML = cards.map(card => {
      const value = card.value != null ? Math.round(card.value) : 0;
      const tone = toneForValue(value);
      return `<article class="tile">
        <header class="tile__head">
          <span class="tile__title">${window.t(card.label)}</span>
          <span class="status-chip ${tone.className}">${tone.label}</span>
        </header>
        <div class="tile__kpi">${value}<span>${card.unit}</span></div>
        <footer class="tile__foot">
          <span>${window.t('status.value')}</span>
          <span>${value}${card.unit}</span>
        </footer>
      </article>`;
    }).join('');
  }

  function renderTable(data, team){
    const rows = Array.isArray(data.teams) ? data.teams : [];
    const filtered = team !== 'all' ? rows.filter(row => row.team === team) : rows;
    if (!filtered.length) {
      const emptyText = window.t ? window.t('devices.empty') : 'No device data';
      tableEl.innerHTML = `<p role="status">${emptyText}</p>`;
      return;
    }
    const headers = [
      {key: 'team', label: window.t('devices.table.team')},
      {key: 'devices', label: window.t('devices.table.devices')},
      {key: 'online_pct', label: window.t('devices.table.online')},
      {key: 'avg_battery', label: window.t('devices.table.battery')},
      {key: 'last_sync', label: window.t('devices.table.sync')},
      {key: 'status', label: window.t('devices.table.status')}
    ];
    const rowsMarkup = filtered.map(row => {
      const status = statusClass(row.status, row.avg_battery ?? row.avg_battery_pct ?? 0);
      return `<tr>
        <td>${teamName(row.team)}</td>
        <td>${row.devices}</td>
        <td>${Math.round(row.online_pct ?? row.devices_online_pct ?? 0)}%</td>
        <td>${Math.round(row.avg_battery ?? row.avg_battery_pct ?? 0)}%</td>
        <td>${formatSync(row.last_sync)}</td>
        <td><span class="status-chip ${status.className}">${status.label}</span></td>
      </tr>`;
    }).join('');
    tableEl.innerHTML = `<table><thead><tr>${headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead><tbody>${rowsMarkup}</tbody></table>`;
  }

  function renderHistogram(data){
    if (!Array.isArray(data.distribution)) {
      histogramEl.innerHTML = '';
      return;
    }
    histogramEl.innerHTML = data.distribution.map(item => {
      const width = Math.min(100, Math.round((item.value || 0) * 2));
      return `<div class="devices-histogram__bar">
        <span>${item.bucket}</span>
        <div class="devices-histogram__track"><div class="devices-histogram__fill" style="width:${width}%"></div></div>
        <span class="devices-histogram__value">${item.value}</span>
      </div>`;
    }).join('');
  }

  function exportCsv(){
    const range = readRange();
    const team = readTeam();
    const preset = presetForRange(range);
    const data = Array.from(tableEl.querySelectorAll('tbody tr')).map(row => Array.from(row.children).map(cell => cell.textContent.trim()));
    if (!data.length) return;
    const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const csvRows = [headers, ...data]
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvRows], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const teamSlug = team === 'all' ? 'all-teams' : team;
    link.download = `devices_${teamSlug}_${preset}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toneForValue(value){
    if (value >= 60) return {className: 'status-chip--green', label: window.t('devices.status.good')};
    if (value >= 30) return {className: 'status-chip--amber', label: window.t('devices.status.caution')};
    return {className: 'status-chip--red', label: window.t('devices.status.poor')};
  }

  function statusClass(status, value){
    if (status === 'green') return {className: 'status-chip--green', label: window.t('devices.status.good')};
    if (status === 'amber') return {className: 'status-chip--amber', label: window.t('devices.status.caution')};
    if (status === 'red') return {className: 'status-chip--red', label: window.t('devices.status.poor')};
    return toneForValue(value);
  }

  function formatSync(ts){
    if (!ts) return '—';
    const date = new Date(ts);
    if (isNaN(date)) return ts;
    return date.toLocaleString();
  }

  function teamName(team){
    try {
      const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
      if (map && map[team]) return map[team];
    } catch (e) {}
    return team;
  }

  function buildCaption(range, team){
    const rangeText = rangeLabel(range);
    const teamText = team === 'all' ? window.t('caption.teamAll') : teamName(team);
    return `${window.t('caption.orgAverage')}${window.t('caption.separator')}${rangeText}${window.t('caption.separator')}${teamText}`;
  }

  function rangeLabel(range){
    if (!range) return window.t('range.7d');
    if (range.preset) {
      const map = {
        day: window.t('range.day'),
        '7d': window.t('range.7d'),
        month: window.t('range.month'),
        year: window.t('range.year')
      };
      return map[range.preset] || window.t('range.7d');
    }
    if (range.start && range.end) return `${range.start} → ${range.end}`;
    return window.t('range.7d');
  }
})();
