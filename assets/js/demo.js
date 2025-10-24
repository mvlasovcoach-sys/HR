(function(){
  const heroEl = document.getElementById('demo-hero');
  if (!heroEl) return;

  const state = { data: null, version: null };
  const DEMO_CHARTS = {};
  const utils = window.DEMO_UTILS || {};
  const DEMO_SOURCE_ID = 'demo-synth-2025';
  const warnOnMismatch = typeof utils.warnMismatch === 'function' ? utils.warnMismatch : () => {};
  const computeBands = typeof utils.computeAgeBands === 'function'
    ? utils.computeAgeBands
    : (source, bands) => {
        if (!bands) return [];
        const entries = Array.isArray(bands) ? bands : [];
        return entries.map((band, index) => {
          const key = typeof band === 'string' ? band : (band?.key || String(index));
          const label = typeof band === 'string' ? band : (band?.label || key);
          const labelKey = typeof band === 'object' ? band?.labelKey : null;
          const value = source && typeof source === 'object' ? Number(source[key]) || 0 : 0;
          return { key, label, labelKey, count: value };
        });
      };
  const AGE_BANDS = [
    { key: '20-29', labelKey: 'demo.age.band1', label: '20–29', min: 20, max: 29 },
    { key: '30-39', labelKey: 'demo.age.band2', label: '30–39', min: 30, max: 39 },
    { key: '40-49', labelKey: 'demo.age.band3', label: '40–49', min: 40, max: 49 },
    { key: '50-59', labelKey: 'demo.age.band4', label: '50–59', min: 50, max: 59 },
    { key: '60+', labelKey: 'demo.age.band5', label: '60+', min: 60 }
  ];
  const els = {
    badge: document.getElementById('site-badge'),
    cards: {
      site: document.getElementById('card-site'),
      headcount: document.getElementById('card-headcount'),
      rotation: document.getElementById('card-rotation'),
      shifts: document.getElementById('card-shifts')
    },
    orgTable: document.getElementById('org-table'),
    genderOverall: document.getElementById('chart-gender-overall'),
    ageOverall: document.getElementById('chart-age-overall'),
    byDept: document.getElementById('chart-by-dept'),
    shiftGrid: document.getElementById('shift-grid'),
    toast: document.getElementById('demo-toast'),
    exportBtn: document.getElementById('btn-export-brief')
  };

  function mountChart(selector, drawFn, data, opts={}){
    const root = document.querySelector(selector);
    if (!root) return;
    root.replaceChildren();
    const prev = DEMO_CHARTS[selector];
    if (prev && typeof prev.destroy === 'function') {
      try {
        prev.destroy();
      } catch (err) {
        console.warn('demo: chart cleanup failed', err);
      }
    }
    DEMO_CHARTS[selector] = drawFn(root, data, opts) || null;
  }

  const HERO_SRC = './assets/img/demo-hero-offshore.svg';

  const getLang = () => window.I18N?.getLang?.() || 'en';

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

  init();

  function init(){
    applySkeletons();
    bindEvents();
    if (window.I18N?.onReady) {
      window.I18N.onReady(() => {
        if (state.data) render(state.data);
      });
    }
    window.addEventListener('i18n:change', () => {
      if (state.data) render(state.data);
    });
    loadData().catch(err => {
      console.error('demo: data load failed', err);
      showToast(getText('demo.error', 'Unable to load demo data'));
      heroEl.classList.remove('is-loading');
      heroEl.removeAttribute('aria-busy');
    });
  }

  function bindEvents(){
    if (els.exportBtn) {
      els.exportBtn.disabled = true;
      els.exportBtn.setAttribute('aria-disabled', 'true');
      const baseLabel = els.exportBtn.getAttribute('data-export-label') || getText('demo.exportBrief', 'Export Site Brief (PDF)');
      els.exportBtn.setAttribute('aria-label', baseLabel);
      els.exportBtn.setAttribute('title', baseLabel);
      els.exportBtn.addEventListener('click', handleExport);
    }
  }

  function handleExport(){
    if (!state.data) {
      showToast(getText('demo.loading', 'Loading demo data…'));
      return;
    }
    if (els.exportBtn?.disabled) return;
    const exporter = window.EXPORTER || window.exporter;
    if (!exporter || typeof exporter.exportSiteBriefPDF !== 'function') {
      showToast(getText('demo.exportUnavailable', 'Export not available.'));
      return;
    }
    window.exporter?.notifyStart?.(els.exportBtn, els.exportBtn?.dataset?.exportKey);
    exporter.exportSiteBriefPDF({
      badgeText: els.badge?.textContent?.trim?.() || '',
      version: state.version || ''
    }).catch(err => {
      console.error('demo: export failed', err);
      showToast(getText('demo.exportError', 'Unable to export PDF'));
    });
  }

  async function loadData(){
    const version = await resolveVersion();
    state.version = version;
    const response = await fetch(`./data/site/demo.json?v=${encodeURIComponent(version || '')}`, {cache: 'no-store'});
    if (!response.ok) throw new Error(`demo data fetch failed: ${response.status}`);
    const data = await response.json();
    state.data = data;
    render(data);
    if (els.exportBtn) {
      els.exportBtn.disabled = false;
      els.exportBtn.removeAttribute('aria-disabled');
      const baseLabel = els.exportBtn.getAttribute('data-export-label') || getText('demo.exportBrief', 'Export Site Brief (PDF)');
      els.exportBtn.setAttribute('aria-label', baseLabel);
      els.exportBtn.setAttribute('title', baseLabel);
    }
  }

  function applySkeletons(){
    heroEl.classList.add('is-loading');
    heroEl.setAttribute('aria-busy', 'true');
    Object.values(els.cards).forEach(card => {
      if (!card) return;
      card.classList.add('skeleton');
      card.setAttribute('aria-busy', 'true');
      card.innerHTML = [
        '<span class="skeleton skeleton--pill"></span>',
        '<span class="skeleton skeleton--value"></span>',
        '<span class="skeleton skeleton--text"></span>'
      ].join('');
    });
    [els.genderOverall, els.ageOverall, els.byDept].forEach(chart => {
      if (!chart) return;
      chart.classList.add('is-loading');
      chart.setAttribute('aria-busy', 'true');
      chart.innerHTML = '';
    });
    if (els.orgTable) {
      els.orgTable.setAttribute('aria-busy', 'true');
      els.orgTable.innerHTML = '<div class="skeleton skeleton--text" style="width:60%"></div>' +
        '<div class="skeleton skeleton--text" style="width:80%;margin-top:12px"></div>';
    }
    if (els.shiftGrid) {
      els.shiftGrid.setAttribute('aria-busy', 'true');
      els.shiftGrid.innerHTML = '<div class="skeleton skeleton--text" style="width:50%"></div>' +
        '<div class="skeleton skeleton--text" style="width:75%;margin-top:12px"></div>';
    }
    if (els.badge) {
      const badge = getText('demo.badge', 'Demo · {name} · {headcount} staff · 24/7', {
        name: 'Aurora Deepwater Platform',
        headcount: 0
      });
      els.badge.textContent = badge;
    }
  }

  function render(data){
    if (!data) return;
    const departments = Array.isArray(data.departments) ? data.departments : [];
    const headcount = departments.reduce((sum, dept) => sum + (Number(dept.headcount) || 0), 0);
    if (typeof window !== 'undefined') {
      window.DEMO_TOTAL = headcount;
    }
    renderBadge(data.site, headcount);
    renderHero(data.site);
    renderOverviewCards(data, headcount, departments);
    renderOrgTable(departments);
    renderGenderOverall(data.gender_overall, headcount);
    renderAgeOverall(data.age_overall, headcount);
    renderByDepartment(departments, data.byDeptBattery);
    renderShiftGrid(departments);
    updateSourceMeta(headcount);
  }

  function renderBadge(name, headcount){
    if (!els.badge) return;
    const text = getText('demo.badge', `Demo · ${name} · ${formatInteger(headcount)} staff · 24/7`, {name, headcount: formatInteger(headcount)});
    els.badge.textContent = text;
    els.badge.setAttribute('aria-label', text);
  }

  function renderHero(name){
    heroEl.classList.remove('is-fallback');
    heroEl.removeAttribute('data-fallback-label');
    heroEl.innerHTML = '';
    const img = new Image();
    img.alt = getText('demo.heroAlt', '{name} offshore platform illustration', {name});
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      heroEl.classList.remove('is-loading');
      heroEl.removeAttribute('aria-busy');
    });
    img.addEventListener('error', () => {
      heroEl.classList.remove('is-loading');
      heroEl.removeAttribute('aria-busy');
      if (heroEl.contains(img)) {
        heroEl.removeChild(img);
      }
      heroEl.classList.add('is-fallback');
      heroEl.setAttribute('data-fallback-label', name);
      heroEl.setAttribute('aria-label', name);
    });
    img.src = `${HERO_SRC}?v=${encodeURIComponent(state.version || '')}`;
    heroEl.appendChild(img);
    heroEl.setAttribute('role', 'img');
    heroEl.setAttribute('aria-label', getText('demo.heroLabel', '{name} hero image', {name}));
  }

  function renderOverviewCards(data, headcount, departments){
    const dayLabel = getText('demo.day', 'Day');
    const nightLabel = getText('demo.night', 'Night');
    const offLabel = getText('demo.off', 'Off');
    const opsGroups = departments.filter(d => (d.pattern || '').toLowerCase() === '2-2-2').map(d => d.name).join(' / ');
    const supportGroups = departments.filter(d => (d.pattern || '').toLowerCase() === 'day-only').map(d => d.name).join(' / ');
    const shiftMetaParts = [];
    if (opsGroups) {
      shiftMetaParts.push(getText('demo.shiftMetaOps', '{groups}: {pattern}', {
        groups: opsGroups,
        pattern: [dayLabel, dayLabel, nightLabel, nightLabel, offLabel, offLabel].join(', ')
      }));
    }
    if (supportGroups) {
      shiftMetaParts.push(getText('demo.shiftMetaSupport', '{groups}: {pattern}', {
        groups: supportGroups,
        pattern: Array(6).fill(dayLabel).join(', ')
      }));
    }

    renderCard(els.cards.site, {
      label: getText('demo.site', 'Site'),
      value: data.site,
      aria: `${getText('demo.site', 'Site')}: ${data.site}`
    }, {skipMetaWhenEmpty: true});

    const formattedHeadcount = formatInteger(headcount);
    renderCard(els.cards.headcount, {
      label: getText('demo.headcount', 'Headcount'),
      value: formattedHeadcount,
      meta: getText('demo.departmentCount', '{count} departments', {count: formatInteger(departments.length)}),
      aria: `${getText('demo.headcount', 'Headcount')}: ${formattedHeadcount}`
    });

    const rotationParts = String(data.rotation || '').split('/').map(part => part.trim());
    const rotationMeta = rotationParts.length === 2
      ? getText('demo.rotationDetail', '{on} days on / {off} days off', {on: rotationParts[0], off: rotationParts[1]})
      : '';
    renderCard(els.cards.rotation, {
      label: getText('demo.rotation', 'Rotation'),
      value: data.rotation,
      meta: rotationMeta,
      aria: `${getText('demo.rotation', 'Rotation')}: ${data.rotation}${rotationMeta ? `. ${rotationMeta}` : ''}`
    });

    const shiftHours = Number(data.shift_hours) || 0;
    const formattedHours = formatInteger(shiftHours);
    renderCard(els.cards.shifts, {
      label: getText('demo.shifts', 'Shifts'),
      value: `${formattedHours}h`,
      meta: shiftMetaParts.join(' · '),
      aria: `${getText('demo.shifts', 'Shifts')}: ${formattedHours}h. ${shiftMetaParts.join('. ')}`
    });
  }

  function renderCard(card, config, options={}){
    if (!card) return;
    const {label, value, meta='', aria} = config;
    const opts = Object.assign({skipMetaWhenEmpty: false}, options);
    card.classList.remove('skeleton');
    card.removeAttribute('aria-busy');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', aria || `${label}: ${value}`);
    const showMeta = meta && !(opts.skipMetaWhenEmpty && !meta);
    card.innerHTML = `
      <div class="demo-card__label">${escapeHtml(label)}</div>
      <div class="demo-card__value">${escapeHtml(String(value))}</div>
      ${showMeta ? `<div class="demo-card__meta">${escapeHtml(String(meta))}</div>` : ''}
      <span class="sr-only">${aria || `${label}: ${value}`}${showMeta ? `. ${stripTags(String(meta))}` : ''}</span>
    `;
  }

  function renderOrgTable(departments){
    if (!els.orgTable) return;
    const rows = departments.map(dept => {
      const name = escapeHtml(dept.name);
      const head = Number(dept.headcount) || 0;
      const brigadesRaw = Number(dept.brigades);
      const headLabel = formatInteger(head);
      const brigades = Number.isFinite(brigadesRaw) ? escapeHtml(formatInteger(brigadesRaw)) : '—';
      const pattern = escapeHtml(String(dept.pattern || '').replace(/-/g, '–'));
      return `
        <tr>
          <th scope="row">${name}</th>
          <td data-sort-value="${head}">${headLabel}</td>
          <td>${brigades}</td>
          <td>${pattern}</td>
        </tr>
      `;
    }).join('');
    const table = `
      <table class="org-table">
        <caption class="sr-only">${getText('demo.orgStructure', 'Organization')}</caption>
        <thead>
          <tr>
            <th scope="col">${getText('demo.department', 'Department')}</th>
            <th scope="col">${getText('demo.headcount', 'Headcount')}</th>
            <th scope="col">${getText('demo.brigades', 'Brigades')}</th>
            <th scope="col">${getText('demo.pattern', 'Pattern')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    els.orgTable.innerHTML = table;
    els.orgTable.removeAttribute('aria-busy');
    const summary = departments.map(dept => getText('demo.departmentSummary', '{name}: {headcount}', {name: dept.name, headcount: formatInteger(dept.headcount)})).join('; ');
    setDescription(els.orgTable, 'org-desc', `${getText('demo.orgStructure', 'Organization')}. ${summary}`);
  }

  function renderGenderOverall(genderData, totalHeadcount){
    const container = els.genderOverall;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const entries = Object.entries(genderData || {}).filter(([, value]) => Number(value) > 0);
    const descId = 'gender-overall-desc';
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const nEl = document.getElementById('gender-n');
    if (nEl) {
      nEl.textContent = formatInteger(total);
    }
    if (!entries.length) {
      const noData = window.I18N?.t?.('status.noData') || 'No data available';
      container.innerHTML = `<p id="${descId}" class="sr-only">${noData}</p>`;
      container.setAttribute('role', 'group');
      container.setAttribute('tabindex', '0');
      container.setAttribute('aria-describedby', descId);
      container.setAttribute('aria-label', `${getText('demo.gender_title', 'Gender — Headcount')}: ${noData}`);
      return;
    }
    const dataset = entries.map(([key, value]) => {
      const count = Number(value) || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return {
        key,
        label: getGenderLabel(key),
        count,
        percent
      };
    });
    const items = dataset.map(item => {
      const tooltip = `${item.label}: ${formatInteger(item.count)} (${item.percent}%)`;
      return `
        <div class="chart-mini__item" role="listitem" title="${escapeHtml(tooltip)}">
          <span class="chart-mini__label">${escapeHtml(item.label)}</span>
          <div class="chart-mini__bar" aria-hidden="true">
            <span class="chart-mini__fill chart-mini__fill--${item.key}" style="width:${Math.max(item.percent, 1)}%;"></span>
          </div>
          <span class="chart-mini__value">${formatInteger(item.count)} (${item.percent}%)</span>
        </div>
      `;
    }).join('');
    container.innerHTML = items;
    container.setAttribute('role', 'list');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', getText('demo.gender_title', 'Gender — Headcount'));
    setDescription(container, descId, dataset.map(item => `${item.label}: ${formatInteger(item.count)} (${item.percent}%)`).join('; '));
  }

  function renderAgeOverall(ageData, totalHeadcount){
    const container = els.ageOverall;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const bands = computeBands(ageData, AGE_BANDS).map(band => {
      const labelKey = band.labelKey || null;
      const fallbackLabel = band.label || band.key;
      const label = labelKey ? getText(labelKey, fallbackLabel) : fallbackLabel;
      return {
        key: band.key,
        labelKey,
        label,
        count: Number(band.count) || 0
      };
    });
    const total = bands.reduce((sum, item) => sum + item.count, 0);
    const nEl = document.getElementById('age-n');
    if (nEl) {
      nEl.textContent = formatInteger(total);
    }
    const globalTotal = typeof window !== 'undefined' ? Number(window.DEMO_TOTAL) : Number(totalHeadcount);
    if (Number.isFinite(globalTotal) && globalTotal > 0) {
      warnOnMismatch('Age bands sum', total, globalTotal);
    }
    mountChart('#chart-age-overall', drawAgeOverall, { data: bands, total });
  }

  function renderByDepartment(departments, wellnessByDept){
    const container = els.byDept;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const noteHost = document.querySelector('[data-note-host="dept"]');
    const note = noteHost?.querySelector('#dept-note');
    if (note) {
      note.textContent = getText('demo.note.byDept', 'Threshold: Wellness Score ≥ 60 (demo). Period: {period}.', {
        period: getPeriodLabel()
      });
    }
    mountChart('#chart-by-dept', drawByDept, { departments, wellnessByDept });
  }

  function drawAgeOverall(root, payload){
    const dataset = Array.isArray(payload?.data) ? payload.data : [];
    const total = Number(payload?.total) || dataset.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
    const descId = 'age-overall-desc';
    const host = root?.closest?.('[data-chart="age-overall"]') || root?.parentElement || root;
    if (!dataset.length) {
      const noData = window.I18N?.t?.('status.noData') || 'No data available';
      const empty = document.createElement('p');
      empty.id = descId;
      empty.className = 'sr-only';
      empty.textContent = noData;
      root.appendChild(empty);
      root.setAttribute('role', 'group');
      root.setAttribute('tabindex', '0');
      root.setAttribute('aria-describedby', descId);
      root.setAttribute('aria-label', `${getText('demo.age_title', 'Age — Headcount by band')}: ${noData}`);
      return {
        destroy(){
          root.replaceChildren();
          root.removeAttribute('role');
          root.removeAttribute('tabindex');
          root.removeAttribute('aria-describedby');
          root.removeAttribute('aria-label');
        }
      };
    }
    const totals = dataset.map(item => Number(item?.count) || 0);
    const desc = document.createElement('p');
    desc.id = descId;
    desc.className = 'sr-only';
    root.setAttribute('role', 'group');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-describedby', descId);
    root.setAttribute('aria-label', getText('demo.age_title', 'Age — Headcount by band'));

    const getBounds = () => {
      const rect = host?.getBoundingClientRect?.() || {width: 0, height: 0};
      const width = Math.max(rect.width || host?.clientWidth || host?.offsetWidth || root.clientWidth || 360, 280);
      const height = Math.max(rect.height || host?.clientHeight || host?.offsetHeight || root.clientHeight || 220, 200);
      return { width, height };
    };

    const render = () => {
      const { width, height } = getBounds();
      const margin = { top: 28, right: 20, bottom: 48, left: 20 };
      const chartHeight = Math.max(60, height - margin.top - margin.bottom);
      const available = Math.max(1, width - margin.left - margin.right);
      const bucketCount = dataset.length;
      const gapRatio = bucketCount > 1 ? 0.28 : 0;
      let barWidth = available / (bucketCount + gapRatio * Math.max(bucketCount - 1, 0));
      barWidth = Math.max(18, Math.min(88, barWidth));
      if (barWidth * bucketCount > available) {
        barWidth = Math.max(18, available / bucketCount);
      }
      let remaining = Math.max(0, available - barWidth * bucketCount);
      let gap = bucketCount > 1 ? remaining / (bucketCount - 1) : 0;
      if (bucketCount > 1 && gap < 6) {
        const deficit = (6 - gap) * (bucketCount - 1);
        const adjustment = deficit / bucketCount;
        barWidth = Math.max(18, barWidth - adjustment);
        remaining = Math.max(0, available - barWidth * bucketCount);
        gap = bucketCount > 1 ? remaining / (bucketCount - 1) : 0;
      }
      gap = bucketCount > 1 ? Math.min(32, gap) : 0;
      const max = Math.max(1, ...totals);
      const axisY = height - margin.bottom;
      const radius = Math.min(12, barWidth / 2);
      const labelBaseline = Math.min(height - 12, axisY + 28);
      const bars = dataset.map((entry, index) => {
        const labelKey = entry.labelKey || null;
        const fallbackLabel = entry.label || entry.key;
        const label = labelKey ? getText(labelKey, fallbackLabel) : fallbackLabel;
        const val = Number(entry.count) || 0;
        const percent = total ? Math.round((val / total) * 100) : 0;
        const barHeight = max ? (val / max) * chartHeight : 0;
        const x = margin.left + index * (barWidth + gap);
        const y = axisY - barHeight;
        const valueY = Math.max(margin.top + 16, y - 12);
        const tooltip = `${formatInteger(val)} (${percent}%)`;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="${radius}" class="age-bar">
            <title>${escapeHtml(tooltip)}</title>
          </rect>
          <text x="${x + barWidth / 2}" y="${valueY}" class="age-bar__value">${escapeHtml(tooltip)}</text>
          <text x="${x + barWidth / 2}" y="${labelBaseline}" class="age-bar__label">${escapeHtml(label)}</text>
        `;
      }).join('');
      root.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
          <line x1="${margin.left - 6}" y1="${axisY}" x2="${width - margin.right + 6}" y2="${axisY}" class="age-axis"></line>
          ${bars}
        </svg>
      `;
      desc.textContent = dataset.map(entry => {
        const labelKey = entry.labelKey || null;
        const fallbackLabel = entry.label || entry.key;
        const label = labelKey ? getText(labelKey, fallbackLabel) : fallbackLabel;
        const val = Number(entry.count) || 0;
        const percent = total ? Math.round((val / total) * 100) : 0;
        return `${label}: ${formatInteger(val)} (${percent}%)`;
      }).join('; ');
      root.appendChild(desc);
    };

    let raf = null;
    const requestRender = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };

    const observer = (host && typeof ResizeObserver !== 'undefined') ? new ResizeObserver(() => requestRender()) : null;
    if (observer && host) {
      observer.observe(host);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestRender();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);

    render();
    requestRender();

    return {
      destroy(){
        if (observer) observer.disconnect();
        window.removeEventListener('visibilitychange', handleVisibility);
        if (raf) cancelAnimationFrame(raf);
        root.replaceChildren();
        root.removeAttribute('role');
        root.removeAttribute('tabindex');
        root.removeAttribute('aria-describedby');
        root.removeAttribute('aria-label');
      }
    };
  }

  function drawByDept(root, payload){
    const departments = Array.isArray(payload?.departments) ? payload.departments : [];
    const wellnessByDept = Array.isArray(payload?.wellnessByDept) ? payload.wellnessByDept : [];
    const descId = 'dept-status-desc';
    if (!departments.length) {
      const noData = window.I18N?.t?.('status.noData') || 'No data available';
      const empty = document.createElement('p');
      empty.id = descId;
      empty.className = 'sr-only';
      empty.textContent = noData;
      root.appendChild(empty);
      root.setAttribute('role', 'group');
      root.setAttribute('tabindex', '0');
      root.setAttribute('aria-describedby', descId);
      root.setAttribute('aria-label', `${getText('demo.byDepartment', 'By department')}: ${noData}`);
      return {
        destroy(){
          root.replaceChildren();
          root.removeAttribute('role');
          root.removeAttribute('tabindex');
          root.removeAttribute('aria-describedby');
          root.removeAttribute('aria-label');
        }
      };
    }
    const statsMap = new Map(wellnessByDept.map(item => [item.id, item]));
    const okLabel = getText('legend.ok', 'OK (≥ threshold)');
    const nokLabel = getText('legend.nok', 'Not OK (< threshold)');
    const totalLabel = getText('demo.total', 'Total');
    const rows = departments.map(dept => {
      const metric = statsMap.get(dept.id) || {};
      const headcount = Number(dept.headcount) || 0;
      const okPercentRaw = Number(metric.avg);
      const okPercent = Number.isFinite(okPercentRaw) ? Math.max(0, Math.min(100, Math.round(okPercentRaw))) : 0;
      const nokPercent = Math.max(0, Math.min(100, 100 - okPercent));
      const okCount = Math.round((okPercent / 100) * headcount);
      const nokCount = Math.max(0, headcount - okCount);
      const segments = [
        { key: 'ok', label: okLabel, percent: okPercent, count: okCount },
        { key: 'nok', label: nokLabel, percent: nokPercent, count: nokCount }
      ];
      const stack = segments.map(segment => {
        const width = Math.max(segment.percent, 1);
        const ariaLabel = `${segment.label} ${formatPercent(segment.percent)} (n=${formatInteger(segment.count)})`;
        return `<span class="stack--${segment.key}" style="flex:${width}" aria-label="${escapeHtml(ariaLabel)}">${formatPercent(segment.percent)}</span>`;
      }).join('');
      const tooltip = `${dept.name} — ${okLabel}: ${formatPercent(okPercent)} (n=${formatInteger(okCount)}); ${nokLabel}: ${formatPercent(nokPercent)} (n=${formatInteger(nokCount)}); ${totalLabel}: ${formatInteger(headcount)}`;
      return `
        <div class="chart-bars__row" role="listitem" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">
          <div class="chart-bars__label">${escapeHtml(dept.name)}</div>
          <div class="chart-bars__stack" role="presentation">${stack}</div>
        </div>
      `;
    }).join('');
    const description = departments.map(dept => {
      const metric = statsMap.get(dept.id) || {};
      const headcount = Number(dept.headcount) || 0;
      const okPercentRaw = Number(metric.avg);
      const okPercent = Number.isFinite(okPercentRaw) ? Math.max(0, Math.min(100, Math.round(okPercentRaw))) : 0;
      const nokPercent = Math.max(0, Math.min(100, 100 - okPercent));
      const okCount = Math.round((okPercent / 100) * headcount);
      const nokCount = Math.max(0, headcount - okCount);
      return `${dept.name}: ${okLabel} ${formatPercent(okPercent)} (n=${formatInteger(okCount)}), ${nokLabel} ${formatPercent(nokPercent)} (n=${formatInteger(nokCount)})`;
    }).join('; ');
    root.innerHTML = `<div class="chart-bars__grid" role="list">${rows}</div>`;
    const desc = document.createElement('p');
    desc.id = descId;
    desc.className = 'sr-only';
    desc.textContent = description;
    root.appendChild(desc);
    root.setAttribute('role', 'group');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-describedby', descId);
    root.setAttribute('aria-label', getText('demo.byDepartment', 'By department'));
    return {
      destroy(){
        root.replaceChildren();
        root.removeAttribute('role');
        root.removeAttribute('tabindex');
        root.removeAttribute('aria-describedby');
        root.removeAttribute('aria-label');
      }
    };
  }

  function renderShiftGrid(departments){
    if (!els.shiftGrid) return;
    const basePattern = ['day', 'day', 'night', 'night', 'off', 'off'];
    const rotate = (arr, offset) => {
      const len = arr.length;
      const index = ((offset % len) + len) % len;
      return arr.slice(index).concat(arr.slice(0, index));
    };
    const operations = departments.filter(d => (d.pattern || '').toLowerCase() === '2-2-2');
    const support = departments.filter(d => (d.pattern || '').toLowerCase() === 'day-only');
    const rows = [];
    operations.forEach(dept => {
      ['A', 'B', 'C'].forEach((brigade, idx) => {
        rows.push({ group: dept.name, brigade, pattern: rotate(basePattern, idx * 2) });
      });
    });
    if (support.length) {
      rows.push({
        group: support.map(d => d.name).join(' / '),
        brigade: '—',
        pattern: Array(6).fill('day')
      });
    }
    const dayLabel = getText('demo.day', 'Day');
    const nightLabel = getText('demo.night', 'Night');
    const offLabel = getText('demo.off', 'Off');
    const headerCells = Array.from({length: 6}, (_, idx) => `<th scope="col">${dayLabel} ${idx + 1}</th>`).join('');
    const tableRows = rows.map(row => {
      const cells = row.pattern.map(value => {
        const aria = mapShiftLabel(value, dayLabel, nightLabel, offLabel);
        return `<td><span class="shift-cell shift-cell--${value}" aria-label="${aria}">${abbreviateShift(value, dayLabel, nightLabel, offLabel)}</span></td>`;
      }).join('');
      return `
        <tr>
          <th scope="row">${escapeHtml(row.group)}</th>
          <td>${escapeHtml(row.brigade)}</td>
          ${cells}
        </tr>
      `;
    }).join('');
    const legendId = 'shift-legend';
    const legend = `
      <div class="shift-legend" id="${legendId}">
        <span><span class="swatch stack--male"></span>${dayLabel}</span>
        <span><span class="swatch stack--female"></span>${nightLabel}</span>
        <span><span class="swatch stack--other"></span>${offLabel}</span>
      </div>
    `;
    const table = `
      <table class="shift-table" aria-describedby="${legendId}">
        <caption class="sr-only">${getText('demo.shiftPattern', 'Shift Pattern')}</caption>
        <thead>
          <tr>
            <th scope="col">${getText('demo.department', 'Department')}</th>
            <th scope="col">${getText('demo.brigades', 'Brigades')}</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    els.shiftGrid.innerHTML = `${table}${legend}`;
    els.shiftGrid.removeAttribute('aria-busy');
    els.shiftGrid.setAttribute('role', 'region');
    els.shiftGrid.setAttribute('aria-label', getText('demo.shiftPattern', 'Shift Pattern'));
    const summary = rows.map(row => getText('demo.shiftSummary', '{group} {brigade}: {pattern}', {
      group: row.group,
      brigade: row.brigade,
      pattern: row.pattern.map(value => mapShiftLabel(value, dayLabel, nightLabel, offLabel)).join(', ')
    })).join('; ');
    setDescription(els.shiftGrid, 'shift-desc', `${getText('demo.shiftPattern', 'Shift Pattern')}. ${summary}`);
  }

  function updateSourceMeta(headcount){
    if (typeof document === 'undefined') return;
    const panels = document.querySelectorAll(`[data-source-id="${DEMO_SOURCE_ID}"]`);
    if (!panels.length) return;
    const applyOverrides = window.Sources?.applyOverrides;
    if (typeof applyOverrides !== 'function') return;
    const total = Number(headcount);
    const payload = { period: getPeriodLabel() };
    if (Number.isFinite(total) && total > 0) {
      payload.sampleN = Math.round(total);
    }
    panels.forEach(panel => applyOverrides(panel, payload));
  }

  function getPeriodLabel(){
    const readRange = window.DateControls?.readRange;
    if (typeof readRange !== 'function') {
      return getText('demo.period.default', 'Selected period');
    }
    const range = readRange();
    if (!range) {
      return getText('demo.period.default', 'Selected period');
    }
    if (range.preset) {
      const key = `range.${range.preset}`;
      const translated = window.I18N?.t?.(key);
      if (translated && translated !== key) return translated;
      return String(range.preset).toUpperCase();
    }
    if (range.start && range.end) {
      const startDate = new Date(range.start);
      const endDate = new Date(range.end);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        try {
          const formatter = new Intl.DateTimeFormat(getLang(), {year: 'numeric', month: 'short', day: 'numeric'});
          return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
        } catch (err) {
          /* fall through to raw values */
        }
      }
      return `${range.start} – ${range.end}`;
    }
    return getText('demo.period.default', 'Selected period');
  }

  function getGenderLabel(key){
    const map = {
      male: getText('demo.gender.male', 'Male'),
      female: getText('demo.gender.female', 'Female'),
      other: getText('demo.gender.other', 'Other')
    };
    return map[key] || key;
  }

  function mapShiftLabel(value, dayLabel, nightLabel, offLabel){
    if (value === 'day') return getText('demo.shiftLabel.day', '{label}', {label: dayLabel});
    if (value === 'night') return getText('demo.shiftLabel.night', '{label}', {label: nightLabel});
    return getText('demo.shiftLabel.off', '{label}', {label: offLabel});
  }

  function abbreviateShift(value, dayLabel, nightLabel, offLabel){
    if (value === 'day') return dayLabel.charAt(0) || 'D';
    if (value === 'night') return nightLabel.charAt(0) || 'N';
    return offLabel.charAt(0) || 'O';
  }

  function setDescription(container, id, text){
    if (!container) return;
    let desc = container.querySelector(`#${id}`);
    if (!desc) {
      desc = document.createElement('p');
      desc.id = id;
      desc.className = 'sr-only';
      container.appendChild(desc);
    }
    desc.textContent = text;
    container.setAttribute('aria-describedby', id);
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch] || ch));
  }

  function stripTags(value){
    return String(value).replace(/<[^>]+>/g, '');
  }

  function getText(key, fallback, vars){
    const t = window.I18N?.t?.(key, vars);
    if (t && t !== key) return t;
    if (!vars) return fallback;
    return fallback.replace(/\{(\w+)\}/g, (_, name) => (vars && name in vars) ? vars[name] : `{${name}}`);
  }

  function resolveVersion(){
    if (typeof window.APP_VERSION !== 'undefined') {
      return Promise.resolve(window.APP_VERSION || '');
    }
    return new Promise(resolve => {
      const handler = () => {
        window.removeEventListener('app:version', handler);
        resolve(window.APP_VERSION || '');
      };
      window.addEventListener('app:version', handler, {once: true});
    });
  }

  function showToast(message){
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.add('is-visible');
    setTimeout(() => {
      if (els.toast) {
        els.toast.classList.remove('is-visible');
        els.toast.hidden = true;
      }
    }, 4200);
  }
})();
