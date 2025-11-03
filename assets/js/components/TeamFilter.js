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
        if (typeof result === 'string') {
          const trimmed = result.trim();
          if (trimmed && trimmed !== key) {
            return result;
          }
        }
      }
    } catch (err) {
      /* noop */
    }
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback;
    }
    return key;
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
  const allIds = safeOptions.map(option => option.id);
  const totalCount = allIds.length;
  const optionById = new Map(safeOptions.map(option => [option.id, option]));

  const state = new Set(
    Array.isArray(value)
      ? value
          .map(item => String(item ?? ''))
          .filter(id => optionIndex.has(id))
      : []
  );

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

  const portal = document.getElementById('ui-portal');
  let inPortal = false;

  if (selectAllButton) {
    selectAllButton.textContent = 'Select all';
  }
  if (clearButton) {
    clearButton.textContent = 'Clear';
  }
  if (search) {
    search.placeholder = 'Search teams…';
    search.setAttribute('aria-label', 'Search teams…');
  }

  function applyLabel() {
    const count = state.size;
    if (!totalCount || count === 0 || count === totalCount) {
      btn.textContent = allTeamsLabel;
      return;
    }
    btn.textContent = `${teamButtonLabel} · ${count}/${totalCount}`;
  }

  function applyChips() {
    const ids = state.size === 0 || state.size === totalCount ? [] : Array.from(state);
    if (!ids.length) {
      chips.innerHTML = '';
      return;
    }
    const visible = ids.slice(0, 4);
    chips.innerHTML = visible
      .map(id => {
        const option = optionById.get(id);
        const label = option?.label ?? id;
        const labelHtml = option?.labelHtml ?? escapeHtml(label);
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
        state.delete(id);
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
          state.add(id);
        } else {
          if (state.size === 0) {
            allIds.forEach(item => state.add(item));
          }
          state.delete(id);
        }
        if (state.size === totalCount) {
          state.clear();
        }
        sync({ notify: true, refreshList: false });
      });
    });

    applySelections();
  }

  function applySelections() {
    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const id = checkbox.value;
      const isChecked = state.size === 0 || state.size === totalCount ? true : state.has(id);
      checkbox.checked = isChecked;
      checkbox.setAttribute('aria-selected', isChecked.toString());
      checkbox.closest('li')?.setAttribute('aria-selected', isChecked.toString());
    });
  }

  function notifySelection() {
    if (typeof onChange === 'function') {
      const ids = state.size === 0 || state.size === totalCount ? [] : Array.from(state);
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

  function placePanelAt(btnRect, preferUp = false) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    if (portal) {
      panel.classList.add('portal');
    }

    let top = Math.min(vh - pad - 100, btnRect.bottom + 6);
    let left = Math.max(pad, Math.min(btnRect.left, vw - pad - panel.offsetWidth));

    if (preferUp || top + panel.offsetHeight > vh - pad) {
      top = Math.max(pad, btnRect.top - panel.offsetHeight - 6);
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  function openPanel() {
    if (!panel) return;

    if (portal && !inPortal) {
      portal.appendChild(panel);
      inPortal = true;
    }

    panel.hidden = false;
    control?.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-expanded', 'true');

    if (search) {
      search.value = '';
    }
    renderList('');

    requestAnimationFrame(() => {
      const br = btn.getBoundingClientRect();
      placePanelAt(br, false);
      search?.focus();
    });
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

  btn.onclick = () => {
    const open = !panel.hidden;
    if (open) {
      closePanel();
    } else {
      openPanel();
    }
  };

  selectAllButton?.addEventListener('click', () => {
    state.clear();
    allIds.forEach(id => state.add(id));
    sync({ notify: true, refreshList: false });
  });

  clearButton?.addEventListener('click', () => {
    state.clear();
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

  document.addEventListener('click', event => {
    if (!host.contains(event.target) && !panel.contains(event.target)) {
      closePanel();
    }
  });

  ['resize', 'scroll'].forEach(ev => {
    window.addEventListener(
      ev,
      () => {
        if (!panel.hidden) {
          const br = btn.getBoundingClientRect();
          placePanelAt(br);
        }
      },
      { passive: true }
    );
  });

  sync({ notify: false, refreshList: true });
}
