(function(){
  const heroEl = document.getElementById('demo-hero');
  if (!heroEl) return;

  const state = { data: null, version: null };
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
    genderByDept: document.getElementById('chart-gender-by-dept'),
    shiftGrid: document.getElementById('shift-grid'),
    toast: document.getElementById('demo-toast'),
    exportBtn: document.getElementById('btn-export-brief')
  };

  const HERO_SRC = './assets/img/aurora-platform-hero.svg';

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
      els.exportBtn.addEventListener('click', handleExport);
    }
  }

  function handleExport(){
    if (!state.data) {
      showToast(getText('demo.loading', 'Loading demo data…'));
      return;
    }
    const exporter = window.EXPORTER || window.exporter;
    if (!exporter || typeof exporter.exportSiteBriefPDF !== 'function') {
      showToast(getText('demo.exportUnavailable', 'Export not available.'));
      return;
    }
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
    if (els.exportBtn) els.exportBtn.disabled = false;
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
    [els.genderOverall, els.ageOverall, els.genderByDept].forEach(chart => {
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
    renderBadge(data.site, headcount);
    renderHero(data.site);
    renderOverviewCards(data, headcount, departments);
    renderOrgTable(departments);
    renderGenderOverall(data.gender_overall, headcount);
    renderAgeOverall(data.age_overall);
    renderGenderByDepartment(departments, data.gender_by_dept);
    renderShiftGrid(departments);
  }

  function renderBadge(name, headcount){
    if (!els.badge) return;
    const text = getText('demo.badge', `Demo · ${name} · ${headcount} staff · 24/7`, {name, headcount});
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

    renderCard(els.cards.headcount, {
      label: getText('demo.headcount', 'Headcount'),
      value: headcount.toLocaleString(),
      meta: getText('demo.departmentCount', '{count} departments', {count: departments.length}),
      aria: `${getText('demo.headcount', 'Headcount')}: ${headcount.toLocaleString()}`
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

    renderCard(els.cards.shifts, {
      label: getText('demo.shifts', 'Shifts'),
      value: `${Number(data.shift_hours) || 0}h`,
      meta: shiftMetaParts.join(' · '),
      aria: `${getText('demo.shifts', 'Shifts')}: ${Number(data.shift_hours) || 0}h. ${shiftMetaParts.join('. ')}`
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
      const brigades = dept.brigades != null ? escapeHtml(String(dept.brigades)) : '—';
      const pattern = escapeHtml(String(dept.pattern || '').replace(/-/g, '–'));
      return `
        <tr>
          <th scope="row">${name}</th>
          <td data-sort-value="${head}">${head}</td>
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
    const summary = departments.map(dept => getText('demo.departmentSummary', '{name}: {headcount}', {name: dept.name, headcount: dept.headcount})).join('; ');
    setDescription(els.orgTable, 'org-desc', `${getText('demo.orgStructure', 'Organization')}. ${summary}`);
  }

  function renderGenderOverall(genderData, totalHeadcount){
    const container = els.genderOverall;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const entries = Object.entries(genderData || {}).filter(([, value]) => Number(value) > 0);
    const descId = 'gender-overall-desc';
    if (!entries.length) {
      const noData = window.I18N?.t?.('status.noData') || 'No data available';
      container.innerHTML = `<p id="${descId}" class="sr-only">${noData}</p>`;
      container.setAttribute('role', 'group');
      container.setAttribute('tabindex', '0');
      container.setAttribute('aria-describedby', descId);
      container.setAttribute('aria-label', `${getText('demo.genderOverall', 'Gender — Overall')}: ${noData}`);
      return;
    }
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const circumference = 2 * Math.PI * 16;
    let progress = 0;
    const segments = entries.map(([key, value]) => {
      const val = Number(value) || 0;
      const percent = total ? (val / total) * 100 : 0;
      const dash = (percent / 100) * circumference;
      const offset = circumference * 0.25 - progress;
      progress += dash;
      return `<circle class="donut-segment donut-segment--${key}" cx="21" cy="21" r="16" stroke-width="6" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}" fill="transparent"></circle>`;
    }).join('');
    const svg = `
      <svg viewBox="0 0 42 42" aria-hidden="true" focusable="false">
        <circle class="donut-track" cx="21" cy="21" r="16" stroke-width="6" fill="transparent"></circle>
        ${segments}
      </svg>
    `;
    const legendItems = entries.map(([key, value]) => {
      const percent = total ? Math.round((Number(value) || 0) / total * 100) : 0;
      const label = getGenderLabel(key);
      return `<span class="chart-legend__item"><span class="chart-legend__swatch stack--${key}"></span>${label} · ${value} (${percent}%)</span>`;
    }).join('');
    container.innerHTML = `
      <div class="chart-donut__inner">${svg}
        <div class="chart-donut__value">
          <span class="chart-donut__number">${totalHeadcount}</span>
          <span class="chart-donut__caption">${getText('demo.headcount', 'Headcount')}</span>
        </div>
      </div>
      <div class="chart-legend">${legendItems}</div>
      <p id="${descId}" class="sr-only">${entries.map(([key, value]) => {
        const percent = total ? Math.round((Number(value) || 0) / total * 100) : 0;
        return `${getGenderLabel(key)} ${value} (${percent}%)`;
      }).join('; ')}. ${getText('demo.headcount', 'Headcount')}: ${totalHeadcount}.</p>
    `;
    container.setAttribute('role', 'group');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-describedby', descId);
    container.setAttribute('aria-label', getText('demo.genderOverall', 'Gender — Overall'));
  }

  function renderAgeOverall(ageData){
    const container = els.ageOverall;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const entries = Object.entries(ageData || {});
    const descId = 'age-overall-desc';
    if (!entries.length) {
      const noData = window.I18N?.t?.('status.noData') || 'No data available';
      container.innerHTML = `<p id="${descId}" class="sr-only">${noData}</p>`;
      container.setAttribute('role', 'group');
      container.setAttribute('tabindex', '0');
      container.setAttribute('aria-describedby', descId);
      container.setAttribute('aria-label', `${getText('demo.ageOverall', 'Age — Overall')}: ${noData}`);
      return;
    }
    const totals = entries.map(([, value]) => Number(value) || 0);
    const max = Math.max(1, ...totals);
    const width = 360;
    const height = 220;
    const chartHeight = 150;
    const margin = 32;
    const gap = 16;
    const barWidth = (width - margin * 2 - gap * (entries.length - 1)) / entries.length;
    let bars = '';
    entries.forEach(([bucket, value], index) => {
      const val = Number(value) || 0;
      const barHeight = (val / max) * chartHeight;
      const x = margin + index * (barWidth + gap);
      const y = height - margin - barHeight;
      bars += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" class="age-bar"></rect>
        <text x="${x + barWidth / 2}" y="${y - 8}" class="age-bar__value">${val}</text>
        <text x="${x + barWidth / 2}" y="${height - margin + 18}" class="age-bar__label">${bucket}</text>
      `;
    });
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
        <line x1="${margin - 8}" y1="${height - margin}" x2="${width - margin + 8}" y2="${height - margin}" class="age-axis"></line>
        ${bars}
      </svg>
    `;
    container.innerHTML = `${svg}<p id="${descId}" class="sr-only">${entries.map(([bucket, value]) => `${bucket}: ${value}`).join('; ')}</p>`;
    container.setAttribute('role', 'group');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-describedby', descId);
    container.setAttribute('aria-label', getText('demo.ageOverall', 'Age — Overall'));
  }

  function renderGenderByDepartment(departments, genderByDept){
    const container = els.genderByDept;
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const rows = departments.map(dept => {
      const stats = genderByDept?.[dept.id] || {};
      const entries = Object.entries(stats).filter(([, value]) => Number(value) > 0);
      const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1;
      const segments = entries.map(([key, value]) => {
        const val = Number(value) || 0;
        const percent = Math.round((val / total) * 100);
        return `<span class="stack--${key}" style="flex:${Math.max(val, 1)}" aria-label="${getGenderLabel(key)} ${val} (${percent}%)"><span>${percent}%</span></span>`;
      }).join('');
      return `
        <div class="chart-bars__row">
          <div class="chart-bars__label">${escapeHtml(dept.name)}</div>
          <div class="chart-bars__stack" role="presentation">${segments}</div>
        </div>
      `;
    }).join('');
    const descId = 'gender-by-dept-desc';
    container.innerHTML = `<div class="chart-bars__grid">${rows}</div><p id="${descId}" class="sr-only">${departments.map(dept => {
      const stats = genderByDept?.[dept.id] || {};
      const parts = Object.entries(stats).map(([key, value]) => `${getGenderLabel(key)} ${value}`);
      return `${dept.name}: ${parts.join(', ')}`;
    }).join('; ')}</p>`;
    container.setAttribute('role', 'group');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-describedby', descId);
    container.setAttribute('aria-label', getText('demo.byDepartment', 'By department'));
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
