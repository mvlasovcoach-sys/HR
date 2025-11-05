import { renderToolbar } from '../components/Toolbar.js';
import { renderTeamFilter } from '../components/TeamFilter.js';
import { ModeStore } from '../stores/modeStore.js';
import { AppState } from '../stores/appState.js';

function applyMode(mode){
  ModeStore.set(mode);
}

async function refreshPage(){
  if (typeof window.refreshCorporatePage === 'function') {
    await window.refreshCorporatePage();
  }
}

async function initPage(){
  ModeStore.init();
  const params = new URLSearchParams(window.location.search);
  const queryMode = params.get('mode');
  const showTeamFilter = String(queryMode || ModeStore.mode || '').toLowerCase() === 'demo';
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Corporate',
    mode: ModeStore.mode,
    onModeChange: m => applyMode(m),
    controls: {
      ranges: ['Today','7 Days','Month to date','Quarter to date','Year to date'],
      showTeam: showTeamFilter,
      showDates: true,
      showCompare: true
    }
  });

  const filtersMount = document.getElementById('filters-bar');
  if (filtersMount) {
    const teamOptions = await AppState.getTeams();
    const currentTeams = Array.isArray(AppState.state.teams) ? AppState.state.teams : [];
    const validTeams = (() => {
      if (!teamOptions.length || !currentTeams.length) return currentTeams;
      const allowed = new Set(teamOptions.map(option => option.id));
      return currentTeams.filter(team => allowed.has(team));
    })();
    if (validTeams.length !== currentTeams.length) {
      AppState.setTeams(validTeams);
    }
    renderTeamFilter({
      mount: filtersMount,
      options: teamOptions,
      value: validTeams,
      onChange: vals => {
        AppState.setTeams(vals);
        refreshPage();
      }
    });
  }

  await refreshPage();
}

if (document.readyState !== 'loading') {
  initPage();
} else {
  document.addEventListener('DOMContentLoaded', initPage);
}
