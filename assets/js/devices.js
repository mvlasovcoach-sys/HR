(function(){
  const STORAGE_KEYS = {
    range: 'hr:range',
    team: 'hr:team',
    scenario: 'hr:scenario'
  };

  const STATUS_THRESHOLDS = {
    good: {online: 60, sync: 80},
    warn: {online: 40, sync: 60}
  };

  const METRIC_THRESHOLDS = {
    devices_online_pct: {good: 60, warn: 40},
    avg_battery_pct: {good: 60, warn: 40},
    last_sync_24h_pct: {good: 80, warn: 60}
  };

  let sortState = {key: 'team', dir: 'asc'};
  let renderToken = 0;
  let lastData = null;
  let lastTeam = 'all';
  let siteState = null;
  const integrityState = {coverage: false, aggregate: false};
  let toastTimer = null;

  const getLang = () => window.I18N?.getLang?.() || 'en';

  function canonicalPreset(value){
    const key = String(value || '').toLowerCase();
    if (key === 'today' || key === 'day') return '7d';
    if (key === 'mtd' || key === 'month') return 'month';
    if (key === 'qtd' || key === 'quarter') return 'month';
    if (key === 'ytd' || key === 'year') return 'year';
    if (key === '7d') return '7d';
    return '7d';
  }

  function displayPreset(value){
    const key = String(value || '').toLowerCase();
    if (key === 'today' || key === 'day') return 'today';
    if (key === 'mtd' || key === 'month') return 'mtd';
    if (key === 'qtd' || key === 'quarter') return 'qtd';
    if (key === 'ytd' || key === 'year') return 'ytd';
    if (key === '7d') return '7d';
    return '7d';
  }

  function formatInteger(value){
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat(getLang(), {maximumFractionDigits: 0}).format(num);
  }

  function formatPercent(value, fractionDigits = 0){
    const num = Number(value);
    if (!Number.isFinite(num)) return '–';
    const ratio = num / 100;
    return new Intl.NumberFormat(getLang(), {style: 'percent', maximumFractionDigits: fractionDigits}).format(ratio);
  }

  function formatLocaleDate(value){
    const date = value instanceof Date ? value : new Date(value);
    if (!(date instanceof Date) || Number.isNaN(date)) return value;
    const lang = getLang();
    try {
      return new Intl.DateTimeFormat(lang, {day: 'numeric', month: 'short', year: 'numeric'}).format(date);
    } catch (err) {
      return date.toLocaleDateString();
    }
  }

  function boot(){
    const ready = [];
    ready.push(waitForI18n());
    ready.push(waitForSite());
    ready.push(waitForDom());
    Promise.all(ready).then(initPage).catch(err => {
      console.error('devices: init failed', err);
    });
  }

  function waitForDom(){
    return new Promise(resolve => {
      if (document.readyState !== 'loading') {
        resolve();
      } else {
        document.addEventListener('DOMContentLoaded', resolve, {once: true});
      }
    });
  }

  function waitForI18n(){
    return new Promise(resolve => {
      if (window.I18N?.onReady) {
        window.I18N.onReady(resolve);
      } else {
        resolve();
      }
    });
  }

  function waitForSite(){
    return new Promise(resolve => {
      if (window.SITE?.ready) {
        resolve(window.SITE);
        return;
      }
      const handler = event => {
        window.removeEventListener('site:ready', handler);
        resolve(event?.detail?.site || window.SITE || null);
      };
      window.addEventListener('site:ready', handler, {once: true});
    });
  }

  function initPage(){
    siteState = window.SITE || null;

    const cardsEl = document.getElementById('fleet-cards');
    if (!cardsEl) return;
    const tableEl = document.getElementById('fleet-table');
    const histogramEl = document.getElementById('devices-histogram');
    const captionEl = document.getElementById('global-caption');
    const exportBtn = document.getElementById('export-fleet');
    const summaryPanel = document.getElementById('fleet-summary-panel');
    const tablePanel = document.getElementById('fleet-table-panel');
    const coverageEl = document.getElementById('devices-coverage');
    const toastEl = document.getElementById('devices-toast');

    cardsEl.classList.add('devices-kpis');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (exportBtn.disabled || exportBtn.getAttribute('aria-disabled') === 'true') return;
        window.exporter?.notifyStart?.(exportBtn);
        exportCsv(tableEl);
      });
    }
    tableEl?.addEventListener('click', evt => handleTableSort(evt, tableEl));

    window.addEventListener('storage', evt => {
      if (!evt) return;
      if (evt.key === STORAGE_KEYS.range || evt.key === STORAGE_KEYS.team || evt.key === STORAGE_KEYS.scenario) {
        render();
      }
    });

    document.addEventListener('i18n:change', () => render());
    window.addEventListener('site:ready', event => {
      siteState = event?.detail?.site || window.SITE || siteState;
      render();
    });

    render();

    async function render(){
      const token = ++renderToken;
      const range = readRange();
      const team = readTeam();
      const preset = presetForRange(range);
      lastTeam = team;
      let data = null;
      try {
        data = await loadFleet(preset, range, team);
      } catch (err) {
        console.error('devices: data load failed', err);
      }
      if (token !== renderToken) return;

      if (!data) {
        renderEmpty();
        return;
      }

      lastData = data;
      siteState = window.SITE || siteState || null;
      const allRows = buildRows(siteState, data.by_team || []);
      const rows = team === 'all' ? allRows : allRows.filter(row => row.id === team);
      const insufficient = Number(data?.n) > 0 && Number(data.n) < 5;
      toggleInsufficient(insufficient, summaryPanel, tablePanel, t('guard.insufficient'));
      if (exportBtn) {
        const baseLabel = exportBtn.getAttribute('data-export-label') || t('ui.exportCSV') || t('label.export.csv');
        exportBtn.setAttribute('aria-label', `${baseLabel} (${preset})`);
        exportBtn.setAttribute('title', `${baseLabel} (${preset})`);
        exportBtn.disabled = insufficient || !rows.length;
        if (!rows.length || insufficient) {
          exportBtn.setAttribute('aria-disabled', 'true');
        } else {
          exportBtn.removeAttribute('aria-disabled');
        }
      }
      runIntegrityChecks(data, allRows, siteState, toastEl);

      if (insufficient || !rows.length) {
        renderCards(cardsEl, null, team, data, t);
        renderTable(tableEl, rows, siteState, t, false);
        renderHistogram(histogramEl, data, t);
        updateCoverageBadge(coverageEl, siteState, allRows, t);
        const insight = rows.length ? buildCaption(range, team, t) : '';
        if (captionEl && window.Caption?.render) {
          window.Caption?.render(captionEl, {asOf: new Date(), insight});
        } else if (captionEl) {
          captionEl.textContent = insight;
        }
        return;
      }

      renderCards(cardsEl, {rows, allRows, data, team}, team, data, t);
      renderTable(tableEl, rows, siteState, t, true);
      renderHistogram(histogramEl, data, t);
      updateCoverageBadge(coverageEl, siteState, allRows, t);
      const insight = buildCaption(range, team, t);
      if (captionEl && window.Caption?.render) {
        window.Caption?.render(captionEl, {asOf: new Date(), insight});
      } else if (captionEl) {
        captionEl.textContent = insight;
      }
    }

    function renderEmpty(){
      const emptyText = t('status.noData');
      cardsEl.innerHTML = `<p role="status">${emptyText}</p>`;
      tableEl.innerHTML = '';
      histogramEl.innerHTML = '';
      if (captionEl && window.Caption?.render) {
        window.Caption?.render(captionEl, {asOf: new Date(), insight: ''});
      } else if (captionEl) {
        captionEl.textContent = '';
      }
      if (coverageEl) {
        coverageEl.textContent = '';
        coverageEl.hidden = true;
      }
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.setAttribute('aria-disabled', 'true');
      }
    }
  }

  function t(key, vars){
    return window.I18N?.t(key, vars) || key.replace(/^label\.|^range\./, '');
  }

  function readRange(){
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.range);
      if (!raw) return {preset: '7d'};
      const parsed = JSON.parse(raw);
      if (parsed && parsed.preset) return parsed;
      if (parsed && parsed.start && parsed.end) return parsed;
    } catch (e) {}
    return {preset: '7d'};
  }

  function readTeam(){
    try {
      return localStorage.getItem(STORAGE_KEYS.team) || 'all';
    } catch (e) {
      return 'all';
    }
  }

  function presetForRange(range){
    if (!range) return '7d';
    if (range.preset) {
      return canonicalPreset(range.preset);
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

  async function loadFleet(preset, range, team){
    const path = `./data/org/fleet_${preset}.json`;
    return await window.dataLoader.fetch(path, {range, team});
  }

  function buildRows(site, rawRows){
    const siteMap = site?.map || {};
    const visible = Array.isArray(site?.visibleRows) ? site.visibleRows.slice() : [];
    const dataMap = new Map();
    rawRows.forEach(entry => {
      if (!entry) return;
      const id = String(entry.id || entry.team || '').trim();
      if (!id) return;
      dataMap.set(id, entry);
      if (!visible.includes(id)) {
        visible.push(id);
      }
    });

    return visible.map(id => {
      const siteEntry = siteMap[id] || {label: id, headcount: 0};
      const dataEntry = dataMap.get(id) || {};
      const headcount = Number(siteEntry.headcount);
      const issued = Number(dataEntry.devices_issued ?? dataEntry.devices ?? headcount);
      const online = Number(dataEntry.devices_online_pct ?? dataEntry.online_pct);
      const battery = Number(dataEntry.avg_battery_pct ?? dataEntry.avg_battery);
      const sync = Number(dataEntry.last_sync_24h_pct ?? dataEntry.sync_fresh_pct);
      const lastSync = dataEntry.last_sync || dataEntry.last_sync_time || null;
      return {
        id,
        label: siteEntry.label || id,
        headcount: Number.isFinite(headcount) ? headcount : 0,
        issued: Number.isFinite(issued) ? issued : (Number.isFinite(headcount) ? headcount : 0),
        onlinePct: Number.isFinite(online) ? online : 0,
        batteryPct: Number.isFinite(battery) ? battery : 0,
        syncPct: Number.isFinite(sync) ? sync : 0,
        lastSync,
        raw: dataEntry
      };
    });
  }

  function renderCards(container, context, team, data, translate){
    const rows = context?.rows || [];
    const allRows = context?.allRows || rows;
    const hasOrg = data?.org && typeof data.org === 'object';
    const aggregates = team !== 'all'
      ? {
          devices_online_pct: rows[0]?.onlinePct ?? 0,
          avg_battery_pct: rows[0]?.batteryPct ?? 0,
          last_sync_24h_pct: rows[0]?.syncPct ?? 0
        }
      : hasOrg
        ? {
            devices_online_pct: Number(data.org.devices_online_pct),
            avg_battery_pct: Number(data.org.avg_battery_pct),
            last_sync_24h_pct: Number(data.org.last_sync_24h_pct)
          }
        : weightedAggregate(allRows);

    const cards = [
      {key: 'devices_online_pct', label: 'kpi.devicesOnline', value: aggregates.devices_online_pct},
      {key: 'avg_battery_pct', label: 'kpi.avgBattery', value: aggregates.avg_battery_pct},
      {key: 'last_sync_24h_pct', label: 'kpi.syncFresh', value: aggregates.last_sync_24h_pct}
    ];

    container.innerHTML = cards.map(card => {
      const numeric = Number(card.value);
      const status = metricStatus(card.key, numeric, translate);
      const valueText = Number.isFinite(numeric) ? formatPercent(numeric) : '–';
      return `<article class="tile tile--compact">
        <header class="tile__head">
          <span class="tile__title">${translate(card.label)}</span>
          <span class="status-chip ${status.className}">${status.label}</span>
        </header>
        <div class="tile__kpi">${valueText}</div>
      </article>`;
    }).join('');
  }

  function metricStatus(key, value, translate){
    const thresholds = METRIC_THRESHOLDS[key] || {good: 60, warn: 40};
    if (Number(value) >= thresholds.good) {
      return {className: 'status-chip--green', label: translate('devices.status.good')};
    }
    if (Number(value) >= thresholds.warn) {
      return {className: 'status-chip--amber', label: translate('devices.status.warn')};
    }
    return {className: 'status-chip--red', label: translate('devices.status.crit')};
  }

  function weightedAggregate(rows){
    const totals = rows.reduce((acc, row) => {
      const issued = Number(row?.issued) || 0;
      acc.issued += issued;
      acc.online += (Number(row?.onlinePct) || 0) * issued;
      acc.battery += (Number(row?.batteryPct) || 0) * issued;
      acc.sync += (Number(row?.syncPct) || 0) * issued;
      return acc;
    }, {issued: 0, online: 0, battery: 0, sync: 0});
    if (totals.issued <= 0) {
      return {
        devices_online_pct: 0,
        avg_battery_pct: 0,
        last_sync_24h_pct: 0
      };
    }
    return {
      devices_online_pct: totals.online / totals.issued,
      avg_battery_pct: totals.battery / totals.issued,
      last_sync_24h_pct: totals.sync / totals.issued
    };
  }

  function renderTable(container, rows, site, translate, hasRows){
    if (!container) return;
    if (!hasRows || !rows.length) {
      container.innerHTML = `<p role="status">${translate('devices.empty')}</p>`;
      return;
    }

    const lang = getLang();
    const columns = getTableColumns(translate);
    const active = columns.find(col => col.key === sortState.key) || columns[0];
    const direction = sortState.dir === 'asc' ? 1 : -1;
    const orderMap = new Map((site?.visibleRows || []).map((id, index) => [id, index]));

    const sortedRows = rows
      .map((row, index) => ({row, index}))
      .sort((a, b) => {
        if (active.key === 'team' && orderMap.size) {
          const orderA = orderMap.has(a.row.id) ? orderMap.get(a.row.id) : Number.MAX_SAFE_INTEGER;
          const orderB = orderMap.has(b.row.id) ? orderMap.get(b.row.id) : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) {
            return (orderA - orderB) * direction;
          }
        }
        const primary = compareValues(active.accessor(a.row), active.accessor(b.row), active.type, lang, site);
        if (primary !== 0) return primary * direction;
        const fallbackCol = columns[0];
        const secondary = compareValues(fallbackCol.accessor(a.row), fallbackCol.accessor(b.row), fallbackCol.type, lang, site);
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
      const status = resolveStatus(row.onlinePct, row.syncPct, translate);
      const lastSyncLabel = formatSync(row.lastSync);
      const headcount = Number.isFinite(Number(row.headcount)) ? Number(row.headcount) : 0;
      const issued = Number.isFinite(Number(row.issued)) ? Number(row.issued) : headcount;
      const onlineValue = Number.isFinite(Number(row.onlinePct)) ? Number(row.onlinePct) : null;
      const batteryValue = Number.isFinite(Number(row.batteryPct)) ? Number(row.batteryPct) : null;
      const syncValue = Number.isFinite(Number(row.syncPct)) ? Number(row.syncPct) : null;
      const syncPercent = syncValue !== null ? formatPercent(syncValue) : '–';
      const syncSort = syncValue !== null ? syncValue : Number.NEGATIVE_INFINITY;
      return `<tr>
        <td data-sort-type="text" data-sort-value="${escapeAttr(row.label)}">${escapeHtml(row.label)}</td>
        <td data-sort-type="number" data-sort-value="${issued}">${formatInteger(issued)}</td>
        <td data-sort-type="number" data-sort-value="${row.onlinePct}">${onlineValue !== null ? formatPercent(onlineValue) : '–'}</td>
        <td data-sort-type="number" data-sort-value="${row.batteryPct}">${batteryValue !== null ? formatPercent(batteryValue) : '–'}</td>
        <td data-sort-type="number" data-sort-value="${syncSort}">
          <div class="devices-table__primary">${syncPercent}</div>
          ${lastSyncLabel ? `<div class="devices-table__meta">${escapeHtml(lastSyncLabel)}</div>` : ''}
        </td>
        <td data-sort-type="text" data-sort-value="${escapeAttr(status.label)}"><span class="status-chip ${status.className}">${escapeHtml(status.label)}</span></td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  function getTableColumns(translate){
    return [
      {key: 'team', label: translate('devices.columns.team'), type: 'text', defaultDir: 'asc', accessor: row => row.label},
      {key: 'devices', label: translate('devices.columns.devices'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.issued)},
      {key: 'online_pct', label: translate('devices.columns.online'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.onlinePct)},
      {key: 'avg_battery_pct', label: translate('devices.columns.battery'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.batteryPct)},
      {key: 'last_sync', label: translate('devices.columns.lastsync'), type: 'number', defaultDir: 'desc', accessor: row => Number(row.syncPct)},
      {key: 'status', label: translate('devices.columns.status'), type: 'text', defaultDir: 'asc', accessor: row => resolveStatus(row.onlinePct, row.syncPct, translate).label}
    ];
  }

  function handleTableSort(evt, container){
    const trigger = evt.target.closest('[data-sort-key]');
    if (!trigger) return;
    evt.preventDefault();
    const key = trigger.getAttribute('data-sort-key');
    if (!key) return;
    const defaultDir = trigger.getAttribute('data-default-dir') || 'asc';
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = {key, dir: defaultDir};
    }
    if (lastData) {
      const site = window.SITE || siteState;
      const allRows = buildRows(site, lastData.by_team || []);
      const rows = lastTeam === 'all' ? allRows : allRows.filter(row => row.id === lastTeam);
      renderTable(container, rows, site, t, rows.length > 0);
    }
  }

  function renderHistogram(container, data, translate){
    if (!container) return;
    const distribution = data?.battery_distribution;
    if (!distribution || typeof distribution !== 'object') {
      container.innerHTML = '';
      return;
    }
    const entries = Object.entries(distribution).sort((a, b) => bucketOrder(a[0]) - bucketOrder(b[0]));
    container.innerHTML = entries.map(([bucket, value]) => {
      const amount = Number(value || 0);
      const width = Math.min(100, Math.round(amount * 2));
      return `<div class="devices-histogram__bar">
        <span>${escapeHtml(bucket)}</span>
        <div class="devices-histogram__track"><div class="devices-histogram__fill" style="width:${width}%"></div></div>
        <span class="devices-histogram__value">${formatInteger(amount)}</span>
      </div>`;
    }).join('');
  }

  function bucketOrder(label){
    const match = /^([0-9]+)/.exec(label);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  function updateCoverageBadge(el, site, rows, translate){
    if (!el) return;
    const totalIssued = rows.reduce((sum, row) => sum + (Number(row.issued) || 0), 0);
    const expected = Number(site?.totals?.headcount) || 0;
    if (!expected) {
      el.textContent = '';
      el.hidden = true;
      return;
    }
    const coveragePct = expected ? Math.round((totalIssued / expected) * 100) : 0;
    const orgName = site?.raw?.site || site?.name || '';
    const orgToken = translate('devices.coverage.orgLabel');
    const orgLabel = translate('devices.coverage.org', {label: orgToken, site: orgName || orgToken});
    const staffLabel = translate('devices.coverage.staff', {count: formatInteger(expected)});
    const equippedLabel = translate('devices.coverage.equipped', {value: formatPercent(coveragePct)});
    const issuedLabel = translate('devices.coverage.issued', {count: formatInteger(totalIssued)});
    el.textContent = translate('devices.coverage.summary', {org: orgLabel, staff: staffLabel, equipped: equippedLabel, issued: issuedLabel});
    el.hidden = false;
  }

  function resolveStatus(online, sync, translate){
    const onlineValue = Number(online) || 0;
    const syncValue = Number(sync) || 0;
    if (onlineValue >= STATUS_THRESHOLDS.good.online && syncValue >= STATUS_THRESHOLDS.good.sync) {
      return {className: 'status-chip--green', label: translate('devices.status.good')};
    }
    if (onlineValue >= STATUS_THRESHOLDS.warn.online || syncValue >= STATUS_THRESHOLDS.warn.sync) {
      return {className: 'status-chip--amber', label: translate('devices.status.warn')};
    }
    return {className: 'status-chip--red', label: translate('devices.status.crit')};
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

  function formatSync(ts){
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date)) return '';
    const lang = getLang();
    const datePart = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'}).format(date);
    const timePart = new Intl.DateTimeFormat(lang, {hour: '2-digit', minute: '2-digit'}).format(date);
    return `${datePart} · ${timePart}`;
  }

  function buildCaption(range, team, translate){
    const rangeText = rangeLabel(range, translate);
    const teamText = teamLabel(team, translate);
    const prefix = translate('caption.orgAvg') || translate('caption.orgAverage') || 'Org average';
    return `${scenarioPrefix(translate)}${prefix} · ${rangeText} · ${teamText}`;
  }

  function rangeLabel(range, translate){
    if (!range) return translate('range.7d');
    if (range.preset) {
      const presetKey = displayPreset(range.preset);
      const map = {
        today: translate('range.today') || 'Today',
        '7d': translate('range.7d') || '7 Days',
        mtd: translate('range.mtd') || 'Month to date',
        qtd: translate('range.qtd') || 'Quarter to date',
        ytd: translate('range.ytd') || 'Year to date'
      };
      return map[presetKey] || translate('range.7d');
    }
    if (range.start && range.end) {
      const start = formatLocaleDate(range.start);
      const end = formatLocaleDate(range.end);
      if (start && start === end) return start;
      return `${start} – ${end}`;
    }
    return translate('range.7d');
  }

  function teamLabel(team, translate){
    if (!team || team === 'all') return translate('caption.teamAll') || 'All teams';
    const site = window.SITE || siteState;
    const label = site?.map?.[team]?.label;
    if (label) return label;
    return team;
  }

  function scenarioPrefix(translate){
    return readScenario() === 'night' ? (translate('caption.scenarioPrefix') || 'Night scenario · ') : '';
  }

  function readScenario(){
    try {
      return localStorage.getItem(STORAGE_KEYS.scenario) || 'live';
    } catch (err) {
      return 'live';
    }
  }

  function toggleInsufficient(active, summaryPanel, tablePanel, message){
    [summaryPanel, tablePanel].forEach(panel => {
      if (!panel) return;
      if (active) {
        panel.setAttribute('data-insufficient', 'true');
        panel.setAttribute('data-guard-message', message);
      } else {
        panel.removeAttribute('data-insufficient');
        panel.removeAttribute('data-guard-message');
      }
    });
  }

  function exportCsv(container){
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    if (!rows.length) return;
    const headers = Array.from(container.querySelectorAll('thead th')).map(th => {
      const btn = th.querySelector('button');
      if (btn) {
        const textNode = Array.from(btn.childNodes || []).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) return textNode.textContent.trim();
        return btn.textContent.trim();
      }
      return th.textContent.trim();
    });
    const dataRows = rows.map(row => Array.from(row.children).map(cell => cell.textContent.replace(/\s+/g, ' ').trim()));
    const csvRows = [headers, ...dataRows]
      .map(line => line.map(value => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvRows], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const team = readTeam();
    const preset = presetForRange(readRange());
    const stamp = formatFileDate(new Date());
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleet_${team}_${preset}_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function formatFileDate(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '0000-00-00';
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function runIntegrityChecks(data, rows, site, toastEl){
    if (!data) return;
    const expected = Number(site?.totals?.headcount) || 0;
    const totalIssued = rows.reduce((sum, row) => sum + (Number(row.issued) || 0), 0);
    let warningShown = false;

    if (expected > 0 && totalIssued !== expected) {
      if (!integrityState.coverage) {
        showToast(toastEl, 'Devices: issued count != headcount.');
      }
      integrityState.coverage = true;
      warningShown = true;
      console.warn('Devices integrity: issued mismatch', {expected, actual: totalIssued});
    } else {
      integrityState.coverage = false;
    }

    const org = data.org;
    if (org && typeof org === 'object') {
      const aggregate = weightedAggregate(rows);
      const diffOnline = Math.abs((Number(org.devices_online_pct) || 0) - (aggregate.devices_online_pct || 0));
      const diffBattery = Math.abs((Number(org.avg_battery_pct) || 0) - (aggregate.avg_battery_pct || 0));
      const diffSync = Math.abs((Number(org.last_sync_24h_pct) || 0) - (aggregate.last_sync_24h_pct || 0));
      const mismatch = diffOnline > 1 || diffBattery > 1 || diffSync > 1;
      if (mismatch) {
        if (!integrityState.aggregate) {
          showToast(toastEl, 'Devices: org aggregate mismatch.');
        }
        integrityState.aggregate = true;
        warningShown = true;
        console.warn('Devices integrity: aggregate mismatch', {
          expected: org,
          computed: aggregate,
          deltas: {online: diffOnline, battery: diffBattery, sync: diffSync}
        });
      } else {
        integrityState.aggregate = false;
      }
    } else {
      integrityState.aggregate = false;
    }

    if (!warningShown && !integrityState.coverage && !integrityState.aggregate) {
      hideToast(toastEl);
    }
  }

  function showToast(toastEl, message){
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hideToast(toastEl), 5000);
  }

  function hideToast(toastEl){
    if (!toastEl) return;
    toastEl.classList.remove('is-visible');
    toastEl.hidden = true;
  }

  if (typeof document !== 'undefined') {
    boot();
  }
})();
