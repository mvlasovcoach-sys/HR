function initPage(){
    const cardsEl = document.getElementById('fleet-cards');
    if (!cardsEl) return;
    const tableEl = document.getElementById('fleet-table');
    const histogramEl = document.getElementById('devices-histogram');
    const captionEl = document.getElementById('devices-caption');
    const exportBtn = document.getElementById('export-fleet');
    const summaryPanel = document.getElementById('fleet-summary-panel');
    const tablePanel = document.getElementById('fleet-table-panel');

    exportBtn?.addEventListener('click', exportCsv);
    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === 'hr:range' || evt.key === 'hr:team' || evt.key === 'hr:scenario') {
        render();
      }
    });
    document.addEventListener('i18n:change', render);

    render();

    function t(key, vars){
      return window.I18N?.t(key, vars) || key.replace(/^label\.|^range\./, '');
    }

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
      const insufficient = Number(data?.n) > 0 && Number(data.n) < 5;
      toggleInsufficient(insufficient);
      if (exportBtn) {
        exportBtn.disabled = insufficient;
      }
      if (!data) {
        const emptyText = t('status.noData');
        cardsEl.innerHTML = `<p role="status">${emptyText}</p>`;
        tableEl.innerHTML = '';
        histogramEl.innerHTML = '';
        if (captionEl) captionEl.textContent = '';
        if (exportBtn) exportBtn.disabled = true;
        return;
      }
      renderCards(data, team);
      const hasRows = renderTable(data, team);
      renderHistogram(data);
      if (captionEl) captionEl.textContent = buildCaption(range, team);
      if (exportBtn) {
        exportBtn.setAttribute('aria-label', `${t('label.export.csv')} (${preset})`);
        exportBtn.disabled = insufficient || !hasRows;
      }
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
            <span class="tile__title">${t(card.label)}</span>
            <span class="status-chip ${tone.className}">${tone.label}</span>
          </header>
          <div class="tile__kpi">${value}<span>${card.unit}</span></div>
          <footer class="tile__foot">
            <span>${t('status.value')}</span>
            <span>${value}${card.unit}</span>
          </footer>
        </article>`;
      }).join('');
    }

    function renderTable(data, team){
      const rows = Array.isArray(data.teams) ? data.teams : [];
      const filtered = team !== 'all' ? rows.filter(row => row.team === team) : rows;
      if (!filtered.length) {
        const emptyText = t('devices.empty');
        tableEl.innerHTML = `<p role="status">${emptyText}</p>`;
        return false;
      }
      const headers = [
        {key: 'team', label: t('devices.table.team')},
        {key: 'devices', label: t('devices.table.devices')},
        {key: 'online_pct', label: t('devices.table.online')},
        {key: 'avg_battery', label: t('devices.table.battery')},
        {key: 'last_sync', label: t('devices.table.sync')},
        {key: 'status', label: t('devices.table.status')}
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
      return true;
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
      const teamSlug = team === 'all' ? 'all' : team;
      const stamp = formatFileDate(new Date());
      link.download = `fleet_${teamSlug}_${preset}_${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    function toggleInsufficient(active){
      [summaryPanel, tablePanel].forEach(panel => {
        if (!panel) return;
        if (active) {
          panel.setAttribute('data-insufficient', 'true');
        } else {
          panel.removeAttribute('data-insufficient');
        }
      });
    }

    function toneForValue(value){
      if (value >= 60) return {className: 'status-chip--green', label: t('devices.status.good')};
      if (value >= 30) return {className: 'status-chip--amber', label: t('devices.status.caution')};
      return {className: 'status-chip--red', label: t('devices.status.poor')};
    }

    function statusClass(status, value){
      if (status === 'green') return {className: 'status-chip--green', label: t('devices.status.good')};
      if (status === 'amber') return {className: 'status-chip--amber', label: t('devices.status.caution')};
      if (status === 'red') return {className: 'status-chip--red', label: t('devices.status.poor')};
      return toneForValue(value);
    }

    function formatSync(ts){
      if (!ts) return '—';
      const date = new Date(ts);
      if (isNaN(date)) return ts;
      const lang = window.I18N?.getLang?.() || 'en';
      const datePart = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'}).format(date);
      const timePart = new Intl.DateTimeFormat(lang, {hour: '2-digit', minute: '2-digit'}).format(date);
      return `${datePart} · ${timePart}`;
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
      const teamText = teamLabel(team);
      return `${scenarioPrefix()}${t('caption.orgAverage')} · ${rangeText} · ${teamText}`;
    }

    function rangeLabel(range){
      if (!range) return t('range.7d');
      if (range.preset) {
        const map = {
          day: t('range.day'),
          '7d': t('range.7d'),
          month: t('range.month'),
          year: t('range.year')
        };
        return map[range.preset] || t('range.7d');
      }
      if (range.start && range.end) {
        return `${range.start} → ${range.end}`;
      }
      return t('range.7d');
    }

    function teamLabel(team){
      if (!team || team === 'all') return t('caption.teamAll');
      try {
        const map = JSON.parse(localStorage.getItem('hr:team:names') || 'null');
        if (map && map[team]) return map[team];
      } catch (e) {}
      return team;
    }

    function formatFileDate(date){
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '0000-00-00';
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function readScenario(){
      try {
        return localStorage.getItem('hr:scenario') || 'live';
      } catch (err) {
        return 'live';
      }
    }

    function scenarioPrefix(){
      return readScenario() === 'night' ? t('caption.scenarioPrefix') : '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
  window.I18N.onReady(initPage);
});
