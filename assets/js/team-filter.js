(function(){
  const mount = document.getElementById('team-filter');
  if (!mount) return;

  const STORAGE_KEY = 'hr:team';
  let selectEl = null;
  let teams = [];

  init();

  async function init(){
    mount.classList.add('team-filter--loading');
    await loadTeams();
    render();
    mount.classList.remove('team-filter--loading');
    window.addEventListener('storage', evt => {
      if (!evt || evt.key !== STORAGE_KEY) return;
      syncFromStorage();
    });
    document.addEventListener('i18n:change', render);
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
      const data = await window.dataLoader.fetch('./data/org/teams.json');
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
      console.error('Failed to load teams', e);
      teams = [];
    }
  }

  function syncFromStorage(){
    if (!selectEl) return;
    const current = readTeam();
    selectEl.value = current;
  }

  function render(){
    const current = readTeam();
    mount.innerHTML = '';
    const label = document.createElement('label');
    label.className = 'team-filter__label';
    label.setAttribute('for', 'team-filter-select');
    label.textContent = window.t('label.teamFilter');

    selectEl = document.createElement('select');
    selectEl.id = 'team-filter-select';
    selectEl.className = 'team-filter__select';
    selectEl.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = window.t('label.team.all');
    selectEl.appendChild(allOption);

    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      selectEl.appendChild(option);
    });

    selectEl.value = current;
    selectEl.addEventListener('change', () => {
      const value = selectEl.value || 'all';
      writeTeam(value);
      dispatchEvent(new StorageEvent('storage', {key: STORAGE_KEY}));
    });

    mount.appendChild(label);
    mount.appendChild(selectEl);
  }
})();
