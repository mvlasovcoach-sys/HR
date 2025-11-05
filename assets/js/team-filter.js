(function(){
  const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
  const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
  const loaderGlobals = window.loaderGlobals || {};
  const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : (url => url);
  const loadJson = typeof loaderGlobals.fetchJson === 'function'
    ? loaderGlobals.fetchJson
    : async url => {
        const response = await fetch(url, {cache: 'no-store'});
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      };

  function fetchData(path){
    const url = new URL(path, document.baseURI);
    return loadJson(applyVersion(url.toString()));
  }

  const STORAGE_KEY = 'hr:team';
  let selectEl = null;
  let mount = null;
  let teams = [];
  let useNativeMarkup = false;
  let labelNode = null;

  async function init(){
    const direct = document.getElementById('teamFilter') || document.getElementById('teamSelect');
    const fallback = document.getElementById('team-filter');

    if (direct && direct.tagName === 'SELECT') {
      useNativeMarkup = true;
      selectEl = direct;
      labelNode = direct.closest('label')?.querySelector('span') || null;
      mount = direct.closest('.tb-group') || direct.closest('.seg-input') || direct.parentElement || direct;
    } else {
      mount = direct || fallback;
      selectEl = null;
      labelNode = null;
      useNativeMarkup = false;
    }

    if (!mount) return;

    if (!useNativeMarkup) {
      mount.classList.add('team-filter');
    }
    mount.classList.add('team-filter--loading');
    await loadTeams();
    if (useNativeMarkup) {
      renderNative();
    } else {
      renderLegacy();
    }
    mount.classList.remove('team-filter--loading');

    window.addEventListener('storage', evt => {
      if (!evt || evt.key !== STORAGE_KEY) return;
      syncFromStorage();
    });

    document.addEventListener('i18n:change', () => {
      if (useNativeMarkup) {
        renderNative();
      } else {
        renderLegacy();
      }
    });
  }

  function readTeam(){
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch (e) {
      // ignore
    }
    return 'all';
  }

  function writeTeam(value){
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      // ignore
    }
  }

  async function loadTeams(){
    try {
      const data = await fetchData('./data/org/teams.json');
      const list = Array.isArray(data?.depts) ? data.depts : [];
      teams = list.map(item => ({id: item.id, name: item.name || item.id}));
      const nameMap = {};
      teams.forEach(team => {
        nameMap[team.id] = team.name;
      });
      try {
        localStorage.setItem('hr:team:names', JSON.stringify(nameMap));
      } catch (e) {
        // ignore storage issues
      }
    } catch (e) {
      devError('Failed to load teams', e);
      teams = [];
    }
  }

  function syncFromStorage(){
    if (!selectEl) return;
    const current = readTeam();
    const options = Array.from(selectEl.options || []);
    const hasValue = options.some(option => option.value === current);
    selectEl.value = hasValue ? current : 'all';
  }

  function renderLegacy(){
    if (!mount) return;
    const current = readTeam();
    mount.innerHTML = '';
    const label = document.createElement('label');
    label.className = 'team-filter__label';
    label.setAttribute('for', 'teamFilter');
    label.textContent = window.I18N?.t('label.teamFilter') || 'Team';

    selectEl = document.createElement('select');
    selectEl.id = 'teamFilter';
    selectEl.className = 'team-filter__select';
    selectEl.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = window.I18N?.t('label.team.all') || 'All teams';
    selectEl.appendChild(allOption);

    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      selectEl.appendChild(option);
    });

    selectEl.value = current;
    mount.appendChild(label);
    mount.appendChild(selectEl);
    attachChangeHandler(selectEl);
  }

  function renderNative(){
    if (!selectEl) return;
    const current = readTeam();
    const labelText = window.I18N?.t('label.teamFilter') || 'Team';
    const allLabel = window.I18N?.t('label.team.all') || 'All teams';

    if (labelNode) {
      labelNode.textContent = labelText;
    }

    selectEl.id = 'teamFilter';
    selectEl.setAttribute('aria-label', labelText);

    const fragment = document.createDocumentFragment();
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = allLabel;
    fragment.appendChild(allOption);

    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      fragment.appendChild(option);
    });

    selectEl.innerHTML = '';
    selectEl.appendChild(fragment);
    selectEl.value = current;
    attachChangeHandler(selectEl);
  }

  function attachChangeHandler(select){
    if (!select || select.dataset.bound === 'true') return;
    select.addEventListener('change', () => {
      const value = select.value || 'all';
      writeTeam(value);
      dispatchEvent(new StorageEvent('storage', {key: STORAGE_KEY}));
    });
    select.dataset.bound = 'true';
  }

  function boot(){
    Promise.resolve().then(() => {
      if (window.I18N?.onReady) {
        window.I18N.onReady(init);
      } else {
        init();
      }
    });
  }

  if (document.readyState !== 'loading') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }
})();
