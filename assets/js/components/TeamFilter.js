export function renderTeamFilter({ mount, options, value = [], onChange }) {
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;

  const uid = Math.random().toString(36).slice(2, 8);
  const listId = `tfList-${uid}`;
  const buttonId = `tfBtn-${uid}`;
  const panelId = `tfPanel-${uid}`;
  const searchId = `tfSearch-${uid}`;
  const chipsId = `tfChips-${uid}`;
  const selectAllId = `tfAll-${uid}`;
  const clearId = `tfNone-${uid}`;

  const escapeHtml = value =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const translate = (key, fallback) => {
    try {
      const fn = window.I18N?.t;
      if (typeof fn === 'function') {
        const result = fn.call(window.I18N, key);
        if (typeof result === 'string' && result.trim()) {
          return result;
        }
      }
    } catch (err) {
      /* noop */
    }
    return fallback;
  };

  const teamLabel = translate('label.teamFilter', 'Team');
  const teamButtonLabel = translate('label.teamFilter.button', 'Teams');
  const allTeamsLabel = translate('filter.teamButton.all', translate('label.team.all', 'All teams'));
  const searchPlaceholder = translate('filter.searchTeams', 'Search teams…');
  const selectAllLabel = translate('filter.selectAll', 'Select all');
  const clearLabel = translate('filter.clear', 'Clear');
  const removeChipLabel = name => {
    const base = translate('filter.removeTeam', '').trim();
    if (!base) return `Remove ${name}`;
    if (base.includes('{name}')) return base.replace('{name}', name);
    if (base.includes('%s')) return base.replace('%s', name);
    return `${base} ${name}`;
  };

  const safeOptions = Array.isArray(options)
    ? (() => {
        const seen = new Set();
        return options
          .map(option => {
            const id = String(option?.id ?? '').trim();
            const labelText = option?.label ? String(option.label) : id;
            return {
              id,
              label: labelText,
              labelHtml: escapeHtml(labelText)
            };
          })
          .filter(option => option.id && !seen.has(option.id) && seen.add(option.id));
      })()
    : [];

  const optionIndex = new Map(safeOptions.map(option => [option.id, option.label]));
  let selected = new Set(
    Array.isArray(value)
      ? value
          .map(item => String(item ?? ''))
          .filter(id => optionIndex.has(id))
      : []
  );
  const allIds = safeOptions.map(option => option.id);
  const totalCount = allIds.length;

  const usingAllInitially = selected.size === 0 || selected.size === totalCount;
  if (usingAllInitially) {
    selected = new Set(allIds);
  }
  let usingAll = usingAllInitially;

  host.innerHTML = `
  <div class="team-filter">
    <label class="filters-label" for="${buttonId}">${escapeHtml(teamLabel)}</label>
    <div class="tf-control" role="combobox" aria-expanded="false">
      <button class="tf-button" id="${buttonId}" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${panelId}"></button>
      <div class="tf-panel" id="${panelId}" hidden>
        <div class="tf-search">
          <input id="${searchId}" type="text" placeholder="${escapeHtml(searchPlaceholder)}" aria-label="${escapeHtml(searchPlaceholder)}" />
          <button id="${selectAllId}" type="button">${escapeHtml(selectAllLabel)}</button>
          <button id="${clearId}" type="button">${escapeHtml(clearLabel)}</button>
        </div>
        <ul class="tf-list" id="${listId}" role="listbox" aria-multiselectable="true"></ul>
      </div>
    </div>
    <div class="tf-chips" id="${chipsId}"></div>
  </div>`;

  const control = host.querySelector('.tf-control');
  const btn = host.querySelector(`#${buttonId}`);
  const panel = host.querySelector(`#${panelId}`);
  const list = host.querySelector(`#${listId}`);
  const chips = host.querySelector(`#${chipsId}`);
  const search = host.querySelector(`#${searchId}`);
  const selectAllButton = host.querySelector(`#${selectAllId}`);
  const clearButton = host.querySelector(`#${clearId}`);

  function getSelectedCount() {
    if (usingAll) return totalCount;
    return selected.size;
  }

  function applyLabel() {
    const count = getSelectedCount();
    const displayCount = usingAll ? totalCount : count;
    if (!totalCount || displayCount === 0 || displayCount === totalCount) {
      btn.textContent = allTeamsLabel;
      return;
    }
    btn.textContent = `${teamButtonLabel} · ${displayCount}/${totalCount}`;
  }

  function applyChips() {
    const ids = usingAll ? [] : Array.from(selected);
    if (!ids.length) {
      chips.innerHTML = '';
      return;
    }
    const visible = ids.slice(0, 4);
    chips.innerHTML = visible
      .map(id => {
        const label = optionIndex.get(id) ?? id;
        const labelHtml = escapeHtml(label);
        const ariaLabel = escapeHtml(removeChipLabel(label));
        const dataId = escapeHtml(id);
        return `<span class="chip">${labelHtml}<button data-id="${dataId}" class="chip-x" type="button" aria-label="${ariaLabel}">×</button></span>`;
      })
      .join('');
    if (ids.length > visible.length) {
      chips.insertAdjacentHTML('beforeend', `<span class="chip more">+${ids.length - visible.length}</span>`);
    }
    chips.querySelectorAll('.chip-x').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        if (!id) return;
        if (usingAll) {
          usingAll = false;
          selected = new Set(allIds);
        }
        selected.delete(id);
        if (selected.size === 0) {
          usingAll = true;
          selected = new Set(allIds);
        }
        sync({ notify: true, refreshList: false });
      });
    });
  }

  function renderList(filter = '') {
    const f = filter.trim().toLowerCase();
    const filtered = safeOptions.filter(option => option.label.toLowerCase().includes(f));
    list.innerHTML = filtered
      .map(option => {
        const idValue = escapeHtml(option.id);
        return `
        <li class="tf-item" role="option" aria-selected="false">
          <label>
            <input type="checkbox" value="${idValue}">
            <span>${option.labelHtml}</span>
          </label>
        </li>`;
      })
      .join('');

    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const id = checkbox.value;
        if (!optionIndex.has(id)) return;
        if (checkbox.checked) {
          if (usingAll && selected.size === allIds.length) {
            usingAll = false;
            selected = new Set(allIds);
          }
          selected.add(id);
        } else {
          if (usingAll) {
            usingAll = false;
            selected = new Set(allIds);
          }
          selected.delete(id);
        }
        if (selected.size === allIds.length) {
          usingAll = true;
          selected = new Set(allIds);
        } else if (selected.size === 0) {
          usingAll = true;
          selected = new Set(allIds);
        }
        sync({ notify: true, refreshList: false });
      });
    });

    applySelections();
  }

  function applySelections() {
    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const id = checkbox.value;
      const isChecked = usingAll ? true : selected.has(id);
      checkbox.checked = isChecked;
      checkbox.setAttribute('aria-selected', isChecked.toString());
      checkbox.closest('li')?.setAttribute('aria-selected', isChecked.toString());
    });
  }

  function notifySelection() {
    if (typeof onChange === 'function') {
      const ids = usingAll ? [] : Array.from(selected);
      onChange(ids);
    }
  }

  function sync({ notify = false, refreshList = false } = {}) {
    applyLabel();
    applyChips();
    if (refreshList) {
      renderList(search.value || '');
    } else {
      applySelections();
    }
    if (notify) {
      notifySelection();
    }
  }

  function openPanel() {
    if (!panel.hidden) return;
    panel.hidden = false;
    control?.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-expanded', 'true');
    // позиция
    panel.style.left = '0px';
    panel.style.top = '36px';
    panel.style.bottom = 'auto';
    panel.style.maxHeight = '280px';
    const r = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.right > vw - 8) {
      panel.style.left = `${Math.max(0, vw - 8 - r.width)}px`;
    }
    const btnRect = btn.getBoundingClientRect();
    if (r.bottom > vh - 8) {
      panel.style.top = 'auto';
      panel.style.bottom = `${btnRect.height + 8}px`;
      panel.style.maxHeight = `${Math.min(280, btnRect.top - 16)}px`;
    } else {
      panel.style.top = '36px';
      panel.style.bottom = 'auto';
      panel.style.maxHeight = '280px';
    }
    search.value = '';
    renderList('');
    search.focus();
  }

  function closePanel({ focusButton = false } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    control?.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) {
      btn.focus();
    }
  }

  btn.addEventListener('click', () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  selectAllButton?.addEventListener('click', () => {
    usingAll = true;
    selected = new Set(allIds);
    sync({ notify: true, refreshList: false });
  });

  clearButton?.addEventListener('click', () => {
    usingAll = true;
    selected = new Set(allIds);
    sync({ notify: true, refreshList: false });
  });

  search.addEventListener('input', () => {
    renderList(search.value || '');
  });

  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePanel({ focusButton: true });
    }
  });

  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePanel({ focusButton: true });
    }
  });

  document.addEventListener(
    'click',
    event => {
      if (!host.contains(event.target)) {
        closePanel();
      }
    }
  );

  sync({ notify: false, refreshList: true });
}
