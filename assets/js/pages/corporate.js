import { renderToolbar } from '../components/Toolbar.js';
import { renderTeamFilter } from '../components/TeamFilter.js';
import { ModeStore } from '../stores/modeStore.js';
import { AppState } from '../stores/appState.js';
import { mountCorporatePage } from '../corporate.js';

let corporateController = null;

function applyMode(mode){
  ModeStore.set(mode);
}

async function refreshPage(){
  if (!corporateController) {
    corporateController = mountCorporatePage();
  }
  if (corporateController?.refreshCorporatePage) {
    await corporateController.refreshCorporatePage();
  }
}

export async function bootstrapCorporatePage(){
  ModeStore.init();
  renderToolbar({
    mount: document.getElementById('toolbar'),
    title: 'Corporate',
    mode: ModeStore.mode,
    onModeChange: m => applyMode(m),
    controls: {
      ranges: ['Today','7 Days','Month to date','Quarter to date','Year to date'],
      showTeam: false,
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
