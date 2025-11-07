const EMPTY_TEXT_FALLBACK = 'No heatmap data';

function heatmapLevel(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 55) return 'low';
  if (value <= 69) return 'mid';
  return 'high';
}

function bandFor(value) {
  if (!Number.isFinite(value)) return '';
  if (value >= 70) return 'red';
  if (value >= 56) return 'amber';
  return 'green';
}

function cellAriaLabel(team, value, t) {
  const stressLabel = t('aria.stressIndex', 'stress index');
  const name = team || '';
  if (!Number.isFinite(value)) {
    return `Team ${name} — ${t('status.noData', 'No data')} — ${stressLabel}`;
  }
  const rounded = Math.round(value);
  return `Team ${name} — ${rounded} (${bandFor(rounded)}) — ${stressLabel}`;
}

function highlightSelection(grid, index) {
  const cells = grid?.querySelectorAll('.heatmap-cell[role="gridcell"]') || [];
  cells.forEach(cell => {
    const col = Number(cell.dataset.colIndex);
    cell.classList.toggle('is-highlighted', index != null && col === index);
  });
  const headers = grid?.querySelectorAll('.heatmap-cell[role="columnheader"]') || [];
  headers.forEach(header => {
    const col = Number(header.dataset.colIndex);
    header.classList.toggle('is-highlighted', index != null && col === index);
  });
}

export function renderCorporateHeatmap({ grid, heatmap, state, t, onSelect }) {
  const rows = Array.isArray(heatmap?.rows) ? heatmap.rows : [];
  const cols = Array.isArray(heatmap?.cols) ? heatmap.cols : [];
  const values = heatmap?.value || {};
  const dates = Array.isArray(heatmap?.dates) ? heatmap.dates : [];

  state.heatmapColumns = cols;
  state.heatmapDates = dates;

  const totalCols = cols.length + 1;
  grid.style.setProperty('--heatmap-cols', totalCols);
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', t('aria.corporateHeatmap', 'Wellbeing heatmap'));

  const fragment = document.createDocumentFragment();

  const blank = document.createElement('div');
  blank.className = 'heatmap-cell';
  blank.setAttribute('role', 'columnheader');
  blank.textContent = '';
  fragment.appendChild(blank);

  cols.forEach((label, index) => {
    const header = document.createElement('div');
    header.className = 'heatmap-cell';
    header.setAttribute('role', 'columnheader');
    header.dataset.colIndex = String(index);
    header.dataset.colLabel = label;
    if (dates[index]) header.dataset.date = dates[index];
    header.textContent = label;
    fragment.appendChild(header);
  });

  rows.forEach(rowId => {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'heatmap-cell';
    rowHeader.setAttribute('role', 'rowheader');
    const teamLabel = state.teamMap.get(rowId) || rowId;
    rowHeader.textContent = teamLabel;
    fragment.appendChild(rowHeader);

    const rowValues = Array.isArray(values[rowId]) ? values[rowId] : [];
    cols.forEach((label, colIndex) => {
      const raw = rowValues[colIndex];
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.colIndex = String(colIndex);
      cell.dataset.colLabel = label;
      if (dates[colIndex]) cell.dataset.date = dates[colIndex];
      cell.dataset.rowId = rowId;
      if (Number.isFinite(raw)) {
        const rounded = Math.round(raw);
        cell.textContent = String(rounded);
        cell.dataset.value = String(raw);
        const level = heatmapLevel(rounded);
        cell.dataset.level = level;
        cell.setAttribute('aria-label', cellAriaLabel(teamLabel, rounded, t));
      } else {
        cell.textContent = '—';
        cell.removeAttribute('data-level');
        cell.removeAttribute('data-value');
        cell.setAttribute('aria-label', cellAriaLabel(teamLabel, null, t));
      }
      cell.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(colIndex);
        }
      });
      fragment.appendChild(cell);
    });
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);

  const cells = Array.from(grid.querySelectorAll('.heatmap-cell[role="gridcell"]'));

  return {
    cells,
    updateHighlight: index => highlightSelection(grid, index)
  };
}

export function renderEmptyHeatmap(grid, t) {
  if (!grid) return;
  grid.innerHTML = `<p class="caption">${t('heatmap.empty', EMPTY_TEXT_FALLBACK)}</p>`;
}

export function clearHeatmapState(state) {
  state.heatmapCells = [];
  state.heatmapColumns = [];
  state.heatmapDates = [];
  state.updateHeatmapHighlight = null;
}
