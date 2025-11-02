export function renderTeamFilter({ mount, options, value = [], onChange }){
  mount.innerHTML = `
  <div class="team-filter">
    <label class="filters-label">Team</label>
    <div class="tf-control" role="combobox" aria-expanded="false">
      <button class="tf-button" id="tfBtn" type="button"></button>
      <div class="tf-panel" id="tfPanel" hidden>
        <div class="tf-search">
          <input id="tfSearch" type="text" placeholder="Search teams…" />
          <button id="tfAll" type="button">Select all</button>
          <button id="tfNone" type="button">Clear</button>
        </div>
        <ul class="tf-list" id="tfList" role="listbox" aria-multiselectable="true"></ul>
      </div>
    </div>
    <div class="tf-chips" id="tfChips"></div>
  </div>`;
  const state = new Set(value);
  const btn = mount.querySelector('#tfBtn');
  const panel = mount.querySelector('#tfPanel');
  const list = mount.querySelector('#tfList');
  const chips = mount.querySelector('#tfChips');
  const search = mount.querySelector('#tfSearch');

  function applyLabel() {
    const total = options.length;
    const sel = state.size;
    btn.textContent = sel === 0 || sel === total ? 'All teams' : `Team · ${sel}/${total}`;
  }

  function applyChips() {
    chips.innerHTML = [...state]
      .slice(0, 6)
      .map((id) => {
        const option = options.find((o) => o.id === id) || {};
        return `<span class="chip">${option.label}<button data-id="${id}" class="chip-x">×</button></span>`;
      })
      .join('');
    if (state.size > 6) {
      chips.insertAdjacentHTML('beforeend', `<span class="chip more">+${state.size - 6}</span>`);
    }
    chips.querySelectorAll('.chip-x').forEach((x) => {
      x.onclick = () => {
        state.delete(x.dataset.id);
        sync();
      };
    });
  }

  function renderList(filter = '') {
    const f = filter.trim().toLowerCase();
    list.innerHTML = options
      .filter((o) => o.label.toLowerCase().includes(f))
      .map(
        (o) => `
        <li class="tf-item">
          <label>
            <input type="checkbox" value="${o.id}" ${state.has(o.id) ? 'checked' : ''}>
            <span>${o.label}</span>
          </label>
        </li>`
      )
      .join('');
    list.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) {
          state.add(cb.value);
        } else {
          state.delete(cb.value);
        }
        sync(false);
      };
    });
  }

  function sync(notify = true) {
    applyLabel();
    applyChips();
    renderList(search.value || '');
    if (notify) {
      onChange?.([...state]);
    }
  }

  btn.onclick = () => {
    const open = panel.hasAttribute('hidden') ? false : true;
    panel.toggleAttribute('hidden', open);
    btn.setAttribute('aria-expanded', (!open).toString());
    if (!open) {
      search.value = '';
      renderList('');
      search.focus();
    }
  };

  mount.querySelector('#tfAll').onclick = () => {
    options.forEach((o) => state.add(o.id));
    sync();
  };
  mount.querySelector('#tfNone').onclick = () => {
    state.clear();
    sync();
  };
  search.oninput = () => renderList(search.value || '');
  document.addEventListener('click', (e) => {
    if (!mount.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  sync(false);
}
