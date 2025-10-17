function initPage(){
    const cardsEl = document.getElementById('fleet-cards');
    if (!cardsEl) return;
    const tableEl = document.getElementById('fleet-table');
    const histogramEl = document.getElementById('devices-histogram');
    const captionEl = document.getElementById('devices-caption');
    const exportBtn = document.getElementById('export-fleet');
    const summaryPanel = document.getElementById('fleet-summary-panel');
    const tablePanel = document.getElementById('fleet-table-panel');

    const sortState = {key: 'team', dir: 'asc'};
    let lastData = null;
    let lastTeam = 'all';

    exportBtn?.addEventListener('click', exportCsv);
    tableEl?.addEventListener('click', handleTableSort);
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
      lastData = data;
      lastTeam = team;
      renderCards(data, team);
      const hasRows = renderTable(data, team);
      renderHistogram(data);
      if (captionEl) captionEl.textContent = buildCaption(range, team);
      if (exportBtn) {
        const exportLabel = t('ui.exportCSV') || t('label.export.csv');
        exportBtn.setAttribute('aria-label', `${exportLabel} (${preset})`);
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
      const summary = data.summary || {};
      const source = team !== 'all' ? data.teams?.find(entry => entry.team === team) || {} : summary;
      const cards = [
        {key: 'devices_online_pct', label: 'kpi.devicesOnline', value: valueOrFallback(source.devices_online_pct ?? source.online_pct, summary.devices_online_pct ?? summary.online_pct), unit: '%'},
        {key: 'avg_battery_pct', label: 'kpi.avgBattery', value: valueOrFallback(source.avg_battery_pct ?? source.avg_battery, summary.avg_battery_pct ?? summary.avg_battery), unit: '%'},
        {key: 'sync_fresh_pct', label: 'kpi.syncFresh', value: valueOrFallback(source.sync_fresh_pct ?? source.sync_fresh, summary.sync_fresh_pct ?? summary.sync_fresh), unit: '%'}
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
      if (!tableEl) return false;
      const insufficient = Number(data?.n) > 0 && Number(data.n) < 5;
      if (insufficient) {
        tableEl.innerHTML = '';
        if (window.guardSmallN) {
          window.guardSmallN(0, tableEl, t('guard.insufficient'));
        }
        return false;
      }
      if (window.guardSmallN) {
        window.guardSmallN(5, tableEl);
      }
      const rows = Array.isArray(data?.teams) ? data.teams : [];
      const filtered = team !== 'all' ? rows.filter(row => row.team === team) : rows.slice();
      if (!filtered.length) {
        const emptyText = t('devices.empty');
        tableEl.innerHTML = `<p role="status">${emptyText}</p>`;
        return false;
      }

      const lang = window.I18N?.getLang?.() || 'en';
      const columns = getTableColumns();
      const active = columns.find(col => col.key === sortState.key) || columns[0];
      const direction = sortState.dir === 'asc' ? 1 : -1;

      const sortedRows = filtered
        .map((row, index) => ({row, index}))
        .sort((a, b) => {
          const primary = compareValues(active.accessor(a.row), active.accessor(b.row), active.type, lang);
          if (primary !== 0) return primary * direction;
          const fallbackCol = columns[0];
          const secondary = compareValues(fallbackCol.accessor(a.row), fallbackCol.accessor(b.row), fallbackCol.type, lang);
          if (secondary !== 0) return secondary * direction;
          return a.index - b.index;
        })
        .map(entry => entry.row);

      const headerHtml = columns.map((col, index) => {
        const isActive = sortState.key === col.key;
        const dir = isActive ? sortState.dir : 'none';
        const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
        const icon = !isActive ? '⇅' : dir === 'asc' ? '▲' : '▼';
        return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="table-sort${isActive ? ' is-active' : ''}" data-sort-key="${col.key}" data-sort-type="${col.type}" data-default-dir="${col.defaultDir || 'asc'}" data-sort-dir="${dir}" data-sort-index="${index}">${col.label}<span class="table-sort__icon" aria-hidden="true">${icon}</span></button></th>`;
      }).join('');

      const bodyRows = sortedRows.map(row => {
        const teamLabel = teamName(row.team);
        const devicesCount = Number(row.devices || 0);
        const onlineValue = Number(row.online_pct ?? row.devices_online_pct ?? 0);
        const batteryValue = Number(row.avg_battery ?? row.avg_battery_pct ?? 0);
        const syncValue = Date.parse(row.last_sync || '');
        const syncLabel = formatSync(row.last_sync);
        const statusInfo = toneForValue(onlineValue);
        const onlineSort = Number.isFinite(onlineValue) ? onlineValue : Number.NEGATIVE_INFINITY;
        const batterySort = Number.isFinite(batteryValue) ? batteryValue : Number.NEGATIVE_INFINITY;
        const syncSort = Number.isFinite(syncValue) ? syncValue : Number.NEGATIVE_INFINITY;
        const statusLabel = statusInfo.label;
        return `<tr>
          <td data-sort-type="text" data-sort-value="${escapeAttr(teamLabel)}">${escapeHtml(teamLabel)}</td>
          <td data-sort-type="number" data-sort-value="${devicesCount}">${devicesCount}</td>
          <td data-sort-type="number" data-sort-value="${onlineSort}">${Math.round(onlineValue)}%</td>
          <td data-sort-type="number" data-sort-value="${batterySort}">${Math.round(batteryValue)}%</td>
          <td data-sort-type="number" data-sort-value="${syncSort}">${escapeHtml(syncLabel)}</td>
          <td data-sort-type="text" data-sort-value="${escapeAttr(statusLabel)}"><span class="status-chip ${statusInfo.className}">${escapeHtml(statusLabel)}</span></td>
        </tr>`;
      }).join('');

      tableEl.innerHTML = `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyRows}</tbody></table>`;
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
      const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => {
        const btn = th.querySelector('button');
        if (btn) {
          const textNode = Array.from(btn.childNodes || []).find(node => node.nodeType === Node.TEXT_NODE);
          if (textNode) {
            return textNode.textContent.trim();
          }
          return btn.textContent.trim();
        }
        return th.textContent.trim();
      });
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

    function handleTableSort(evt){
      const trigger = evt.target.closest('[data-sort-key]');
      if (!trigger) return;
      evt.preventDefault();
      const key = trigger.getAttribute('data-sort-key');
      if (!key) return;
      const columns = getTableColumns();
      const column = columns.find(col => col.key === key) || null;
      const defaultDir = trigger.getAttribute('data-default-dir') || column?.defaultDir || 'asc';
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = defaultDir;
      }
      if (lastData) {
        renderTable(lastData, lastTeam);
      }
    }

    function getTableColumns(){
      return [
        {key: 'team', label: t('devices.table.team'), type: 'text', defaultDir: 'asc', accessor: row => teamName(row.team)},
        {key: 'devices', label: t('devices.table.devices'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.devices || 0)},
        {key: 'online_pct', label: t('devices.table.online'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.online_pct ?? row.devices_online_pct ?? 0)},
        {key: 'avg_battery', label: t('devices.table.battery'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.avg_battery ?? row.avg_battery_pct ?? 0)},
        {key: 'last_sync', label: t('devices.table.sync'), type: 'number', defaultDir: 'desc', accessor: row => Date.parse(row.last_sync || '')},
        {key: 'status', label: t('devices.table.status'), type: 'text', defaultDir: 'asc', accessor: row => toneForValue(Number(row.online_pct ?? row.devices_online_pct ?? 0)).label}
      ];
    }

    function toggleInsufficient(active){
      [summaryPanel, tablePanel].forEach(panel => {
        if (!panel) return;
        if (active) {
          panel.setAttribute('data-insufficient', 'true');
          panel.setAttribute('data-guard-message', t('guard.insufficient'));
        } else {
          panel.removeAttribute('data-insufficient');
          panel.removeAttribute('data-guard-message');
        }
      });
    }

    function compareValues(a, b, type, lang){
      if (type === 'number') {
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
      try {
        return textA.localeCompare(textB, lang || undefined, {sensitivity: 'base'});
      } catch (err) {
        if (textA === textB) return 0;
        return textA < textB ? -1 : 1;
      }
    }

    function escapeHtml(value){
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function escapeAttr(value){
      return escapeHtml(value).replace(/"/g, '&quot;');
    }

    function valueOrFallback(primary, fallback){
      if (primary == null || Number.isNaN(primary)) {
        return fallback ?? 0;
      }
      return primary;
    }

    function toneForValue(value){
      if (value >= 60) return {className: 'status-chip--green', label: t('devices.status.good')};
      if (value >= 30) return {className: 'status-chip--amber', label: t('devices.status.caution')};
      return {className: 'status-chip--red', label: t('devices.status.poor')};
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
      const prefix = t('caption.orgAvg') || t('caption.orgAverage');
      return `${scenarioPrefix()}${prefix} · ${rangeText} · ${teamText}`;
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
