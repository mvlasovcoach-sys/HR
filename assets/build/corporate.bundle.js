(function(){
  const modules = {
    'assets/js/components/Toolbar.js': function(require, module, exports) {
      function exportCurrentView(){
        const payload = window.__currentView || {};
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'export.json';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        requestAnimationFrame(() => {
          link.remove();
          URL.revokeObjectURL(url);
        });
      }
      
      function renderToolbar(options = {}) {
        const { mount, title, mode, onModeChange, onInfo } = options;
        const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
        if (!host) return;
        const resolvedMode = (mode || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
        const controls = options?.controls || {};
        const ranges = (Array.isArray(controls?.ranges) && controls.ranges.length)
          ? controls.ranges
          : ['Today', '7 Days', 'Month to date', 'Quarter to date', 'Year to date'];
        const showRanges = controls?.showRanges !== false;
        const showTeam = controls?.showTeam !== false;
        const showDates = controls?.showDates !== false;
        host.innerHTML = `
        <div class="toolbar">
          <div id="tb-quick" class="seg-group" role="group" aria-label="Quick ranges">
            ${showRanges ? ranges.map(r => `<button class="seg" data-range="${r}">${r}</button>`).join('') : ''}
          </div>
          <div id="tb-mode" class="seg-group" role="tablist" aria-label="Mode">
            <button id="btnModeDemo" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='DEMO'}">Demo</button>
            <button id="btnModeLive" class="seg" type="button" role="tab" aria-selected="${resolvedMode==='LIVE'}">Live</button>
          </div>
          <div id="tb-team" class="team-slot"${showTeam ? '' : ' hidden'}>${showTeam ? '<div id="teamSelect"></div>' : ''}</div>
          <div id="tb-dates"${showDates ? '' : ' hidden'}>
            <div class="field" data-date-slot="start"></div>
            <div class="field" data-date-slot="end"></div>
          </div>
          <div id="tb-compare" data-compare-slot></div>
        </div>`;
      
        const pageHeader = document.querySelector('.page-header');
        const headerTitle = pageHeader?.querySelector('.page-title');
        if (headerTitle && title) {
          headerTitle.textContent = title;
        }
      
        const infoBtn = document.getElementById('page-info');
        if (infoBtn) {
          infoBtn.type = 'button';
          infoBtn.setAttribute('aria-label', 'About this page');
          infoBtn.hidden = false;
          infoBtn.onclick = typeof onInfo === 'function' ? onInfo : null;
        }
      
        const headerLangSwitch = document.querySelector('#header-actions .lang-switch');
        setupLangSwitch(headerLangSwitch);
      
        const exportBtn = document.getElementById('tb-export');
        if (exportBtn && exportBtn.dataset.bound !== 'true') {
          exportBtn.dataset.bound = 'true';
          exportBtn.addEventListener('click', exportCurrentView);
        }
      
        const demo = host.querySelector('#btnModeDemo');
        const live = host.querySelector('#btnModeLive');
        const quickHost = host.querySelector('#tb-quick');
        if (quickHost && !showRanges) {
          quickHost.hidden = true;
          quickHost.setAttribute('aria-hidden', 'true');
        }
        const teamHost = host.querySelector('#tb-team');
        if (teamHost && !showTeam) {
          teamHost.setAttribute('aria-hidden', 'true');
        }
        const datesHost = host.querySelector('#tb-dates');
        if (datesHost && !showDates) {
          datesHost.setAttribute('aria-hidden', 'true');
        }
      
        const toolbarEl = host.querySelector('.toolbar');
        if (toolbarEl && datesHost) {
          toolbarEl.appendChild(datesHost);
        }
      
        const compareSlot = host.querySelector('#tb-compare');
        if (compareSlot) {
          compareSlot.innerHTML = '';
        }
      
        const updateSelected = value => {
          const next = value === 'LIVE' ? 'LIVE' : 'DEMO';
          if (demo) demo.setAttribute('aria-selected', String(next === 'DEMO'));
          if (live) live.setAttribute('aria-selected', String(next === 'LIVE'));
        };
      
        if (demo) {
          demo.addEventListener('click', () => {
            updateSelected('DEMO');
            onModeChange?.('DEMO');
          });
        }
        if (live) {
          live.addEventListener('click', () => {
            updateSelected('LIVE');
            onModeChange?.('LIVE');
          });
        }
      }
      
      function setupLangSwitch(container) {
        if (!container || container.dataset.bound === 'true') return;
        container.dataset.bound = 'true';
        const buttons = Array.from(container.querySelectorAll('button[data-lang]'));
        if (!buttons.length) return;
      
        const normalise = value => String(value || '').toLowerCase();
      
        const updateActive = lang => {
          const resolved = normalise(lang) || 'en';
          buttons.forEach(btn => {
            const isActive = normalise(btn.dataset.lang) === resolved;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
          });
        };
      
        const updateLabel = () => {
          const label = window.I18N?.t?.('label.language');
          container.setAttribute('aria-label', label || 'Language');
        };
      
        const apply = lang => {
          const target = normalise(lang) || 'en';
          const run = resolved => {
            const next = normalise(resolved) || target;
            updateActive(next);
            document.dispatchEvent(new CustomEvent('language:changed', { detail: { lang: next } }));
          };
      
          try {
            const upperTarget = target.toUpperCase();
            localStorage.setItem('demo-lang', upperTarget);
            localStorage.setItem('lang', target);
            localStorage.setItem('hr:lang', target);
          } catch (err) {
            /* storage optional */
          }
      
          if (typeof window.I18N?.setLang === 'function') {
            Promise.resolve(window.I18N.setLang(target))
              .then(() => run(window.I18N?.getLang?.()))
              .catch(() => run(window.I18N?.getLang?.() || target));
          } else if (typeof window.I18N?.set === 'function') {
            try {
              window.I18N.set(target);
            } catch (err) {
              /* noop */
            }
            run(window.I18N?.getLang?.() || target);
          } else {
            run(target);
          }
        };
      
        const saved = (() => {
          try {
            return normalise(
              localStorage.getItem('demo-lang')
              || localStorage.getItem('lang')
              || localStorage.getItem('hr:lang')
              || window.I18N?.getLang?.()
            );
          } catch (err) {
            return normalise(window.I18N?.getLang?.());
          }
        })() || 'en';
      
        updateLabel();
        updateActive(saved);
        apply(saved);
      
        container.addEventListener('click', event => {
          const btn = event.target?.closest?.('button[data-lang]');
          if (!btn) return;
          const lang = normalise(btn.dataset.lang);
          if (!lang || btn.classList.contains('is-active')) {
            return;
          }
          apply(lang);
        });
      
        window.addEventListener('i18n:change', evt => {
          const lang = normalise(evt?.detail?.lang || window.I18N?.getLang?.() || saved);
          updateActive(lang);
          updateLabel();
        });
      }
      
      exports.exportCurrentView = exportCurrentView;
      exports.renderToolbar = renderToolbar;
    },
    'assets/js/components/TeamFilter.js': function(require, module, exports) {
      function renderTeamFilter({ mount, options, value = [], onChange }) {
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
        <div id="toolbar-team-filter" class="team-filter">
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
      
        function placePanel(btnRect) {
          const pad = 8;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const ph = panel.offsetHeight || 280;
          const pw = panel.offsetWidth || 320;
      
          let left = Math.min(Math.max(pad, btnRect.left), vw - pad - pw);
          let top = btnRect.bottom + 6;
      
          if (top + ph > vh - pad) {
            top = Math.max(pad, btnRect.top - ph - 6);
          }
      
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
        }
      
        function openPanel() {
          if (!panel) return;
      
          if (!inPortal && portal) {
            portal.appendChild(panel);
            inPortal = true;
          }
      
          panel.classList.add('portal');
          panel.hidden = false;
          control?.setAttribute('aria-expanded', 'true');
          btn.setAttribute('aria-expanded', 'true');
      
          if (search) {
            search.value = '';
          }
          renderList('');
      
          requestAnimationFrame(() => {
            const br = btn.getBoundingClientRect();
            placePanel(br);
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
          if (!panel.hidden && !panel.contains(event.target) && !btn.contains(event.target)) {
            closePanel();
          }
        });
      
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape' && !panel.hidden) {
            closePanel({ focusButton: true });
          }
        });
      
        ['scroll', 'resize'].forEach(ev => {
          window.addEventListener(
            ev,
            () => {
              if (!panel.hidden) {
                const br = btn.getBoundingClientRect();
                placePanel(br);
              }
            },
            { passive: true }
          );
        });
      
        sync({ notify: false, refreshList: true });
      }
      
      exports.renderTeamFilter = renderTeamFilter;
    },
    'assets/js/stores/modeStore.js': function(require, module, exports) {
      const ModeStore = {
        mode: 'DEMO',
        init() {
          const query = new URLSearchParams(location.search).get('mode');
          const stored = localStorage.getItem('spa2099_mode');
          this.mode = (query?.toUpperCase() || stored?.toUpperCase() || 'DEMO');
        },
        set(mode) {
          this.mode = mode;
          localStorage.setItem('spa2099_mode', mode);
          const searchParams = new URLSearchParams(location.search);
          searchParams.set('mode', mode.toLowerCase());
          history.replaceState(null, '', `${location.pathname}?${searchParams}`);
        }
      };
      
      exports.ModeStore = ModeStore;
      exports.init() {
          const query = init() {
          const query;
    },
    'assets/js/utils/env.js': function(require, module, exports) {
      const host = typeof location === 'object' && location ? location.host : '';
      const __DEV__ = !/github\.io$/i.test(host);
      
      function devError(...args) {
        if (!__DEV__) return;
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error(...args);
        }
      }
      
      function devWarn(...args) {
        if (!__DEV__) return;
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(...args);
        }
      }
      
      if (typeof globalThis !== 'undefined') {
        globalThis.__DEV__ = __DEV__;
        globalThis.devError = devError;
        globalThis.devWarn = devWarn;
      }
      
      exports.devError = devError;
      exports.devWarn = devWarn;
      exports.__DEV__ = __DEV__;
    },
    'assets/js/stores/appState.js': function(require, module, exports) {
      const { devError } = require('assets/js/utils/env.js');
      
      const TEAM_KEY = 'hr:team';
      const TEAMS_KEY = 'hr:teams';
      const TEAM_NAMES_KEY = 'hr:team:names';
      const DATA_PATH = './data/org/teams.json';
      
      const loaderGlobals = window.loaderGlobals || {};
      const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : url => url;
      const loadJson = typeof loaderGlobals.fetchJson === 'function'
        ? loaderGlobals.fetchJson
        : async url => {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.status === 404) return null;
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} for ${url}`);
            }
            return response.json();
          };
      
      function readStoredTeams(){
        try {
          const rawList = localStorage.getItem(TEAMS_KEY);
          if (rawList) {
            const parsed = JSON.parse(rawList);
            if (Array.isArray(parsed)) {
              return parsed.map(value => String(value)).filter(Boolean);
            }
          }
          const single = localStorage.getItem(TEAM_KEY);
          if (single && single !== 'all') {
            return [String(single)];
          }
        } catch (err) {
          /* storage optional */
        }
        return [];
      }
      
      async function fetchTeams(){
        const url = new URL(DATA_PATH, document.baseURI);
        try {
          const data = await loadJson(applyVersion(url.toString()));
          const list = Array.isArray(data?.depts) ? data.depts : [];
          const options = list.map(item => ({
            id: String(item?.id ?? ''),
            label: item?.name || String(item?.id ?? '')
          })).filter(option => option.id);
          const nameMap = options.reduce((acc, option) => {
            acc[option.id] = option.label;
            return acc;
          }, {});
          try {
            localStorage.setItem(TEAM_NAMES_KEY, JSON.stringify(nameMap));
          } catch (err) {
            /* ignore */
          }
          return options;
        } catch (err) {
          devError('Failed to load teams', err);
          return [];
        }
      }
      
      function arraysEqual(a = [], b = []){
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }
      
      function normaliseTeams(values){
        if (!Array.isArray(values) || !values.length) return [];
        const seen = new Set();
        const output = [];
        values.forEach(value => {
          const id = String(value ?? '');
          if (!id) return;
          if (seen.has(id)) return;
          seen.add(id);
          output.push(id);
        });
        return output;
      }
      
      const state = {
        teams: readStoredTeams(),
        teamOptions: [],
        allTeamsIds: []
      };
      
      let teamsPromise = null;
      
      const AppState = {
        state,
        async getTeams(){
          if (Array.isArray(state.teamOptions) && state.teamOptions.length) {
            return state.teamOptions;
          }
          if (!teamsPromise) {
            teamsPromise = fetchTeams().then(options => {
              state.teamOptions = options;
              state.allTeamsIds = Array.isArray(options) ? options.map(option => option.id) : [];
              return options;
            }).catch(err => {
              devError('Teams request failed', err);
              return [];
            });
          }
          const options = await teamsPromise;
          return Array.isArray(options) ? options : [];
        },
        setTeams(nextValues){
          const normalised = normaliseTeams(nextValues);
          if (arraysEqual(state.teams, normalised)) {
            return;
          }
          state.teams = normalised;
          try {
            if (normalised.length) {
              localStorage.setItem(TEAMS_KEY, JSON.stringify(normalised));
              localStorage.setItem(TEAM_KEY, normalised[0]);
            } else {
              localStorage.removeItem(TEAMS_KEY);
              localStorage.setItem(TEAM_KEY, 'all');
            }
          } catch (err) {
            /* storage optional */
          }
          const primary = normalised[0] || 'all';
          try {
            const evt = new StorageEvent('storage', { key: TEAM_KEY, newValue: primary });
            window.dispatchEvent(evt);
          } catch (err) {
            /* dispatch optional */
          }
        },
        getActiveTeams(){
          return Array.isArray(state.teams) && state.teams.length
            ? state.teams
            : state.allTeamsIds;
        }
      };
      
      exports.AppState = AppState;
      exports.async getTeams(){
          if (Array.isArray(state.teamOptions) && state.teamOptions.length) {
            return state.teamOptions = async getTeams(){
          if (Array.isArray(state.teamOptions) && state.teamOptions.length) {
            return state.teamOptions;
    },
    'assets/js/corporate.js': function(require, module, exports) {
      const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
      const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
      
      function initCorporatePage(){
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
        const DATA_ROOT = './data/org';
      
        const els = {
          caption: document.getElementById('global-caption'),
          kpiPanel: document.getElementById('corp-kpis'),
          kpiGrid: document.getElementById('corp-kpi-grid'),
          heatmapPanel: document.getElementById('corp-heatmap'),
          heatmapGrid: document.getElementById('heatmap-grid'),
          eventsPanel: document.getElementById('corp-events'),
          eventsList: document.getElementById('events-list'),
          eventTeam: document.getElementById('f-team'),
          eventSeverity: document.getElementById('f-sev'),
          eventType: document.getElementById('f-type'),
          eventBadges: document.getElementById('event-badges'),
          eventCount: document.getElementById('ev-count'),
          eventCritical: document.getElementById('ev-crit'),
          eventWarning: document.getElementById('ev-warn'),
          eventInfo: document.getElementById('ev-info'),
          activityPanel: document.getElementById('corp-activity'),
          activityTable: document.getElementById('activity-table'),
          activityCards: document.getElementById('activity-cards'),
          exportBtn: document.getElementById('export-activity'),
          scenarioButtons: Array.from(document.querySelectorAll('.scenario-controls [data-scenario]')),
          fatigueCard: document.getElementById('fatigue-today-card')
        };
      
        ensureToolbarFilters();
      
        function ensureToolbarFilters(){
          if (!els.eventTeam) {
            const slot = document.getElementById('teamSelect');
            if (slot) {
              const select = document.createElement('select');
              select.id = 'f-team';
              select.multiple = true;
              select.setAttribute('aria-label', 'All teams');
              slot.appendChild(select);
              els.eventTeam = select;
            }
          }
      
          if (!els.eventSeverity || !els.eventType) {
            const header = els.eventsPanel?.querySelector('.panel__head');
            if (header) {
              let container = header.querySelector('.event-filter-inline');
              if (!container) {
                container = document.createElement('div');
                container.className = 'event-filter-inline';
                header.appendChild(container);
              }
              if (!els.eventSeverity) {
                const select = document.createElement('select');
                select.id = 'f-sev';
                select.setAttribute('aria-label', 'All severities');
                container.appendChild(select);
                els.eventSeverity = select;
              }
              if (!els.eventType) {
                const select = document.createElement('select');
                select.id = 'f-type';
                select.setAttribute('aria-label', 'All types');
                container.appendChild(select);
                els.eventType = select;
              }
            }
          }
        }
      
        if (!els.kpiGrid || !els.heatmapGrid || !els.eventsList || !els.activityTable) {
          return {
            refreshCorporatePage: async () => {}
          };
        }
      
        function readMode(){
          try {
            const params = new URLSearchParams(window.location.search || '');
            const query = params.get('mode');
            if (query && typeof query === 'string') {
              const lower = query.toLowerCase();
              if (lower === 'demo') return 'demo';
              if (lower === 'live') return 'live';
            }
          } catch (err) {
            /* ignore malformed query */
          }
          try {
            const stored = localStorage.getItem('spa2099_mode')
              || localStorage.getItem('mode')
              || localStorage.getItem('hr:mode');
            if (stored && typeof stored === 'string') {
              const lower = stored.toLowerCase();
              if (lower === 'demo') return 'demo';
              if (lower === 'live') return 'live';
            }
          } catch (err) {
            /* storage optional */
          }
          return 'live';
        }
      
        const state = {
          teams: [],
          teamMap: new Map(),
          teamSelection: readTeamSelection(),
          rangeSelection: readRangeSelection(),
          rangeKey: null,
          rangeLabel: '',
          dataRangeKey: '7d',
          rangeWindow: null,
          metrics: null,
          events: [],
          eventFilterTeams: new Set(),
          eventFilterSeverity: '',
          eventFilterType: '',
          eventsDateFilter: null,
          heatmapCells: [],
          heatmapColumns: [],
          heatmapDates: [],
          selectedColumn: null,
          activityCsvRows: [],
          activitySort: {key: 'date', dir: 'desc'},
          insufficient: false,
          todayKpi: null,
          todayMode: readMode()
        };
      
        const SEVERITIES = ['critical', 'warning', 'info'];
      
        const t = (key, fallback, vars) => {
          try {
            const translated = window.I18N?.t?.(key, vars);
            if (typeof translated === 'string' && translated && translated !== key) {
              return translated;
            }
          } catch (err) {
            // ignore translation errors
          }
          if (typeof fallback === 'function') return fallback(vars);
          if (typeof fallback === 'string') return fallback;
          return key.replace(/^label\.|^range\./, '');
        };
      
        const FATIGUE_KEYS = ['fatigue', 'tiredness', 'kpi_fatigue'];
      
        async function safeJson(response){
          try {
            return await response.json();
          } catch (err) {
            devWarn('KPI payload parse failed', err);
            return {};
          }
        }
      
        async function fetchKpiToday(mode){
          const target = mode === 'demo' ? 'data/demo/kpi_today.json' : '/api/kpi?period=today';
          const response = await fetch(target, {cache: 'no-store'});
          if (!response.ok) {
            if (mode === 'demo') {
              throw new Error(`Demo KPI dataset missing (${response.status})`);
            }
            return {};
          }
          return await safeJson(response);
        }
      
        function pickFirstMetric(raw, keys){
          if (!raw || typeof raw !== 'object') return null;
          for (const key of keys) {
            if (!key) continue;
            const value = raw[key];
            if (value === 0) return 0;
            if (typeof value === 'number' && !Number.isNaN(value)) {
              return value;
            }
          }
          return null;
        }
      
        function mapFatigueBundle(raw, source){
          const safeRaw = raw && typeof raw === 'object' ? raw : {};
          const updatedAt = typeof safeRaw.updatedAt === 'string' && safeRaw.updatedAt
            ? safeRaw.updatedAt
            : new Date().toISOString();
          const value = pickFirstMetric(safeRaw, FATIGUE_KEYS);
          const delta = pickFirstMetric(safeRaw, FATIGUE_KEYS.map(key => `${key}_delta`));
          let trend;
          if (typeof safeRaw.fatigue_trend === 'string' && safeRaw.fatigue_trend.trim()) {
            trend = safeRaw.fatigue_trend;
          } else if (typeof safeRaw.tiredness_trend === 'string' && safeRaw.tiredness_trend.trim()) {
            trend = safeRaw.tiredness_trend;
          }
          return {
            fatigue: {
              value: value == null ? null : Math.round(value),
              delta: delta == null ? null : Math.round(delta),
              trend,
              updatedAt,
              source,
            },
            raw: safeRaw,
            source,
            updatedAt,
          };
        }
      
        async function loadKpiTodayData(){
          const mode = readMode();
          state.todayMode = mode;
          try {
            const raw = await fetchKpiToday(mode);
            state.todayKpi = mapFatigueBundle(raw, mode);
          } catch (err) {
            devWarn('Today KPI load failed', err);
            state.todayKpi = mapFatigueBundle({}, mode);
          }
        }
      
        function fatigueSeverity(value){
          if (value == null || Number.isNaN(value)) return 'neutral';
          if (value <= 55) return 'green';
          if (value <= 69) return 'amber';
          return 'red';
        }
      
        function fatigueBadge(severity, hasValue){
          if (!hasValue) return t('status.noData', 'No data');
          if (severity === 'green') return t('status.low', 'Low');
          if (severity === 'amber') return t('status.monitor', 'Monitor');
          if (severity === 'red') return t('status.critical', 'High');
          return t('status.monitor', 'Monitor');
        }
      
        function fatigueBadgeClass(severity, hasValue){
          if (!hasValue) return 'pill--neutral';
          if (severity === 'green') return 'pill--strong';
          if (severity === 'amber') return 'pill--caution';
          if (severity === 'red') return 'pill--critical';
          return 'pill--neutral';
        }
      
        function trendArrow(direction){
          if (direction === 'up') return '↑';
          if (direction === 'down') return '↓';
          if (direction === 'flat') return '→';
          return '→';
        }
      
        function formatTrendText(value){
          if (!value) {
            return `${t('trend.label', 'Trend')}: ${t('trend.na', '—')}`;
          }
          const dir = value === 'down' ? 'down' : value === 'up' ? 'up' : 'flat';
          const label = dir === 'up'
            ? t('trend.up', 'Up')
            : dir === 'down'
              ? t('trend.down', 'Down')
              : t('trend.flat', 'Stable');
          return `${t('trend.label', 'Trend')}: ${trendArrow(dir)} ${label}`;
        }
      
        function formatUpdatedText(iso){
          if (!iso || typeof iso !== 'string') {
            return `${t('status.updated', 'Updated')}: —`;
          }
          const label = formatDateTime(iso);
          if (!label) {
            return `${t('status.updated', 'Updated')}: —`;
          }
          return `${t('status.updated', 'Updated')}: ${label}`;
        }
      
        boot().catch(err => devError('Corporate init failed', err));
      
        function displayPreset(value){
          const key = String(value || '').toLowerCase();
          if (key === 'today' || key === 'day') return 'today';
          if (key === 'mtd' || key === 'month') return 'mtd';
          if (key === 'qtd' || key === 'quarter') return 'qtd';
          if (key === 'ytd' || key === 'year') return 'ytd';
          if (key === '7d') return '7d';
          return '7d';
        }
      
        async function boot(){
          await loadTeams();
          setupEventFilters();
          await loadEvents();
          await loadMetrics();
          bindEvents();
          updateScenarioButtons();
          updateCaption();
          renderAll();
        }
      
        function bindEvents(){
          els.eventTeam?.addEventListener('change', () => {
            const selected = Array.from(els.eventTeam.selectedOptions || []).map(opt => opt.value).filter(Boolean);
            state.eventFilterTeams = new Set(selected);
            renderEvents();
          });
      
          els.eventSeverity?.addEventListener('change', () => {
            state.eventFilterSeverity = els.eventSeverity.value || '';
            renderEvents();
          });
      
          els.eventType?.addEventListener('change', () => {
            state.eventFilterType = els.eventType.value || '';
            renderEvents();
          });
      
          els.exportBtn?.addEventListener('click', exportActivity);
          els.activityTable?.addEventListener('click', handleActivitySortClick);
      
          window.addEventListener('storage', handleStorageEvent);
          document.addEventListener('i18n:change', handleI18nChange);
      
          els.scenarioButtons.forEach(btn => {
            btn.addEventListener('click', () => {
              const mode = btn.getAttribute('data-scenario');
              if (mode === 'night' || mode === 'live') {
                setScenario(mode);
              }
            });
          });
        }
      
        async function loadTeams(){
          try {
            const data = await fetchJson(`${DATA_ROOT}/teams.json`);
            const list = Array.isArray(data?.depts) ? data.depts : [];
            state.teams = list;
            state.teamMap = new Map(list.map(item => [item.id, item.name || item.id]));
          } catch (err) {
            devError('Teams load failed', err);
            state.teams = [];
            state.teamMap = new Map();
          }
        }
      
        function setupEventFilters(){
          if (els.eventTeam) {
            els.eventTeam.innerHTML = '';
            els.eventTeam.setAttribute('aria-label', t('events.filter.teamAll', 'Filter events by team'));
            state.teams.forEach(team => {
              const option = document.createElement('option');
              option.value = team.id;
              option.textContent = team.name || team.id;
              if (state.teamSelection !== 'all' && team.id === state.teamSelection) {
                option.selected = true;
              }
              els.eventTeam.appendChild(option);
            });
            if (state.teamSelection !== 'all') {
              state.eventFilterTeams = new Set([state.teamSelection]);
            }
          }
          if (els.eventSeverity) {
            const current = state.eventFilterSeverity || '';
            const options = document.createDocumentFragment();
            const all = document.createElement('option');
            all.value = '';
            all.textContent = t('events.filter.severityAll', 'All severities');
            options.appendChild(all);
            SEVERITIES.forEach(level => {
              const option = document.createElement('option');
              option.value = level;
              option.textContent = t(`events.severity.${level}`, level.toUpperCase());
              if (level === current) option.selected = true;
              options.appendChild(option);
            });
            els.eventSeverity.innerHTML = '';
            els.eventSeverity.appendChild(options);
            const hasOption = Array.from(els.eventSeverity.options || []).some(opt => opt.value === current);
            els.eventSeverity.value = hasOption ? current : '';
            state.eventFilterSeverity = els.eventSeverity.value || '';
          }
          if (els.eventType) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = t('events.filter.typeAll', 'All types');
            els.eventType.innerHTML = '';
            els.eventType.appendChild(placeholder);
          }
        }
      
        async function loadEvents(){
          try {
            const data = await fetchJson(`${DATA_ROOT}/events.json`);
            state.events = Array.isArray(data) ? data.map(event => ({...event})) : [];
          } catch (err) {
            devError('Events load failed', err);
            state.events = [];
          }
        }
      
        async function loadMetrics(){
          state.rangeSelection = readRangeSelection();
          const {dataKey, label, rangeKey} = resolveRangeConfig(state.rangeSelection);
          const scenario = readScenario();
          const effectiveKey = scenario === 'night' ? '7d' : dataKey;
          state.dataRangeKey = effectiveKey;
          state.rangeLabel = scenario === 'night' ? (window.I18N?.t('range.7d') || '7 Days') : label;
          state.rangeKey = scenario === 'night' ? '7d' : rangeKey;
          try {
            const metrics = await fetchJson(`${DATA_ROOT}/metrics_${effectiveKey}.json`);
            state.metrics = metrics;
            const nVal = Number(metrics?.n);
            state.insufficient = Number.isFinite(nVal) && nVal < 5;
            const heatmap = metrics?.heatmap || {};
            state.heatmapColumns = Array.isArray(heatmap.cols) ? heatmap.cols : [];
            state.heatmapDates = Array.isArray(heatmap.dates) ? heatmap.dates : [];
            if (state.selectedColumn && state.selectedColumn.index >= state.heatmapColumns.length) {
              state.selectedColumn = null;
              state.eventsDateFilter = null;
            }
            state.rangeWindow = resolveRangeWindow(metrics);
            if (state.rangeKey === 'today') {
              await loadKpiTodayData();
            } else {
              state.todayKpi = null;
            }
            mapEventsToColumns();
            buildEventTypeOptions();
          } catch (err) {
            devError('Metrics load failed', err);
            state.metrics = null;
            state.insufficient = false;
            state.heatmapColumns = [];
            state.heatmapDates = [];
            state.rangeWindow = null;
            state.activityCsvRows = [];
            state.selectedColumn = null;
            state.eventsDateFilter = null;
            state.todayKpi = null;
          }
        }
      
        function resolveRangeWindow(metrics){
          const heatmapDates = Array.isArray(metrics?.heatmap?.dates) ? metrics.heatmap.dates : [];
          if (heatmapDates.length) {
            return {start: heatmapDates[0], end: heatmapDates[heatmapDates.length - 1]};
          }
          const activity = Array.isArray(metrics?.activity) ? metrics.activity : [];
          if (!activity.length) return null;
          const sorted = activity.map(row => row?.date).filter(Boolean).sort();
          if (!sorted.length) return null;
          return {start: sorted[0], end: sorted[sorted.length - 1]};
        }
      
        function mapEventsToColumns(){
          const columns = state.heatmapColumns;
          const dates = state.heatmapDates;
          state.events.forEach(evt => {
            const eventDate = toDateString(evt.ts);
            let colIndex = -1;
            if (eventDate && dates.length) {
              colIndex = dates.indexOf(eventDate);
            }
            if (colIndex < 0 && typeof evt.col === 'number' && evt.col >= 0 && evt.col < columns.length) {
              colIndex = evt.col;
            }
            evt._colIndex = colIndex >= 0 ? colIndex : null;
            evt._colLabel = colIndex >= 0 ? columns[colIndex] : null;
            evt._colDate = colIndex >= 0 ? (dates[colIndex] || null) : eventDate;
          });
        }
      
        function buildEventTypeOptions(){
          if (!els.eventType) return;
          const types = new Set();
          state.events.forEach(evt => {
            if (evt?.type) types.add(evt.type);
          });
          const current = els.eventType.value || '';
          els.eventType.innerHTML = '';
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = t('events.filter.typeAll', 'All types');
          els.eventType.appendChild(placeholder);
          Array.from(types).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === current) option.selected = true;
            els.eventType.appendChild(option);
          });
          state.eventFilterType = els.eventType.value || '';
        }
      
        function renderAll(){
          toggleInsufficientOverlays();
          try { renderKpis(state.metrics?.kpi, state.metrics?.delta, state.metrics?.n); } catch (err) { devError('KPI', err); }
          try { renderFatigueTodayCard(); } catch (err) { devError('KPI:Fatigue', err); }
          try { renderHeatmap(state.metrics?.heatmap); } catch (err) { devError('Heatmap', err); }
          try { renderEvents(state.events); } catch (err) { devError('Events', err); }
          try { renderActivity(state.metrics?.activity); } catch (err) { devError('Activity', err); }
          updateCaption();
        }
      
        function renderFatigueTodayCard(){
          const host = els.fatigueCard;
          if (!host) return;
          const isToday = state.rangeKey === 'today';
          host.classList.toggle('is-hidden', !isToday);
          if (!isToday) {
            host.innerHTML = '';
            return;
          }
          const metric = state.todayKpi?.fatigue || null;
          const rawValue = metric?.value;
          const hasValue = typeof rawValue === 'number' && Number.isFinite(rawValue);
          const value = hasValue ? Math.max(0, Math.min(100, Math.round(rawValue))) : null;
          const severity = fatigueSeverity(value);
          const badge = fatigueBadge(severity, hasValue);
          const badgeClass = fatigueBadgeClass(severity, hasValue);
          const valueText = value == null ? '—' : `${value}%`;
          const rawDelta = metric?.delta;
          const hasDelta = typeof rawDelta === 'number' && Number.isFinite(rawDelta);
          const deltaValue = hasDelta ? Math.round(rawDelta) : null;
          const deltaText = deltaValue == null ? 'Δ —' : `Δ ${deltaValue > 0 ? '+' : ''}${deltaValue} pts`;
          const trendText = formatTrendText(metric?.trend);
          const updatedText = formatUpdatedText(metric?.updatedAt);
          host.innerHTML = `
            <div class="tile tile--compact trend-card" data-fatigue-card data-tone="${severity}">
              <header class="tile__head">
                <span class="tile__title">${t('metric.fatigue', 'Fatigue')}</span>
                <span class="tile__badge pill ${badgeClass}">${badge}</span>
              </header>
              <div class="tile__foot trend-footer">
                <span class="trend-score">${valueText}</span>
                <span class="trend-count">${deltaText}</span>
              </div>
              <div class="tile__meta trend-meta">
                <span>${trendText}</span>
                <span>${updatedText}</span>
              </div>
            </div>
          `;
        }
      
        function toggleInsufficientOverlays(){
          const panels = [els.kpiPanel, els.heatmapPanel, els.eventsPanel, els.activityPanel];
          panels.forEach(panel => {
            if (!panel) return;
            if (state.insufficient) {
              panel.setAttribute('data-insufficient', 'true');
              panel.setAttribute('data-guard-message', t('guard.insufficient', 'Insufficient group size'));
            } else {
              panel.removeAttribute('data-insufficient');
              panel.removeAttribute('data-guard-message');
            }
          });
        }
      
        function renderHeatmap(heatmap){
          const grid = els.heatmapGrid;
          if (!grid) return;
          if (!heatmap || !Array.isArray(heatmap.rows) || !Array.isArray(heatmap.cols)) {
            grid.innerHTML = `<p class="caption">${t('heatmap.empty', 'No heatmap data')}</p>`;
            state.heatmapCells = [];
            return;
          }
      
          const rows = heatmap.rows;
          const cols = heatmap.cols;
          const values = heatmap.value || {};
          const dates = Array.isArray(heatmap.dates) ? heatmap.dates : [];
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
      
            const rowValues = Array.isArray(values?.[rowId]) ? values[rowId] : [];
            cols.forEach((label, colIndex) => {
              const raw = rowValues[colIndex];
              const cell = document.createElement('div');
              cell.className = 'heatmap-cell';
              cell.setAttribute('role', 'gridcell');
              cell.tabIndex = 0;
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
                cell.setAttribute('aria-label', cellAriaLabel(teamLabel, rounded));
              } else {
                cell.textContent = '—';
                cell.removeAttribute('data-level');
                cell.removeAttribute('data-value');
                cell.setAttribute('aria-label', cellAriaLabel(teamLabel, null));
              }
              cell.addEventListener('click', () => {
                handleHeatmapSelection(colIndex);
              });
              cell.addEventListener('keydown', evt => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                  evt.preventDefault();
                  handleHeatmapSelection(colIndex);
                }
              });
              fragment.appendChild(cell);
            });
          });
      
          grid.innerHTML = '';
          grid.appendChild(fragment);
          state.heatmapCells = Array.from(grid.querySelectorAll('.heatmap-cell[role="gridcell"]'));
          if (state.selectedColumn?.index != null) {
            updateHeatmapHighlight(state.selectedColumn.index);
          }
        }
      
        function heatmapLevel(value){
          if (!Number.isFinite(value)) return '';
          if (value <= 55) return 'low';
          if (value <= 69) return 'mid';
          return 'high';
        }
      
        function bandFor(value){
          if (!Number.isFinite(value)) return '';
          if (value >= 70) return 'red';
          if (value >= 56) return 'amber';
          return 'green';
        }
      
        function cellAriaLabel(team, value){
          const stressLabel = t('aria.stressIndex', 'stress index');
          const name = team || '';
          if (!Number.isFinite(value)) {
            return `Team ${name} — ${t('status.noData', 'No data')} — ${stressLabel}`;
          }
          const rounded = Math.round(value);
          return `Team ${name} — ${rounded} (${bandFor(rounded)}) — ${stressLabel}`;
        }
      
        function handleHeatmapSelection(index){
          const same = state.selectedColumn && state.selectedColumn.index === index;
          if (same) {
            setSelectedColumn(null, {updateFilter: true});
          } else {
            setSelectedColumn(index, {updateFilter: true});
            scrollEventsPanel();
          }
        }
      
        function setSelectedColumn(index, options={}){
          const {updateFilter = true} = options;
          if (index == null || index < 0 || index >= state.heatmapColumns.length) {
            state.selectedColumn = null;
            updateHeatmapHighlight(null);
            if (updateFilter) {
              state.eventsDateFilter = null;
              renderEvents();
            }
            return;
          }
          state.selectedColumn = {
            index,
            label: state.heatmapColumns[index],
            date: state.heatmapDates[index] || null
          };
          updateHeatmapHighlight(index);
          if (updateFilter) {
            state.eventsDateFilter = {label: state.selectedColumn.label, date: state.selectedColumn.date};
            renderEvents();
          }
        }
      
        function updateHeatmapHighlight(index){
          state.heatmapCells.forEach(cell => {
            const col = Number(cell.dataset.colIndex);
            cell.classList.toggle('is-highlighted', index != null && col === index);
          });
          const headers = els.heatmapGrid?.querySelectorAll('.heatmap-cell[role="columnheader"]');
          headers?.forEach(header => {
            const col = Number(header.dataset.colIndex);
            header?.classList.toggle('is-highlighted', index != null && col === index);
          });
        }
      
        function renderEvents(events){
          const list = els.eventsList;
          if (!list) return;
          const items = Array.isArray(events) ? events.slice() : [];
          const filtered = applyEventFilters(items, state.eventsDateFilter);
      
          list.innerHTML = '';
      
          if (state.eventsDateFilter) {
            const note = document.createElement('div');
            note.className = 'event-filter-note';
            const label = state.eventsDateFilter.label || formatDateLabel(state.eventsDateFilter.date);
            note.textContent = t('events.filteredBy', {label});
            list.appendChild(note);
          }
      
          if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'caption';
            const hasFilters = state.eventFilterTeams.size || state.eventFilterSeverity || state.eventFilterType || state.eventsDateFilter;
            empty.textContent = hasFilters
              ? t('events.emptyFiltered', 'Filters returned no events.')
              : t('events.empty', 'No detection events in this range.');
            list.appendChild(empty);
            return;
          }
      
          filtered.sort((a, b) => {
            const da = a.ts ? new Date(a.ts).getTime() : 0;
            const db = b.ts ? new Date(b.ts).getTime() : 0;
            return db - da;
          });
      
          filtered.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.tabIndex = 0;
            if (Number.isInteger(evt._colIndex)) {
              item.dataset.colIndex = String(evt._colIndex);
            }
            const timestamp = document.createElement('time');
            timestamp.dateTime = evt.ts || '';
            timestamp.textContent = formatDateTime(evt.ts);
      
            const body = document.createElement('div');
            const header = document.createElement('div');
            header.className = 'event-header';
            const severity = document.createElement('span');
            severity.className = severityClass(evt.severity);
            severity.textContent = t(`events.severity.${evt.severity || 'info'}`, (evt.severity || 'info').toUpperCase());
      
            const title = document.createElement('strong');
            title.textContent = evt.type || 'Event';
            header.appendChild(title);
            header.appendChild(severity);
      
            const detail = document.createElement('p');
            detail.className = 'event-detail';
            detail.textContent = evt.detail || '';
      
            const meta = document.createElement('div');
            meta.className = 'event-meta';
            const team = getTeamName(evt.team);
            if (team) {
              const chip = document.createElement('span');
              chip.className = 'event-pill';
              chip.textContent = team;
              meta.appendChild(chip);
            }
            if (evt._colLabel) {
              const chip = document.createElement('span');
              chip.className = 'event-pill';
              chip.textContent = evt._colLabel;
              meta.appendChild(chip);
            }
      
            body.appendChild(header);
            body.appendChild(detail);
            body.appendChild(meta);
      
            item.appendChild(timestamp);
            item.appendChild(body);
      
            item.addEventListener('click', () => handleEventSelection(evt));
            item.addEventListener('keydown', e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleEventSelection(evt);
              }
            });
      
            list.appendChild(item);
          });
        }
      
        function applyEventFilters(allEvents, dayLabel){
          const events = Array.isArray(allEvents) ? allEvents.slice() : [];
          const filterMeta = typeof dayLabel === 'string'
            ? {label: dayLabel}
            : (dayLabel && typeof dayLabel === 'object' ? dayLabel : null);
          const filtered = events.filter(evt => {
            if (!evt) return false;
            const eventDate = toDateString(evt.ts);
            if (state.rangeWindow) {
              if (state.rangeWindow.start && eventDate && eventDate < state.rangeWindow.start) return false;
              if (state.rangeWindow.end && eventDate && eventDate > state.rangeWindow.end) return false;
            }
            if (state.teamSelection !== 'all' && evt.team && evt.team !== state.teamSelection) {
              return false;
            }
            if (state.eventFilterTeams.size && evt.team) {
              if (!state.eventFilterTeams.has(evt.team)) return false;
            }
            if (state.eventFilterSeverity) {
              if (!evt.severity || evt.severity !== state.eventFilterSeverity) return false;
            }
            if (state.eventFilterType) {
              if (!evt.type || evt.type !== state.eventFilterType) return false;
            }
            if (filterMeta) {
              if (filterMeta.date) {
                if (!evt._colDate || evt._colDate !== filterMeta.date) return false;
              } else if (filterMeta.label) {
                if (!evt._colLabel || evt._colLabel !== filterMeta.label) return false;
              }
            }
            return true;
          });
          updateEventBadges(filtered);
          return filtered;
        }
      
        function severityClass(severity){
          switch (severity) {
            case 'critical':
              return 'event-pill event-pill--critical';
            case 'warning':
              return 'event-pill event-pill--warning';
            default:
              return 'event-pill event-pill--info';
          }
        }
      
        function handleEventSelection(evt){
          if (!Number.isInteger(evt?._colIndex)) return;
          setSelectedColumn(evt._colIndex, {updateFilter: false});
          scrollIntoView('corp-heatmap');
        }
      
        function renderActivity(activity){
          const table = els.activityTable;
          const cardsHost = els.activityCards;
          if (!table) return;
          const rows = Array.isArray(activity) ? activity : [];
          const filtered = rows.filter(row => {
            if (!row) return false;
            if (state.teamSelection !== 'all' && row.team && row.team !== state.teamSelection) return false;
            return true;
          });
      
          table.innerHTML = '';
          if (cardsHost) {
            cardsHost.innerHTML = '';
          }
          if (state.insufficient) {
            if (window.guardSmallN) {
              window.guardSmallN(0, table, t('guard.insufficient', 'Insufficient group size'));
            }
            if (cardsHost) {
              cardsHost.innerHTML = '';
            }
            state.activityCsvRows = [];
            updateExportState(true);
            return;
          }
      
          if (window.guardSmallN) {
            window.guardSmallN(5, table);
          }
      
          const lang = window.I18N?.getLang?.() || 'en';
          const columns = buildActivityColumns(lang);
          const thead = `<thead><tr>${columns.map((col, index) => activityHeaderCell(col, index)).join('')}</tr></thead>`;
          let tbody = '';
      
          if (!filtered.length) {
            tbody = `<tbody><tr data-empty-row="true"><td colspan="${columns.length}">${t('activity.empty', 'No activity data')}</td></tr></tbody>`;
            if (cardsHost) {
              cardsHost.innerHTML = `<p class="caption">${t('activity.empty', 'No activity data')}</p>`;
            }
          } else {
            const sorted = sortActivityRows(filtered, columns, lang);
            const bodyRows = sorted.map(row => {
              const cells = columns.map(col => {
                const display = col.render(row, lang);
                const sortValue = col.sortValue(row, lang);
                const typeAttr = ` data-sort-type="${col.type || 'text'}"`;
                const valueAttr = sortValue != null && sortValue !== '' ? ` data-sort-value="${escapeAttr(sortValue)}"` : '';
                return `<td${typeAttr}${valueAttr}>${display}</td>`;
              });
              return `<tr>${cells.join('')}</tr>`;
            });
            tbody = `<tbody>${bodyRows.join('')}</tbody>`;
      
            if (cardsHost) {
              const cardMarkup = sorted.map(row => {
                const title = columns[0].render(row, lang);
                const items = columns.slice(1).map(col => {
                  return `<li class="table-card__item"><span class="table-card__label">${col.label}</span><span class="table-card__value">${col.render(row, lang)}</span></li>`;
                }).join('');
                return `<article class="table-card"><h3 class="table-card__title">${title}</h3><ul class="table-card__list">${items}</ul></article>`;
              }).join('');
              cardsHost.innerHTML = cardMarkup;
            }
          }
      
          table.innerHTML = `${thead}${tbody}`;
          updateActivityHeaderState(table, state.activitySort.key, state.activitySort.dir);
          updateActivityCsvFromDom();
        }
      
        function numericOrDash(value){
          const num = Number(value);
          if (!Number.isFinite(num)) return '—';
          return String(Math.round(num));
        }
      
        function numericValue(value){
          const num = Number(value);
          return Number.isFinite(num) ? num : Number.NEGATIVE_INFINITY;
        }
      
        function dateValue(value){
          if (!value) return Number.NEGATIVE_INFINITY;
          const ts = Date.parse(value);
          return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
        }
      
        function compareValues(a, b, type, lang){
          if (type === 'number') {
            const numA = Number(a);
            const numB = Number(b);
            const finiteA = Number.isFinite(numA);
            const finiteB = Number.isFinite(numB);
            if (!finiteA && !finiteB) return 0;
            if (!finiteA) return -1;
            if (!finiteB) return 1;
            if (numA === numB) return 0;
            return numA < numB ? -1 : 1;
          }
          const textA = String(a ?? '').trim();
          const textB = String(b ?? '').trim();
          try {
            return textA.localeCompare(textB, lang || undefined, {sensitivity: 'base'});
          } catch (err) {
            if (textA === textB) return 0;
            return textA < textB ? -1 : 1;
          }
        }
      
        function escapeAttr(value){
          return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }
      
        function getTeamName(id){
          return state.teamMap.get(id) || id || '—';
        }
      
        function buildActivityColumns(lang){
          const dateFormatter = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit', year: 'numeric'});
          return [
            {
              key: 'date',
              label: t('activity.date', 'Date'),
              render: (row) => formatDateLabel(row.date, {formatter: dateFormatter}),
              sortValue: (row) => dateValue(row.date),
              type: 'number',
              defaultDir: 'desc'
            },
            {
              key: 'team',
              label: t('activity.team', 'Team'),
              render: (row) => getTeamName(row.team),
              sortValue: (row) => getTeamName(row.team),
              type: 'text',
              defaultDir: 'asc'
            },
            {
              key: 'hydration',
              label: t('activity.hydration', 'Hydration Logs'),
              render: (row) => numericOrDash(row.hydration),
              sortValue: (row) => numericValue(row.hydration),
              type: 'number',
              defaultDir: 'desc'
            },
            {
              key: 'caffeine',
              label: t('activity.caffeine', 'Caffeine Logs'),
              render: (row) => numericOrDash(row.caffeine),
              sortValue: (row) => numericValue(row.caffeine),
              type: 'number',
              defaultDir: 'desc'
            },
            {
              key: 'meds',
              label: t('activity.meds', 'Medications Logged'),
              render: (row) => numericOrDash(row.meds),
              sortValue: (row) => numericValue(row.meds),
              type: 'number',
              defaultDir: 'desc'
            },
            {
              key: 'steps',
              label: t('activity.steps', 'Active Steps %'),
              render: (row) => numericOrDash(row.steps_active_pct),
              sortValue: (row) => numericValue(row.steps_active_pct),
              type: 'number',
              defaultDir: 'desc'
            }
          ];
        }
      
        function activityHeaderCell(column, index){
          const isActive = state.activitySort.key === column.key;
          const dir = isActive ? state.activitySort.dir : 'none';
          const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
          const icon = !isActive ? '⇅' : dir === 'asc' ? '▲' : '▼';
          return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="table-sort${isActive ? ' is-active' : ''}" data-sort="${column.key}" data-sort-index="${index}" data-sort-type="${column.type || 'text'}" data-default-dir="${column.defaultDir || 'asc'}" data-sort-dir="${dir}">${column.label}<span class="table-sort__icon" aria-hidden="true">${icon}</span></button></th>`;
        }
      
        function sortActivityRows(rows, columns, lang){
          const active = columns.find(col => col.key === state.activitySort.key) || columns[0];
          const direction = state.activitySort.dir === 'asc' ? 1 : -1;
          return rows
            .map((row, index) => ({row, index}))
            .sort((a, b) => {
              const result = compareValues(active.sortValue(a.row, lang), active.sortValue(b.row, lang), active.type, lang);
              if (result !== 0) return result * direction;
              const fallbackCol = columns[0];
              if (fallbackCol) {
                const fallback = compareValues(fallbackCol.sortValue(a.row, lang), fallbackCol.sortValue(b.row, lang), fallbackCol.type, lang);
                if (fallback !== 0) return fallback * direction;
              }
              return a.index - b.index;
            })
            .map(entry => entry.row);
        }
      
        function handleActivitySortClick(evt){
          const trigger = evt.target.closest('[data-sort]');
          if (!trigger) return;
          evt.preventDefault();
          const tableEl = els.activityTable;
          if (!tableEl) return;
          const key = trigger.getAttribute('data-sort');
          if (!key) return;
          const colIndex = Number(trigger.getAttribute('data-sort-index'));
          if (!Number.isFinite(colIndex) || colIndex < 0) return;
          const lang = window.I18N?.getLang?.() || 'en';
          const columns = buildActivityColumns(lang);
          const column = columns.find(col => col.key === key) || null;
          const defaultDir = trigger.getAttribute('data-default-dir') || column?.defaultDir || 'asc';
          let dir;
          if (state.activitySort.key === key) {
            dir = state.activitySort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            dir = defaultDir;
          }
          state.activitySort = {key, dir};
          const type = trigger.getAttribute('data-sort-type') || column?.type || 'text';
          const locale = lang;
          const sorted = window.exporter?.sortTable?.(tableEl, colIndex, dir, {type, locale});
          if (!sorted || !sorted.length) {
            renderActivity(state.metrics?.activity);
            return;
          }
          updateActivityHeaderState(tableEl, key, dir);
          updateActivityCsvFromDom();
        }
      
        function updateActivityHeaderState(table, activeKey, dir){
          const headers = table?.querySelectorAll('th');
          headers?.forEach(header => {
            const button = header.querySelector('[data-sort]');
            if (!button) return;
            const key = button.getAttribute('data-sort');
            const isActive = key === activeKey;
            const currentDir = isActive ? dir : 'none';
            button.dataset.sortDir = currentDir;
            button.classList.toggle('is-active', isActive);
            header.setAttribute('aria-sort', isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
            const icon = button.querySelector('.table-sort__icon');
            if (icon) {
              icon.textContent = !isActive ? '⇅' : dir === 'asc' ? '▲' : '▼';
            }
          });
        }
      
        function updateActivityCsvFromDom(){
          const table = els.activityTable;
          if (!table) return;
          const rows = Array.from(table.querySelectorAll('tbody tr')).filter(row => row.dataset.emptyRow !== 'true');
          state.activityCsvRows = rows.map(row => Array.from(row.cells).map(cell => cell.textContent.trim()));
          updateExportState(state.insufficient || !state.activityCsvRows.length);
        }
      
        function exportActivity(){
          if (!state.activityCsvRows.length) return;
          if (els.exportBtn) {
            window.exporter?.notifyStart?.(els.exportBtn);
          }
          const lang = window.I18N?.getLang?.() || 'en';
          const headers = buildActivityColumns(lang).map(col => csvEscape(col.label));
          const lines = [headers.join(',')].concat(state.activityCsvRows.map(row => row.map(csvEscape).join(',')));
          const tableEl = els.activityTable;
          const sources = window.exporter?.collectSourceSummaries?.(tableEl) || [];
          const attribution = window.exporter?.buildSourceCsvHeader?.(sources) || [];
          const csvBody = lines.join('\n');
          const csv = attribution.length ? `${attribution.join('\n')}\n${csvBody}` : csvBody;
          const blob = new Blob([csv], {type: 'text/csv'});
          const team = state.teamSelection === 'all' ? 'all' : state.teamSelection;
          const range = state.rangeKey || '7d';
          const stamp = formatFileDate(new Date());
          const filename = `activity_${team}_${range}_${stamp}.csv`;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      
        function csvEscape(value){
          const text = String(value ?? '');
          if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        }
      
        function updateExportState(disabled){
          if (!els.exportBtn) return;
          els.exportBtn.disabled = !!disabled;
          if (disabled) {
            els.exportBtn.setAttribute('aria-disabled', 'true');
          } else {
            els.exportBtn.removeAttribute('aria-disabled');
          }
          const baseLabel = els.exportBtn.getAttribute('data-export-label') || t('ui.exportCSV', 'Export CSV');
          els.exportBtn.setAttribute('aria-label', baseLabel);
          els.exportBtn.setAttribute('title', baseLabel);
        }
      
        function updateCaption(){
          if (!els.caption) return;
          const teamLabel = state.teamSelection === 'all'
            ? t('label.team.all', 'All Teams')
            : (state.teamMap.get(state.teamSelection) || state.teamSelection);
          const rangeLabel = state.rangeLabel || t('label.range', 'Range');
          const prefix = t('caption.orgAvg', t('caption.orgAverage', 'Org avg'));
          const sep = t('caption.separator', ' · ');
          const insight = `${scenarioPrefix()}${prefix}${sep}${rangeLabel}${sep}${teamLabel}`;
          if (window.Caption?.render) {
            window.Caption?.render(els.caption, {asOf: new Date(), insight});
          } else {
            els.caption.textContent = insight;
          }
        }
      
        function handleStorageEvent(evt){
          if (!evt) return;
          if (evt.key === 'hr:team') {
            state.teamSelection = readTeamSelection();
            if (state.teamSelection !== 'all') {
              state.eventFilterTeams = new Set([state.teamSelection]);
            } else {
              state.eventFilterTeams = new Set();
            }
            syncEventTeamSelection();
            renderEvents();
            renderActivity(state.metrics?.activity);
            updateCaption();
          }
          if (evt.key === 'hr:range') {
            loadMetrics().then(() => {
              renderAll();
            });
          }
          if (evt.key === 'hr:scenario') {
            updateScenarioButtons();
            Promise.all([loadEvents(), loadMetrics()]).then(() => {
              renderAll();
            });
          }
          if (evt.key === 'spa2099_mode' || evt.key === 'mode' || evt.key === 'hr:mode') {
            state.todayMode = readMode();
            if (state.rangeKey === 'today') {
              loadKpiTodayData().then(() => {
                try {
                  renderFatigueTodayCard();
                } catch (err) {
                  devError('KPI:Fatigue render failed', err);
                }
              });
            }
          }
        }
      
        function syncEventTeamSelection(){
          if (!els.eventTeam) return;
          const values = state.eventFilterTeams.size ? Array.from(state.eventFilterTeams) : [];
          Array.from(els.eventTeam.options || []).forEach(option => {
            option.selected = values.includes(option.value);
          });
        }
      
        function handleI18nChange(){
          state.rangeLabel = resolveRangeConfig(state.rangeSelection).label;
          setupEventFilters();
          buildEventTypeOptions();
          updateScenarioButtons();
          renderAll();
        }
      
        function readTeamSelection(){
          try {
            return localStorage.getItem('hr:team') || 'all';
          } catch (err) {
            return 'all';
          }
        }
      
        function readRangeSelection(){
          try {
            const raw = localStorage.getItem('hr:range');
            if (!raw) return {preset: '7d'};
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }
          } catch (err) {
            // ignore malformed
          }
          return {preset: '7d'};
        }
      
        function resolveRangeConfig(selection){
          const lang = getLang();
          const presets = {
            today: window.I18N?.t('range.today') || 'Today',
            '7d': window.I18N?.t('range.7d') || '7 Days',
            mtd: window.I18N?.t('range.mtd') || 'Month to date',
            qtd: window.I18N?.t('range.qtd') || 'Quarter to date',
            ytd: window.I18N?.t('range.ytd') || 'Year to date'
          };
          if (selection?.preset) {
            const preset = displayPreset(selection.preset);
            if (preset === 'today') {
              return {dataKey: '7d', label: presets.today, rangeKey: 'today'};
            }
            if (preset === '7d') {
              return {dataKey: '7d', label: presets['7d'], rangeKey: '7d'};
            }
            if (preset === 'mtd') {
              return {dataKey: 'month', label: presets.mtd, rangeKey: 'mtd'};
            }
            if (preset === 'qtd') {
              return {dataKey: 'month', label: presets.qtd, rangeKey: 'qtd'};
            }
            if (preset === 'ytd') {
              return {dataKey: 'year', label: presets.ytd, rangeKey: 'ytd'};
            }
          }
          if (selection?.start && selection?.end) {
            const startLabel = formatDateLabel(selection.start, {lang});
            const endLabel = formatDateLabel(selection.end, {lang});
            const rangeLabel = startLabel && endLabel
              ? `${startLabel} – ${endLabel}`
              : startLabel || endLabel || '';
            return {
              dataKey: 'month',
              label: rangeLabel,
              rangeKey: 'custom'
            };
          }
          return {dataKey: '7d', label: presets['7d'], rangeKey: '7d'};
        }
      
        function getLang(){
          return window.I18N?.getLang?.() || 'en';
        }
      
        function defaultDateOptions(lang){
          return lang === 'ru'
            ? {day: '2-digit', month: '2-digit', year: 'numeric'}
            : {day: 'numeric', month: 'short', year: 'numeric'};
        }
      
        function formatDateLabel(dateStr, options={}){
          if (!dateStr) return '';
          try {
            const lang = options.lang || getLang();
            const formatter = options.formatter || new Intl.DateTimeFormat(lang, defaultDateOptions(lang));
            const date = new Date(`${dateStr}T00:00:00`);
            if (Number.isNaN(date.getTime())) return dateStr;
            return formatter.format(date);
          } catch (err) {
            return dateStr;
          }
        }
      
        function formatDateTime(iso){
          if (!iso) return '';
          const date = new Date(iso);
          if (Number.isNaN(date.getTime())) return iso;
          const lang = window.I18N?.getLang?.() || 'en';
          const datePart = new Intl.DateTimeFormat(lang, {month: 'short', day: '2-digit'}).format(date);
          const timePart = new Intl.DateTimeFormat(lang, {hour: '2-digit', minute: '2-digit'}).format(date);
          return `${datePart} · ${timePart}`;
        }
      
        function toDateString(iso){
          if (!iso) return null;
          const date = new Date(iso);
          if (Number.isNaN(date.getTime())) return null;
          return date.toISOString().slice(0, 10);
        }
      
        function scrollIntoView(id){
          const el = document.getElementById(id);
          if (!el) return;
          el.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
      
        function scrollEventsPanel(){
          const panel = document.getElementById('corp-events');
          panel?.scrollIntoView({behavior: 'smooth'});
        }
      
        function formatFileDate(date){
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '00000000';
          const year = String(date.getFullYear());
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      
        async function fetchJson(path){
          return await loadJson(applyVersion(path));
        }
      
        function updateEventBadges(events){
          if (!els.eventBadges) return;
          const list = Array.isArray(events) ? events : [];
          if (state.insufficient) {
            if (els.eventCount) els.eventCount.textContent = t('guard.insufficient', 'Insufficient group size');
            [els.eventCritical, els.eventWarning, els.eventInfo].forEach(el => {
              if (!el) return;
              el.textContent = '—';
            });
            return;
          }
          const counts = {critical: 0, warning: 0, info: 0};
          list.forEach(evt => {
            const sev = evt?.severity;
            if (sev && Object.prototype.hasOwnProperty.call(counts, sev)) {
              counts[sev] += 1;
            }
          });
          const total = list.length;
          if (els.eventCount) {
            els.eventCount.textContent = t('events.count.total', {count: total});
          }
          if (els.eventCritical) {
            els.eventCritical.textContent = t('events.count.critical', {count: counts.critical});
          }
          if (els.eventWarning) {
            els.eventWarning.textContent = t('events.count.warning', {count: counts.warning});
          }
          if (els.eventInfo) {
            els.eventInfo.textContent = t('events.count.info', {count: counts.info});
          }
        }
      
        function setScenario(mode){
          const next = mode === 'night' ? 'night' : 'live';
          try {
            const prev = readScenario();
            if (prev === next) {
              updateScenarioButtons();
              return;
            }
            localStorage.setItem('hr:scenario', next);
            dispatchEvent(new StorageEvent('storage', {key: 'hr:scenario'}));
          } catch (err) {
            devWarn('scenario set failed', err);
          }
          updateScenarioButtons();
        }
      
        function readScenario(){
          try {
            return localStorage.getItem('hr:scenario') || 'live';
          } catch (err) {
            return 'live';
          }
        }
      
        function scenarioPrefix(){
          return readScenario() === 'night' ? t('caption.scenarioPrefix', '') : '';
        }
      
        function updateScenarioButtons(){
          const scenario = readScenario();
          const isNight = scenario === 'night';
          els.scenarioButtons.forEach(btn => {
            const mode = btn.getAttribute('data-scenario');
            const active = (mode === 'night' && isNight) || (mode === 'live' && !isNight);
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
          });
        }
      
        async function refreshCorporatePage(){
          try {
            await loadMetrics();
            renderAll();
          } catch (err) {
            devError('Corporate refresh failed', err);
          }
        }
      
        return {
          refreshCorporatePage
        };
      }
      
      function renderKpis(kpi, delta={}, n){
        const grid=document.getElementById('corp-kpi-grid');
        if(!grid) return;
        grid.innerHTML = '';
        if (window.guardSmallN && window.guardSmallN(Number(n || 0), grid)) {
          return;
        }
        const defs=[
          {key:'wellbeing_avg',label:()=>window.I18N?.t('kpi.orgWellbeing') || window.I18N?.t('kpi.wellbeing') || 'Org Wellbeing',unit:'/100',fmt:v=>Math.round(v)},
          {key:'high_stress_pct',label:()=>window.I18N?.t('kpi.highStress') || window.I18N?.t('metric.highStress') || 'High Stress %',unit:'%',fmt:v=>Math.round(v)},
          {key:'fatigue_elevated_pct',label:()=>window.I18N?.t('kpi.elevatedFatigue') || window.I18N?.t('metric.elevatedFatigue') || 'Elevated Fatigue %',unit:'%',fmt:v=>Math.round(v)},
          {key:'engagement_active_pct',label:()=>window.I18N?.t('kpi.activeEngagement') || window.I18N?.t('metric.activeEngagement') || 'Active Engagement %',unit:'%',fmt:v=>Math.round(v)},
        ];
        grid.innerHTML = defs.map(d=>{
          const raw = Number(kpi?.[d.key]);
          const val = Number.isFinite(raw)?d.fmt(raw):'—';
          const dRaw = Number(delta?.[d.key]);
          const dl = Number.isFinite(dRaw)?dRaw:null;
          const badge = dl!==null ? `<span class="pill ${dl>=0?'pill--strong':'pill--critical'}">${dl>=0?'▲':'▼'} ${Math.abs(Math.round(dl))}</span>` : '';
          return `<div class="tile kpi">
            <div class="tile__head">${d.label()} ${badge}</div>
            <div class="tile__kpi">${val}<small>${d.unit}</small></div>
            <div class="spark"></div>
          </div>`;
        }).join('');
      }
      
      let corporateController = null;
      
      function mountCorporatePage(){
        if (!corporateController) {
          corporateController = initCorporatePage();
        }
        return corporateController;
      }
      
      async function refreshCorporatePage(){
        const controller = mountCorporatePage();
        if (controller?.refreshCorporatePage) {
          return controller.refreshCorporatePage();
        }
        return undefined;
      }
      
      exports.refreshCorporatePage = refreshCorporatePage;
      exports.mountCorporatePage = mountCorporatePage;
    },
    'assets/js/pages/corporate.js': function(require, module, exports) {
      const { renderToolbar } = require('assets/js/components/Toolbar.js');
      const { renderTeamFilter } = require('assets/js/components/TeamFilter.js');
      const { ModeStore } = require('assets/js/stores/modeStore.js');
      const { AppState } = require('assets/js/stores/appState.js');
      const { mountCorporatePage } = require('assets/js/corporate.js');
      
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
      
      async function bootstrapCorporatePage(){
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
      
      exports.bootstrapCorporatePage = bootstrapCorporatePage;
    },
    'assets/js/exporter.js': function(require, module, exports) {
      const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
      const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
      const LIBS = [
        {global: 'html2canvas', src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'},
        {global: 'jspdf', src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'}
      ];
      const EXPORT_SELECTOR = '[data-export-key]';
      const SOURCE_SELECTOR = '.panel[data-source-id], .card.panel[data-source-id]';
      
      async function ensureExportLibs(){
        for (const lib of LIBS) {
          if (window[lib.global]) continue;
          await loadScript(lib.src);
        }
      }
      
      function loadScript(src){
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      }
      
        async function exportPilotSummary(options, legacyFilename){
          await ensureExportLibs();
          if (Array.isArray(options)) {
            const legacyName = typeof legacyFilename === 'string' ? legacyFilename : 'pilot_summary.pdf';
            await legacyExport(options, legacyName);
            return;
          }
      
          const payload = options || {};
          const filename = payload.filename || 'pilot_summary.pdf';
          const meta = payload.meta || {};
          const kpis = Array.isArray(payload.kpis) ? payload.kpis : [];
          const events = Array.isArray(payload.events) ? payload.events : [];
          const note = typeof payload.note === 'string' ? payload.note.trim() : '';
          const heatmapEl = payload.heatmapEl || null;
      
          const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
          const pageWidth = doc.internal.pageSize.getWidth() - 24;
          const pageHeight = doc.internal.pageSize.getHeight();
          let y = 15;
      
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text(meta.title || 'Pilot Summary', 12, y);
          y += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
      
          const metaLines = [meta.team, meta.range, meta.generated].filter(Boolean);
          metaLines.forEach(line => {
            ensureSpace(5);
            doc.text(String(line), 12, y);
            y += 5;
          });
          if (metaLines.length) y += 2;
      
          if (kpis.length) {
            addHeading(meta.kpiTitle || 'Engagement KPIs');
            kpis.forEach(item => {
              ensureSpace(14);
              doc.setFont('helvetica', 'bold');
              doc.text(item.label, 14, y);
              y += 5;
              doc.setFont('helvetica', 'normal');
              const rows = [
                `Value: ${item.valueText || '—'}`,
                item.targetText ? `Target: ${item.targetText}${item.statusText ? ` · ${item.statusText}` : ''}` : null,
                item.deltaText ? `Δ: ${item.deltaText}` : null
              ].filter(Boolean);
              const wrapped = rows.flatMap(line => doc.splitTextToSize(line, pageWidth));
              doc.text(wrapped, 14, y);
              y += wrapped.length * 4 + 2;
            });
            y += 2;
          }
      
          if (heatmapEl) {
            addHeading(meta.heatmapTitle || 'Heatmap snapshot');
            await ensureHeatmap();
          }
      
          if (events.length) {
            addHeading(meta.eventsTitle || 'Events summary');
            events.forEach(evt => {
              ensureSpace(5);
              doc.text(`${evt.label}: ${evt.count}`, 14, y);
              y += 5;
            });
            y += 2;
          }
      
          if (note) {
            addHeading(meta.noteTitle || '');
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(180, 200, 210);
            const noteLines = doc.splitTextToSize(note, pageWidth);
            ensureSpace(noteLines.length * 4 + 4);
            doc.text(noteLines, 12, y);
            y += noteLines.length * 4 + 2;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
          }
      
          doc.save(filename);
      
          function ensureSpace(space){
            if (y + space > pageHeight - 12) {
              doc.addPage();
              y = 15;
            }
          }
      
          function addHeading(title){
            if (!title) return;
            ensureSpace(8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(title, 12, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
          }
      
          async function ensureHeatmap(){
            ensureSpace(60);
            const canvas = await window.html2canvas(heatmapEl, {backgroundColor: '#06131b', scale: 2});
            const imgData = canvas.toDataURL('image/png');
            const ratio = canvas.width / canvas.height || 1;
            const renderWidth = pageWidth;
            const renderHeight = renderWidth / ratio;
            ensureSpace(renderHeight + 6);
            doc.addImage(imgData, 'PNG', 12, y, renderWidth, renderHeight, undefined, 'FAST');
            y += renderHeight + 6;
          }
        }
      
        function currentLang(){
          return (window.I18N?.getLang?.() || document?.documentElement?.lang || 'en').slice(0, 2).toLowerCase();
        }
      
        function translate(key, fallback){
          const value = window.I18N?.t?.(key);
          if (typeof value === 'string' && value.trim()) return value;
          return fallback;
        }
      
        function describePanelSource(panel, id, lang){
          const sources = window.Sources;
          if (!sources) return null;
          const descriptor = typeof sources.describe === 'function' ? sources.describe(id, lang) : null;
          const source = descriptor || (typeof sources.get === 'function' ? sources.get(id) : null);
          if (!source) return null;
          const statsLine = panel.dataset?.sourceStats
            || (typeof sources.formatStats === 'function'
              ? sources.formatStats(descriptor?.methodology?.stats || source.methodology?.stats)
              : '');
          const threshold = panel.dataset?.sourceThresholdDisplay
            || panel.dataset?.sourceThreshold
            || descriptor?.methodology?.threshold
            || source.methodology?.threshold
            || '';
          const period = panel.dataset?.sourcePeriodDisplay
            || panel.dataset?.sourcePeriod
            || descriptor?.periodDefault
            || source.periodDefault
            || '';
          const sampleN = panel.dataset?.sourceSampleN
            || (descriptor?.sample?.nTotal != null ? descriptor.sample.nTotal : '');
          const sampleUnit = panel.dataset?.sourceSampleUnit
            || descriptor?.sample?.unit
            || source.sample?.unit
            || '';
          const sampleText = sampleN || sampleUnit
            ? `${sampleN ? `n=${sampleN}` : ''}${sampleN && sampleUnit ? ' ' : ''}${sampleUnit}`.trim()
            : '';
          return {
            id,
            title: panel.dataset?.sourceTitleDisplay
              || descriptor?.title
              || (typeof source.title === 'string' ? source.title : id),
            publisher: panel.dataset?.sourcePublisher || descriptor?.publisher || '',
            coverage: panel.dataset?.sourceCoverage || descriptor?.coverage || '',
            updatedAt: panel.dataset?.sourceUpdated || descriptor?.updatedAt || source.updatedAt || '',
            link: panel.dataset?.sourceLink || descriptor?.link || source.link || '',
            threshold,
            period,
            stats: statsLine,
            sample: sampleText,
            disclaimer: panel.dataset?.sourceDisclaimer || descriptor?.disclaimer || '',
            isDemo: descriptor?.isDemo ?? !!source.isDemo
          };
        }
      
        function panelsWithin(scope){
          if (typeof document === 'undefined') return [];
          if (!scope) {
            return Array.from(document.querySelectorAll(SOURCE_SELECTOR));
          }
          const isElement = typeof Element !== 'undefined' && scope instanceof Element;
          if (isElement || (scope && scope.nodeType === 1)) {
            const element = scope;
            const direct = element.matches?.(SOURCE_SELECTOR) ? element : element.closest?.(SOURCE_SELECTOR);
            if (direct) return [direct];
            return Array.from(element.querySelectorAll?.(SOURCE_SELECTOR) || []);
          }
          return [];
        }
      
        function collectSourceSummaries(scope){
          if (typeof document === 'undefined') return [];
          window.Sources?.refresh?.();
          const lang = currentLang();
          const panels = panelsWithin(scope);
          const seen = new Map();
          panels.forEach(panel => {
            const id = panel?.dataset?.sourceId;
            if (!id || seen.has(id)) return;
            const summary = describePanelSource(panel, id, lang);
            if (summary) {
              seen.set(id, summary);
            }
          });
          return Array.from(seen.values());
        }
      
        function buildSourceCsvHeader(summaries){
          if (!Array.isArray(summaries) || !summaries.length) return [];
          const lines = [`# ${translate('source.section', 'Sources & Methodology')}`];
          summaries.forEach(summary => {
            lines.push(`# ${summary.title}`);
            if (summary.publisher) lines.push(`#   ${translate('source.publisher', 'Publisher')}: ${summary.publisher}`);
            if (summary.coverage) lines.push(`#   ${translate('source.coverage', 'Coverage')}: ${summary.coverage}`);
            if (summary.period) lines.push(`#   ${translate('source.period', 'Period')}: ${summary.period}`);
            if (summary.threshold) lines.push(`#   ${translate('source.threshold', 'Threshold')}: ${summary.threshold}`);
            if (summary.stats) lines.push(`#   ${translate('source.methodology', 'Methodology')}: ${summary.stats}`);
            if (summary.sample) lines.push(`#   ${translate('source.sample', 'Sample')}: ${summary.sample}`);
            if (summary.updatedAt) lines.push(`#   ${translate('source.updated', 'Updated')}: ${summary.updatedAt}`);
            if (summary.link) lines.push(`#   ${translate('source.link', 'Open source / methodology')}: ${summary.link}`);
            if (summary.disclaimer) lines.push(`#   ${summary.disclaimer}`);
          });
          return lines;
        }
      
        async function exportSiteBriefPDF(options={}){
          await ensureExportLibs();
          const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
          const margin = 12;
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const contentWidth = pageWidth - margin * 2;
          let y = margin;
      
          const title = window.I18N?.t?.('demo.title') || 'Demo';
          const badgeText = typeof options.badgeText === 'string'
            ? options.badgeText
            : document.getElementById('site-badge')?.textContent?.trim?.() || '';
      
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.text(title, margin, y);
          y += 8;
      
          if (badgeText) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            const badgeLines = doc.splitTextToSize(badgeText, contentWidth);
            doc.text(badgeLines, margin, y);
            y += badgeLines.length * 5 + 2;
          }
      
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
      
          await addSectionImage(document.getElementById('demo-hero'), {maxHeight: 90, spacing: 8});
          await addSectionImage(document.getElementById('demo-overview'), {spacing: 10});
          await addSectionImage(document.querySelector('#org-table table') || document.getElementById('org-table'), {maxHeight: 140, spacing: 10});
          await addSectionImage(document.getElementById('chart-gender-overall'), {maxHeight: 110, spacing: 6});
          await addSectionImage(document.getElementById('chart-age-overall'), {maxHeight: 110, spacing: 10});
          await addSectionImage(document.getElementById('chart-by-dept'), {maxHeight: 130, spacing: 10});
          await addSectionImage(document.getElementById('shift-grid'), {maxHeight: 140, spacing: 10});
      
          const sources = collectSourceSummaries();
          if (sources.length) {
            addHeading(translate('source.section', 'Sources & Methodology'));
            sources.forEach(summary => {
              ensureSpace(14);
              doc.setFont('helvetica', 'bold');
              doc.text(summary.title, margin, y);
              y += 5;
              doc.setFont('helvetica', 'normal');
              const details = [];
              if (summary.publisher) details.push(`${translate('source.publisher', 'Publisher')}: ${summary.publisher}`);
              if (summary.coverage) details.push(`${translate('source.coverage', 'Coverage')}: ${summary.coverage}`);
              if (summary.period) details.push(`${translate('source.period', 'Period')}: ${summary.period}`);
              if (summary.threshold) details.push(`${translate('source.threshold', 'Threshold')}: ${summary.threshold}`);
              if (summary.stats) details.push(`${translate('source.methodology', 'Methodology')}: ${summary.stats}`);
              if (summary.sample) details.push(`${translate('source.sample', 'Sample')}: ${summary.sample}`);
              if (summary.updatedAt) details.push(`${translate('source.updated', 'Updated')}: ${summary.updatedAt}`);
              if (summary.link) details.push(`${translate('source.link', 'Open source / methodology')}: ${summary.link}`);
              if (details.length) {
                const wrapped = details.flatMap(line => doc.splitTextToSize(line, contentWidth));
                ensureSpace(wrapped.length * 4 + 2);
                doc.text(wrapped, margin + 2, y);
                y += wrapped.length * 4 + 2;
              }
              if (summary.disclaimer) {
                const disclaimerLines = doc.splitTextToSize(summary.disclaimer, contentWidth);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(150, 170, 190);
                ensureSpace(disclaimerLines.length * 4 + 2);
                doc.text(disclaimerLines, margin + 2, y);
                y += disclaimerLines.length * 4 + 2;
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
              }
              y += 2;
            });
            y += 2;
          }
      
          const note = 'Fictional demo data; aggregates only; no PII.';
          if (y > pageHeight - margin - 12) {
            doc.addPage();
            y = pageHeight - margin - 12;
          }
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(150, 170, 190);
          doc.text(note, margin, pageHeight - margin);
          doc.setTextColor(0, 0, 0);
      
          const date = new Date();
          const iso = date.toISOString().slice(0, 10);
          doc.save(`aurora_site_brief_${iso}.pdf`);
      
          function ensureSpace(space){
            if (y + space > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
          }
      
          function addHeading(title){
            if (!title) return;
            ensureSpace(8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(title, margin, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
          }
      
          async function addSectionImage(element, opts={}){
            if (!element) return;
            const options = Object.assign({spacing: 6, maxHeight: pageHeight - margin * 2}, opts);
            try {
              const canvas = await window.html2canvas(element, {backgroundColor: '#06131b', scale: 2});
              const ratio = canvas.width / canvas.height || 1;
              let renderWidth = contentWidth;
              let renderHeight = renderWidth / ratio;
              const maxHeight = Math.max(60, options.maxHeight || contentWidth / ratio);
              if (renderHeight > maxHeight) {
                const scale = maxHeight / renderHeight;
                renderHeight = maxHeight;
                renderWidth = renderWidth * scale;
              }
              ensureSpace(renderHeight + options.spacing + 4);
              const x = margin + (contentWidth - renderWidth) / 2;
              const imgData = canvas.toDataURL('image/png');
              doc.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
              y += renderHeight + options.spacing;
            } catch (err) {
              devWarn('exportSiteBriefPDF: capture failed', err);
            }
          }
        }
      
        async function legacyExport(sections, filename){
          const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'});
          let y = 10;
          for (const section of sections) {
            if (!section || !section.element) continue;
            const canvas = await window.html2canvas(section.element, {backgroundColor: '#06131b', scale: 2});
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = doc.internal.pageSize.getWidth() - 20;
            const pageHeight = doc.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height || 1;
            const renderWidth = pageWidth;
            const renderHeight = renderWidth / ratio;
            if (y + renderHeight > pageHeight - 10) {
              doc.addPage();
              y = 10;
            }
            doc.addImage(imgData, 'PNG', 10, y, renderWidth, renderHeight, undefined, 'FAST');
            y += renderHeight + 8;
            if (section.caption) {
              if (y > pageHeight - 20) {
                doc.addPage();
                y = 15;
              }
              doc.setFontSize(10);
              doc.text(section.caption, 12, y);
              y += 10;
            }
          }
          doc.save(filename);
        }
      
        function sortTable(table, colIndex, dir='asc', options={}){
          if (!table || !table.tBodies || !table.tBodies.length) return [];
          const index = Number(colIndex);
          if (!Number.isFinite(index) || index < 0) return [];
          const tbody = table.tBodies[0];
          if (!tbody) return [];
          const rows = Array.from(tbody.rows || []);
          if (!rows.length) return [];
          const direction = String(dir).toLowerCase() === 'desc' ? -1 : 1;
          const requestedType = (options.type || rows[0]?.cells?.[index]?.dataset?.sortType || 'text').toString().toLowerCase();
          const type = requestedType === 'text' ? 'text' : 'number';
          const locale = options.locale || (typeof window !== 'undefined' && window.I18N?.getLang?.());
          let collator = null;
          if (type === 'text') {
            try {
              collator = locale ? new Intl.Collator(locale, {sensitivity: 'base'}) : new Intl.Collator(undefined, {sensitivity: 'base'});
            } catch (err) {
              collator = null;
            }
          }
          const sorted = rows
            .map((row, order) => ({row, order}))
            .sort((a, b) => {
              const cellA = a.row.cells[index];
              const cellB = b.row.cells[index];
              const aVal = readCellValue(cellA);
              const bVal = readCellValue(cellB);
              const cmp = compareValues(aVal, bVal, type, collator);
              if (cmp !== 0) return cmp * direction;
              return a.order - b.order;
            })
            .map(entry => entry.row);
          sorted.forEach(row => tbody.appendChild(row));
          return sorted;
      
          function readCellValue(cell){
            if (!cell) return type === 'number' ? Number.NEGATIVE_INFINITY : '';
            const raw = cell.dataset?.sortValue;
            if (raw != null) return raw;
            return cell.textContent?.trim?.() ?? '';
          }
      
          function compareValues(a, b, valueType, collatorInstance){
            if (valueType === 'number') {
              const numA = Number(a);
              const numB = Number(b);
              const finiteA = Number.isFinite(numA);
              const finiteB = Number.isFinite(numB);
              if (!finiteA && !finiteB) return 0;
              if (!finiteA) return -1;
              if (!finiteB) return 1;
              if (numA === numB) return 0;
              return numA < numB ? -1 : 1;
            }
            const textA = String(a ?? '').trim();
            const textB = String(b ?? '').trim();
            if (collatorInstance) {
              return collatorInstance.compare(textA, textB);
            }
            if (textA === textB) return 0;
            return textA < textB ? -1 : 1;
          }
        }
      
        function ensureExportStructure(button, key){
          if (typeof document === 'undefined' || !button) return;
          if (!button.classList.contains('btn--export')) {
            button.classList.add('btn--export');
          }
          if (!button.querySelector('.btn__icon')) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'btn__icon';
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.textContent = button.dataset.exportIcon || '⇩';
            button.insertBefore(iconSpan, button.firstChild || null);
          }
          const iconEl = button.querySelector('.btn__icon');
          if (iconEl) {
            iconEl.textContent = button.dataset.exportIcon || iconEl.textContent || '⇩';
          }
          let labelSpan = button.querySelector('.btn__label');
          if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.className = 'btn__label';
            button.appendChild(labelSpan);
          }
          if (key && !labelSpan.getAttribute('data-i18n')) {
            labelSpan.setAttribute('data-i18n', key);
          }
        }
      
        function updateExportButtons(){
          if (typeof document === 'undefined') return;
          const buttons = document.querySelectorAll(EXPORT_SELECTOR);
          buttons.forEach(button => {
            const key = button.dataset.exportKey;
            if (!key) return;
            ensureExportStructure(button, key);
            const label = window.I18N?.t?.(key) || button.dataset.exportFallback || button.getAttribute('data-export-label') || button.textContent.trim() || 'Export';
            const iconEl = button.querySelector('.btn__icon');
            if (iconEl) {
              iconEl.textContent = button.dataset.exportIcon || iconEl.textContent || '⇩';
            }
            const labelEl = button.querySelector('.btn__label');
            if (labelEl) {
              labelEl.textContent = label;
            }
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
            button.setAttribute('data-export-label', label);
          });
        }
      
        function notifyStart(button, key){
          if (button?.disabled) return;
          const labelKey = key || button?.dataset?.exportKey;
          const baseLabel = labelKey ? (window.I18N?.t?.(labelKey) || button?.getAttribute('data-export-label') || '') : (button?.getAttribute('data-export-label') || '');
          const message = window.I18N?.t?.('toast.exportStarted', baseLabel ? {label: baseLabel} : undefined)
            || window.I18N?.t?.('toast.exportStarted')
            || 'Export started';
          showExportToast(message);
        }
      
        function showExportToast(message){
          if (!message || typeof document === 'undefined') return;
          let stack = document.querySelector('.toast-stack');
          if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
          }
          const toast = document.createElement('div');
          toast.className = 'toast';
          toast.setAttribute('role', 'status');
          toast.setAttribute('aria-live', 'polite');
          toast.textContent = message;
          stack.appendChild(toast);
          requestAnimationFrame(() => toast.classList.add('is-visible'));
          setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => {
              if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
          }, 2800);
        }
      
        function readStoredRange(){
          if (typeof localStorage === 'undefined') return null;
          try {
            const raw = localStorage.getItem('hr:range');
            return raw ? JSON.parse(raw) : null;
          } catch (err) {
            return null;
          }
        }
      
        function readStoredCompareFlag(){
          if (typeof localStorage === 'undefined') return false;
          try {
            const raw = localStorage.getItem('hr:compare');
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed && parsed.enabled);
          } catch (err) {
            return false;
          }
        }
      
        function exportCurrentView(options = {}){
          if (typeof document === 'undefined') return;
          const button = options.button || null;
          notifyStart(button, 'toolbar.export');
          const base = {
            title: document.querySelector('.page-title')?.textContent?.trim?.() || document.title || 'HR Dashboard',
            mode: window.ModeStore?.mode || window.AppState?.mode || 'DEMO',
            range: readStoredRange(),
            compare: readStoredCompareFlag(),
            generatedAt: new Date().toISOString()
          };
          const extra = options.extra && typeof options.extra === 'object' ? options.extra : {};
          const payload = Object.assign({}, base, extra);
          const filename = (() => {
            if (typeof options.filename === 'string' && options.filename.trim()) {
              return options.filename.trim();
            }
            const iso = new Date().toISOString().slice(0, 10);
            return `export_${iso}.json`;
          })();
          try {
            const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              if (link.parentNode) link.parentNode.removeChild(link);
              URL.revokeObjectURL(url);
            }, 0);
          } catch (err) {
            devError('exportCurrentView failed', err);
          }
        }
      
        if (typeof document !== 'undefined') {
          const refresh = () => updateExportButtons();
          if (document.readyState !== 'loading') {
            refresh();
          } else {
            document.addEventListener('DOMContentLoaded', refresh, {once: true});
          }
          window.addEventListener?.('i18n:ready', updateExportButtons);
          document.addEventListener('i18n:change', updateExportButtons);
        }
      
      const api = Object.assign({}, window.exporter, {
        exportPilotSummary,
        sortTable,
        exportSiteBriefPDF,
        exportCurrentView,
        notifyStart,
        updateExportButtons,
        collectSourceSummaries,
        buildSourceCsvHeader
      });
      window.exporter = api;
      window.EXPORTER = api;
      
      async function handleExportClick(options = {}) {
        await ensureExportLibs();
        const { trigger, onExport } = options;
        if (typeof onExport === 'function') {
          await onExport();
          return;
        }
        if (typeof api.exportCurrentView === 'function') {
          await api.exportCurrentView({ button: trigger || null });
        }
      }
      
      exports.ensureExportLibs = ensureExportLibs;
      exports.handleExportClick = handleExportClick;
      exports.loadScript = loadScript;
    },
    'components/kpi-cards/kpi-cards.js': function(require, module, exports) {
      const TEMPLATE_URL = new URL('./kpi-cards.html', module.importMetaUrl);
      let templatePromise = null;
      let cardIdCounter = 0;
      
      /**
       * @typedef {'1d'|'7d'|'30d'|'mtd'|'qtd'|'ytd'} RangeKey
       * @typedef {{ value?: number, delta?: number, trend?: number }} MetricDatum
       * @typedef {{ defaultRange: RangeKey, metrics: Record<string, Record<RangeKey, MetricDatum>> }} KpiData
       */
      
      const VALID_RANGE_IDS = new Set(['1d', '7d', '30d', 'mtd', 'qtd', 'ytd']);
      
      const ICONS = {
        up: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 3l5.5 7.5H2.5L8 3z"/></svg>',
        down: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 13L2.5 5.5h11L8 13z"/></svg>',
        flat: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 8.25h12v-1.5H2z"/></svg>'
      };
      
      const KPI_CONFIG = {
        defaultRange: '7d',
        ranges: [
          { id: '1d', label: '24h' },
          { id: '7d', label: '7d' },
          { id: '30d', label: '30d' }
        ],
        metrics: {
          wellbeing: {
            label: () => window.I18N?.t?.('kpi.wellbeing', 'Wellbeing') || 'Wellbeing',
            unit: '/100',
            description: 'Composite wellbeing score (higher is better)',
            decimals: 0,
            format: value => value?.toFixed?.(0)
          },
          stressAvg: {
            label: () => window.I18N?.t?.('kpi.stress', 'Stress average') || 'Stress average',
            unit: '/100',
            description: 'Average stress index (lower is better)',
            decimals: 0,
            format: value => value?.toFixed?.(0),
            inverse: true
          },
          burnoutPct: {
            label: () => window.I18N?.t?.('kpi.burnoutRisk', 'Burnout risk') || 'Burnout risk',
            unit: '%',
            description: 'Share of users flagged for burnout risk',
            decimals: 1,
            format: value => value?.toFixed?.(1)
          },
          fatiguePct: {
            label: () => window.I18N?.t?.('kpi.elevatedFatigue', 'Elevated fatigue') || 'Elevated fatigue',
            unit: '%',
            description: 'Share of users with elevated fatigue',
            decimals: 1,
            format: value => value?.toFixed?.(1)
          }
        },
        thresholds: {
          wellbeing: v => (typeof v === 'number' ? (v >= 75 ? 'green' : v >= 60 ? 'amber' : 'red') : 'amber'),
          stressAvg: v => (typeof v === 'number' ? (v <= 35 ? 'green' : v <= 55 ? 'amber' : 'red') : 'amber'),
          burnoutPct: v => (typeof v === 'number' ? (v <= 10 ? 'green' : v <= 20 ? 'amber' : 'red') : 'amber'),
          fatiguePct: v => (typeof v === 'number' ? (v <= 20 ? 'green' : v <= 30 ? 'amber' : 'red') : 'amber')
        },
        polarity: {
          wellbeing: 'higher_is_better',
          stressAvg: 'lower_is_better',
          burnoutPct: 'lower_is_better',
          fatiguePct: 'lower_is_better'
        }
      };
      
      async function ensureTemplates() {
        if (!templatePromise) {
          templatePromise = fetch(TEMPLATE_URL)
            .then(response => {
              if (!response.ok) throw new Error('Failed to load KPI template');
              return response.text();
            })
            .then(markup => {
              const parser = new DOMParser();
              const doc = parser.parseFromString(markup, 'text/html');
              const cardsTemplate = doc.querySelector('#tpl-kpi-cards');
              const cardTemplate = doc.querySelector('#tpl-kpi-card');
              if (!cardsTemplate || !cardTemplate) {
                throw new Error('Missing KPI templates');
              }
              return {
                cardsTemplate,
                cardTemplate
              };
            });
        }
        return templatePromise;
      }
      
      function translate(key, fallback) {
        return window.I18N?.t?.(key, fallback) || fallback;
      }
      
      function clampPercent(value) {
        if (typeof value !== 'number' || Number.isNaN(value)) return 0;
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.min(100, value));
      }
      
      function describeTone(tone) {
        switch (tone) {
          case 'green':
            return translate('kpi.state.good', 'On track');
          case 'red':
            return translate('kpi.state.critical', 'Needs attention');
          default:
            return translate('kpi.state.caution', 'Monitor');
        }
      }
      
      function describeDelta(metricKey, delta, config) {
        if (typeof delta !== 'number' || Number.isNaN(delta)) {
          return translate('kpi.delta.na', 'No change available');
        }
        const polarity = config.polarity?.[metricKey] || 'higher_is_better';
        const unit = config.metrics?.[metricKey]?.unit || '';
        const absolute = Math.abs(delta);
        const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
        let direction = 'flat';
        let goodDirection = 'up';
        if (polarity === 'lower_is_better') {
          goodDirection = 'down';
        }
        if (absolute < 0.1) {
          direction = 'flat';
        } else if (delta > 0) {
          direction = 'up';
        } else {
          direction = 'down';
        }
        const isGood = direction === goodDirection;
        const toneKey = isGood ? 'kpi.delta.improved' : direction === 'flat' ? 'kpi.delta.flat' : 'kpi.delta.degraded';
        const fallback = direction === 'flat' ? 'Holding steady' : isGood ? 'Improved' : 'Declined';
        return `${translate(toneKey, fallback)} ${formatted}${unit}`.trim();
      }
      
      function deltaDirection(metricKey, delta, config) {
        if (typeof delta !== 'number' || Number.isNaN(delta) || Math.abs(delta) < 0.1) return 'flat';
        const polarity = config.polarity?.[metricKey] || 'higher_is_better';
        const upIsGood = polarity === 'higher_is_better';
        if (delta > 0) {
          return upIsGood ? 'up' : 'down';
        }
        return upIsGood ? 'down' : 'up';
      }
      
      function formatDeltaValue(delta, metricKey, config) {
        if (typeof delta !== 'number' || Number.isNaN(delta) || Math.abs(delta) < 0.05) {
          return null;
        }
        const unit = config.metrics?.[metricKey]?.unit || '';
        const precision = Math.abs(delta) >= 10 ? 0 : 1;
        return `${delta > 0 ? '+' : ''}${delta.toFixed(precision)}${unit}`;
      }
      
      function resolveBadge(tone) {
        switch (tone) {
          case 'green':
            return translate('kpi.badge.positive', 'Good');
          case 'red':
            return translate('kpi.badge.negative', 'Critical');
          default:
            return translate('kpi.badge.neutral', 'Monitor');
        }
      }
      
      function renderCard(card, metricKey, metricConfig, value, delta, config, variant) {
        const { element, refs } = card;
        const { numberEl, unitEl, badgeEl, hintEl, deltaValueEl, deltaIconEl, assistiveEl, miniFillEl, deltaEl } = refs;
        const tone = typeof value === 'number' ? config.thresholds?.[metricKey]?.(value) : null;
        if (tone) {
          element.dataset.tone = tone;
          badgeEl.textContent = resolveBadge(tone);
        } else {
          delete element.dataset.tone;
          badgeEl.textContent = '';
        }
      
        const isDisabled = variant === 'life' || typeof value !== 'number' || Number.isNaN(value);
        element.dataset.disabled = isDisabled ? 'true' : 'false';
        element.dataset.state = metricConfig.inverse ? 'inverse' : 'normal';
        element.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      
        let hasTrend = false;
      
        if (isDisabled) {
          numberEl.textContent = '—';
          unitEl.textContent = metricConfig.unit || '';
          deltaValueEl.textContent = 'N/A';
          deltaValueEl.removeAttribute('data-dir');
          deltaValueEl.setAttribute('data-good', 'true');
          deltaIconEl.innerHTML = ICONS.flat;
          if (deltaEl) deltaEl.dataset.direction = 'flat';
          assistiveEl.textContent = translate('kpi.assistive.na', 'Data not available for this range.');
        } else {
          const formatted = typeof metricConfig.format === 'function'
            ? metricConfig.format(value)
            : value.toFixed(metricConfig.decimals ?? 0);
          numberEl.textContent = formatted;
          unitEl.textContent = metricConfig.unit || '';
          const direction = deltaDirection(metricKey, delta, config);
          if (deltaEl) deltaEl.dataset.direction = direction;
          if (direction === 'up') {
            deltaIconEl.innerHTML = ICONS.up;
          } else if (direction === 'down') {
            deltaIconEl.innerHTML = ICONS.down;
          } else {
            deltaIconEl.innerHTML = ICONS.flat;
          }
          const formattedDelta = formatDeltaValue(delta, metricKey, config);
          if (formattedDelta) {
            deltaValueEl.textContent = formattedDelta;
            deltaValueEl.setAttribute('data-dir', direction);
            const polarity = config.polarity?.[metricKey] || 'higher_is_better';
            const goodDirection = polarity === 'lower_is_better' ? 'down' : 'up';
            const isGood = direction === 'flat' ? true : direction === goodDirection;
            deltaValueEl.setAttribute('data-good', isGood ? 'true' : 'false');
            hasTrend = true;
          } else {
            deltaValueEl.textContent = 'N/A';
            deltaValueEl.removeAttribute('data-dir');
            deltaValueEl.setAttribute('data-good', 'true');
          }
          assistiveEl.textContent = describeDelta(metricKey, delta, config);
        }
      
        hintEl.textContent = metricConfig.description || '';
      
        const hasValue = !isDisabled && typeof value === 'number' && Number.isFinite(value);
        if (!hasValue || !hasTrend) {
          miniFillEl.style.width = '0%';
        } else {
          const fillValue = metricConfig.inverse
            ? clampPercent(100 - value)
            : clampPercent(value);
          miniFillEl.style.width = `${fillValue}%`;
        }
      }
      
      function createCard(metricKey, metricConfig, cardTemplate) {
        const fragment = cardTemplate.content.cloneNode(true);
        const element = fragment.querySelector('.kpi-card');
        element.dataset.metric = metricKey;
        const labelEl = element.querySelector('.kpi-card__label');
        const numberEl = element.querySelector('.kpi-card__number');
        const unitEl = element.querySelector('.kpi-card__unit');
        const badgeEl = element.querySelector('.kpi-card__badge');
        const hintEl = element.querySelector('.kpi-card__hint');
        const deltaValueEl = element.querySelector('.kpi-card__delta-value');
        const deltaIconEl = element.querySelector('.kpi-card__delta-icon');
        const assistiveEl = element.querySelector('.kpi-card__assistive');
        const miniFillEl = element.querySelector('.kpi-card__mini-fill');
        const deltaEl = element.querySelector('.kpi-card__delta');
      
        const idBase = `kpi-card-${metricKey}-${cardIdCounter += 1}`;
        const labelId = `${idBase}-label`;
        const hintId = `${idBase}-hint`;
        const assistId = `${idBase}-assist`;
      
        labelEl.id = labelId;
        hintEl.id = hintId;
        assistiveEl.id = assistId;
        element.setAttribute('aria-labelledby', labelId);
        element.setAttribute('aria-describedby', `${hintId} ${assistId}`.trim());
      
        labelEl.textContent = typeof metricConfig.label === 'function' ? metricConfig.label() : metricConfig.label;
        hintEl.textContent = metricConfig.description || '';
        assistiveEl.textContent = translate('kpi.assistive.na', 'Data not available for this range.');
      
        return {
          element,
          refs: { numberEl, unitEl, badgeEl, hintEl, deltaValueEl, deltaIconEl, assistiveEl, miniFillEl, deltaEl }
        };
      }
      
      function resolveRangeData(data, range, metricKey) {
        return data?.metrics?.[metricKey]?.[range] || {};
      }
      
      async function mountKpiCards(target, data, config = KPI_CONFIG, opts = {}) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) throw new Error('mountKpiCards: target not found');
        const { cardsTemplate, cardTemplate } = await ensureTemplates();
        el.innerHTML = '';
        const wrapperFragment = cardsTemplate.content.cloneNode(true);
        const grid = wrapperFragment.querySelector('.kpi-cards__grid');
        const variant = document.body?.dataset?.variant || 'demo';
      
        const metricKeys = Object.keys(config.metrics);
        const cards = metricKeys.map(metricKey => {
          const metricConfig = config.metrics[metricKey];
          const card = createCard(metricKey, metricConfig, cardTemplate);
          grid.appendChild(card.element);
          return { key: metricKey, config: metricConfig, ...card };
        });
      
        let currentData = data;
        const availableRanges = config.ranges?.map?.(r => r.id) || [];
      
        const normalizeRange = range => {
          if (typeof range !== 'string') return null;
          return VALID_RANGE_IDS.has(range) ? /** @type {RangeKey} */ (range) : null;
        };
      
        const fallbackRange = normalizeRange(currentData?.defaultRange)
          || normalizeRange(config.defaultRange)
          || normalizeRange(availableRanges[0])
          || '1d';
      
        let activeRange = normalizeRange(opts.initialRange) || fallbackRange;
      
        function renderRange() {
          cards.forEach(card => {
            const metricData = resolveRangeData(currentData, activeRange, card.key);
            const value = variant === 'life' ? undefined : metricData?.value;
            const delta = variant === 'life' ? undefined : metricData?.delta;
            renderCard(card, card.key, card.config, value, delta, config, variant);
          });
          el.dataset.range = activeRange;
        }
      
        function setRange(r) {
          const next = normalizeRange(r);
          if (!next || next === activeRange) return;
          activeRange = next;
          renderRange();
        }
      
        if (typeof opts.bindExternalRange === 'function') {
          opts.bindExternalRange(setRange);
        }
      
        renderRange();
      
        el.classList.add('kpi-cards');
        el.appendChild(wrapperFragment);
      
        return {
          update(newData) {
            currentData = newData;
            renderRange();
          },
          setRange
        };
      }
      
      exports.mountKpiCards = mountKpiCards;
      exports.KPI_CONFIG = KPI_CONFIG;
      exports.ranges: [
          { id: '1d' = ranges: [
          { id: '1d';
      exports.label: '24h' } = label: '24h' };
      exports.{ id: '7d' = { id: '7d';
      exports.label: '7d' } = label: '7d' };
      exports.{ id: '30d' = { id: '30d';
      exports.label: '30d' }
        ] = label: '30d' }
        ];
      exports.metrics: {
          wellbeing: {
            label: () = metrics: {
          wellbeing: {
            label: ();
      exports.'Wellbeing') || 'Wellbeing' = 'Wellbeing') || 'Wellbeing';
      exports.unit: '/100' = unit: '/100';
      exports.description: 'Composite wellbeing score (higher is better)' = description: 'Composite wellbeing score (higher is better)';
      exports.decimals: 0 = decimals: 0;
      exports.format: value = format: value;
      exports.stressAvg: {
            label: () = stressAvg: {
            label: ();
      exports.'Stress average') || 'Stress average' = 'Stress average') || 'Stress average';
      exports.unit: '/100' = unit: '/100';
      exports.description: 'Average stress index (lower is better)' = description: 'Average stress index (lower is better)';
      exports.decimals: 0 = decimals: 0;
      exports.format: value = format: value;
      exports.inverse: true
          } = inverse: true
          };
      exports.burnoutPct: {
            label: () = burnoutPct: {
            label: ();
      exports.'Burnout risk') || 'Burnout risk' = 'Burnout risk') || 'Burnout risk';
      exports.unit: '%' = unit: '%';
      exports.description: 'Share of users flagged for burnout risk' = description: 'Share of users flagged for burnout risk';
      exports.decimals: 1 = decimals: 1;
      exports.format: value = format: value;
      exports.fatiguePct: {
            label: () = fatiguePct: {
            label: ();
      exports.'Elevated fatigue') || 'Elevated fatigue' = 'Elevated fatigue') || 'Elevated fatigue';
      exports.unit: '%' = unit: '%';
      exports.description: 'Share of users with elevated fatigue' = description: 'Share of users with elevated fatigue';
      exports.decimals: 1 = decimals: 1;
      exports.format: value = format: value;
      exports.thresholds: {
          wellbeing: v = thresholds: {
          wellbeing: v;
      exports.stressAvg: v = stressAvg: v;
      exports.burnoutPct: v = burnoutPct: v;
      exports.fatiguePct: v = fatiguePct: v;
      exports.polarity: {
          wellbeing: 'higher_is_better' = polarity: {
          wellbeing: 'higher_is_better';
      exports.stressAvg: 'lower_is_better' = stressAvg: 'lower_is_better';
      exports.burnoutPct: 'lower_is_better' = burnoutPct: 'lower_is_better';
      exports.fatiguePct: 'lower_is_better'
        }
      } = fatiguePct: 'lower_is_better'
        }
      };
    },
    'adapters/kpiAdapter.js': function(require, module, exports) {
      const METRICS = ['wellbeing', 'stressAvg', 'burnoutPct', 'fatiguePct'];
      const RANGE_KEYS = ['1d', '7d', '30d', 'mtd', 'qtd', 'ytd'];
      
      const DATA_URL = new URL('../public/demo/night-shift.json', module.importMetaUrl);
      const BURNOUT_THRESHOLD = 55;
      const FATIGUE_THRESHOLD = 60;
      
      let datasetPromise = null;
      
      // Helpers
      const clamp0_100 = v => Math.max(0, Math.min(100, v));
      
      function safeAvg(arr, key) {
        if (!Array.isArray(arr)) return undefined;
        const vals = arr
          .map(item => {
            if (key == null) return Number(item);
            if (item == null) return NaN;
            return Number(item[key]);
          })
          .filter(Number.isFinite);
        return vals.length ? vals.reduce((sum, value) => sum + value, 0) / vals.length : undefined;
      }
      
      function safePct(numer, denom) {
        if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return undefined;
        return clamp0_100((numer / denom) * 100);
      }
      
      function blankMetric() {
        return RANGE_KEYS.reduce((acc, range) => {
          acc[range] = { value: undefined, delta: undefined };
          return acc;
        }, {});
      }
      
      function toTimestamp(value) {
        if (!value) return NaN;
        const ts = typeof value === 'number' ? value : Date.parse(value);
        return Number.isFinite(ts) ? ts : NaN;
      }
      
      async function loadSamples() {
        if (!datasetPromise) {
          datasetPromise = fetch(DATA_URL)
            .then(response => {
              if (!response.ok) throw new Error(`Failed to load KPI dataset (${response.status})`);
              return response.json();
            })
            .then(raw => {
              if (!Array.isArray(raw)) return [];
              return raw
                .map(item => {
                  const tsMs = toTimestamp(item?.ts);
                  if (!Number.isFinite(tsMs)) return null;
                  return {
                    person_id: item?.person_id,
                    ts: tsMs,
                    scores: item?.scores || {}
                  };
                })
                .filter(Boolean)
                .sort((a, b) => a.ts - b.ts);
            })
            .catch(() => []);
        }
        return datasetPromise;
      }
      
      const DAY_MS = 24 * 60 * 60 * 1000;
      
      function startOfDayUTC(date) {
        if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      
      function startOfLocalDay(d = new Date()) {
        const t = new Date(d);
        t.setHours(0, 0, 0, 0);
        return t;
      }
      
      function endOfLocalDay(d = new Date()) {
        const t = new Date(d);
        t.setHours(23, 59, 59, 999);
        return t;
      }
      
      function windowForRange(range) {
        const now = new Date();
        if (range === '1d') {
          return { from: startOfLocalDay(now), to: endOfLocalDay(now) };
        }
        return { from: null, to: null };
      }
      
      function formatDateKey(date) {
        const normalized = startOfDayUTC(date);
        if (Number.isNaN(normalized.valueOf())) return '';
        const year = normalized.getUTCFullYear();
        const month = String(normalized.getUTCMonth() + 1).padStart(2, '0');
        const day = String(normalized.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      function parseDateKey(key) {
        if (typeof key !== 'string') return null;
        const [yearStr, monthStr, dayStr] = key.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        return new Date(Date.UTC(year, month - 1, day));
      }
      
      function addDays(date, amount) {
        if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
        const result = new Date(date.getTime());
        result.setUTCDate(result.getUTCDate() + amount);
        return startOfDayUTC(result);
      }
      
      function addMonths(date, amount) {
        if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return new Date(NaN);
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
      }
      
      function daysInMonth(year, monthIndex) {
        return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      }
      
      function startOfMonth(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      }
      
      function startOfQuarter(date) {
        const month = date.getUTCMonth();
        const quarterMonth = month - (month % 3);
        return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1));
      }
      
      function endOfQuarter(start) {
        return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
      }
      
      function startOfYear(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      }
      
      async function fetchDaily() {
        const samples = await loadSamples();
        if (!samples.length) return [];
      
        const perDay = new Map();
        samples.forEach(sample => {
          const key = formatDateKey(new Date(sample.ts));
          if (!key) return;
          let byPerson = perDay.get(key);
          if (!byPerson) {
            byPerson = new Map();
            perDay.set(key, byPerson);
          }
          const current = byPerson.get(sample.person_id);
          if (!current || current.ts < sample.ts) {
            byPerson.set(sample.person_id, sample);
          }
        });
      
        const sortedKeys = Array.from(perDay.keys()).sort();
        return sortedKeys.map(key => {
          const people = perDay.get(key);
          const entries = Array.from(people?.values() || []);
          if (!entries.length) {
            return { date: key };
          }
      
          const normalized = entries.map(({ scores }) => ({
            wellbeing: scores?.wellbeing,
            stress: scores?.stress,
            burnout: scores?.burnout,
            fatigue: scores?.fatigue
          }));
      
          let burnoutValid = 0;
          let burnoutRisk = 0;
          let fatigueValid = 0;
          let fatigueElevated = 0;
      
          normalized.forEach(({ burnout, fatigue }) => {
            const burnoutValue = Number(burnout);
            if (Number.isFinite(burnoutValue)) {
              burnoutValid += 1;
              if (burnoutValue >= BURNOUT_THRESHOLD) burnoutRisk += 1;
            }
      
            const fatigueValue = Number(fatigue);
            if (Number.isFinite(fatigueValue)) {
              fatigueValid += 1;
              if (fatigueValue >= FATIGUE_THRESHOLD) fatigueElevated += 1;
            }
          });
      
          return {
            date: key,
            wellbeing: safeAvg(normalized, 'wellbeing'),
            stressAvg: safeAvg(normalized, 'stress'),
            burnoutPct: safePct(burnoutRisk, burnoutValid),
            fatiguePct: safePct(fatigueElevated, fatigueValid)
          };
        });
      }
      
      function aggregate(days) {
        const result = METRICS.reduce((acc, metric) => {
          acc[metric] = { value: undefined, delta: undefined };
          return acc;
        }, {});
      
        if (!Array.isArray(days) || !days.length) {
          return result;
        }
      
        METRICS.forEach(metric => {
          const values = days
            .map(day => day?.[metric])
            .filter(value => typeof value === 'number' && Number.isFinite(value));
          if (values.length) {
            const total = values.reduce((sum, value) => sum + value, 0);
            result[metric].value = total / values.length;
          }
        });
      
        return result;
      }
      
      function withTrend(curr, prev) {
        METRICS.forEach(metric => {
          const currentValue = curr[metric]?.value;
          const previousValue = prev[metric]?.value;
          if (typeof currentValue === 'number' && Number.isFinite(currentValue)
            && typeof previousValue === 'number' && Number.isFinite(previousValue)) {
            const delta = +(currentValue - previousValue).toFixed(1);
            curr[metric].delta = delta;
            curr[metric].trend = delta;
          }
        });
        return curr;
      }
      
      async function getKpiData() {
        const byDay = await fetchDaily();
        if (!byDay.length) {
          return {
            defaultRange: '7d',
            metrics: METRICS.reduce((acc, key) => {
              acc[key] = blankMetric();
              return acc;
            }, {})
          };
        }
      
        const dayMap = new Map(byDay.map(day => [day.date, day]));
        const anchor = startOfDayUTC(parseDateKey(byDay[byDay.length - 1]?.date) || new Date());
      
        function collectDays(start, end) {
          if (!(start instanceof Date) || !(end instanceof Date)) return [];
          if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return [];
          if (start.getTime() > end.getTime()) return [];
      
          const collected = [];
          for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
            const key = formatDateKey(cursor);
            const entry = dayMap.get(key);
            if (entry) collected.push(entry);
          }
          return collected;
        }
      
        function rangeDays(kind) {
          switch (kind) {
            case '1d': {
              // Use dataset anchor (last available day) — not system "today".
              // Anchor is already defined above as the last day from byDay[]:
              //   const anchor = startOfDayUTC(parseDateKey(byDay[byDay.length - 1]?.date) || new Date());
              const currentBase = anchor;
              const currentKey = formatDateKey(currentBase);
              const prevStart = addDays(currentBase, -1);
              const prevKey = formatDateKey(prevStart);
              const currentEntry = dayMap.get(currentKey);
              const previousEntry = dayMap.get(prevKey);
              return {
                currDays: currentEntry ? [currentEntry] : [],
                prevDays: previousEntry ? [previousEntry] : []
              };
            }
            case '7d':
            case '30d': {
              const length = kind === '7d' ? 7 : 30;
              const currStart = addDays(anchor, -(length - 1));
              const prevEnd = addDays(currStart, -1);
              const prevStart = addDays(prevEnd, -(length - 1));
              return {
                currDays: collectDays(currStart, anchor),
                prevDays: collectDays(prevStart, prevEnd)
              };
            }
            case 'mtd': {
              const currStart = startOfMonth(anchor);
              const prevMonthStart = addMonths(currStart, -1);
              const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth()));
              const prevEnd = new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth(), prevEndDay));
              return {
                currDays: collectDays(currStart, anchor),
                prevDays: collectDays(prevMonthStart, prevEnd)
              };
            }
            case 'qtd': {
              const quarterStart = startOfQuarter(anchor);
              const prevQuarterStart = addMonths(quarterStart, -3);
              const daysIntoQuarter = Math.floor((anchor.getTime() - quarterStart.getTime()) / DAY_MS);
              const prevQuarterEnd = endOfQuarter(prevQuarterStart);
              const prevEndCandidate = addDays(prevQuarterStart, daysIntoQuarter);
              const prevEnd = prevEndCandidate.getTime() > prevQuarterEnd.getTime() ? prevQuarterEnd : prevEndCandidate;
              return {
                currDays: collectDays(quarterStart, anchor),
                prevDays: collectDays(prevQuarterStart, prevEnd)
              };
            }
            case 'ytd': {
              const yearStart = startOfYear(anchor);
              const prevYear = anchor.getUTCFullYear() - 1;
              const prevYearStart = new Date(Date.UTC(prevYear, 0, 1));
              const prevEndDay = Math.min(anchor.getUTCDate(), daysInMonth(prevYear, anchor.getUTCMonth()));
              const prevEnd = new Date(Date.UTC(prevYear, anchor.getUTCMonth(), prevEndDay));
              return {
                currDays: collectDays(yearStart, anchor),
                prevDays: collectDays(prevYearStart, prevEnd)
              };
            }
            default:
              return { currDays: [], prevDays: [] };
          }
        }
      
        const metrics = METRICS.reduce((acc, key) => {
          acc[key] = {};
          return acc;
        }, {});
      
        RANGE_KEYS.forEach(rangeKey => {
          const { currDays, prevDays } = rangeDays(rangeKey);
          const current = aggregate(currDays);
          const previous = aggregate(prevDays);
          const payload = withTrend(current, previous);
          METRICS.forEach(metric => {
            metrics[metric][rangeKey] = payload[metric];
          });
        });
      
        return {
          defaultRange: '7d',
          metrics
        };
      }
      
      const KPI_RANGES = [...RANGE_KEYS];
      const KPI_METRICS = [...METRICS];
      
      exports.getKpiData = getKpiData;
      exports.KPI_RANGES = KPI_RANGES;
      exports.KPI_METRICS = KPI_METRICS;
    },
    'assets/js/services/dataSource.js': function(require, module, exports) {
      const { devWarn } = require('assets/js/utils/env.js');
      
      const DEMO_DATA_ROOT = '/HR/assets/data/demo';
      const LIVE_DATA_ROOT = '/HR/assets/data/live';
      
      const datasetCache = new Map();
      
      function baseUrl(rel){return window.location.pathname.replace(/\/[^/]*$/,'')+rel;}
      
      function getMode(){
        const params = new URLSearchParams(window.location.search);
        const attr = document.body?.dataset?.page;
        if (attr === 'demo') return 'demo';
        return params.get('mode') === 'live' ? 'live' : 'demo';
      }
      async function loadSamples(mode){
        return mode === 'DEMO' ? loadDemoSamples() : loadLiveSamples();
      }
      
      async function loadDemoSamples(){
        const data = await fetchFromBase('/public/demo/night-shift.json');
        return data ?? [];
      }
      
      async function loadLiveSamples(){
        return [];
      }
      
      async function loadDevices(){
        const data = await safeFetchJson(baseUrl('/public/demo/devices.json'));
        return data ?? [];
      }
      
      async function loadDataset(kind, ctx = {}){
        const key = normaliseKind(kind);
        if (!key) return null;
      
        const storeMode = typeof window !== 'undefined' ? window.appStore?.getState?.()?.mode : undefined;
        const rawMode = ctx.mode ?? storeMode ?? (typeof getMode === 'function' ? getMode() : 'demo');
        const mode = String(rawMode || '').toLowerCase() === 'live' ? 'live' : 'demo';
        const cacheKey = `${mode}:${key}`;
        if (datasetCache.has(cacheKey)) {
          return datasetCache.get(cacheKey);
        }
      
        const demoUrl = buildDemoUrl(key, ctx);
        const loadDemo = async (targetMode = mode) => {
          const demoData = await safeFetchJson(demoUrl);
          if (demoData !== null) {
            cacheDataset('demo', key, demoData);
            cacheDataset(targetMode, key, demoData);
          }
          return demoData;
        };
      
        if (mode === 'demo') {
          return loadDemo('demo');
        }
      
        try {
          const liveUrl = buildLiveUrl(key, ctx);
          const response = await fetch(liveUrl, { credentials: 'omit', cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`live ${response.status}`);
          }
          const payload = await response.json();
          cacheDataset('live', key, payload);
          return payload;
        } catch (err) {
          return loadDemo('live');
        }
      }
      
      async function safeFetchJson(url,{label='[demo] dataset not found:'}={}){
        try{
          const response = await fetch(url,{cache:'no-store'});
          if(!response.ok){
            throw new Error(`HTTP ${response.status}`);
          }
          return await response.json();
        }catch(err){
          devWarn(label, url, err);
          return null;
        }
      }
      
      async function fetchFromBase(rel){
        const data = await safeFetchJson(baseUrl(rel));
        return data ?? [];
      }
      
      function cacheDataset(mode, key, data){
        const cacheKey = `${mode}:${key}`;
        datasetCache.set(cacheKey, data);
      }
      
      function normaliseKind(value){
        return String(value || '').trim().toLowerCase();
      }
      
      function buildDemoUrl(kind){
        const cleanBase = DEMO_DATA_ROOT.replace(/\/+$/, '');
        return `${cleanBase}/${kind}.json`;
      }
      
      function buildLiveUrl(kind){
        const base = window.APP_CONFIG?.liveDataBase || LIVE_DATA_ROOT;
        const cleanBase = String(base || '').replace(/\/+$/, '');
        return `${cleanBase}/${kind}.json`;
      }
      
      if (typeof globalThis !== 'undefined' && typeof globalThis.safeFetchJson !== 'function') {
        globalThis.safeFetchJson = safeFetchJson;
      }
      
      exports.loadSamples = loadSamples;
      exports.loadDemoSamples = loadDemoSamples;
      exports.loadLiveSamples = loadLiveSamples;
      exports.loadDevices = loadDevices;
      exports.loadDataset = loadDataset;
      exports.safeFetchJson = safeFetchJson;
      exports.getMode = getMode;
    },
    'assets/js/data-loader.js': function(require, module, exports) {
      const { devError, devWarn } = require('assets/js/utils/env.js');
      const { safeFetchJson } = require('assets/js/services/dataSource.js');
      
      const BUILD_V='2025-10-26-01';
      const withV=u=>{
        if(u==null)return u;
        try{
          const url=u instanceof URL?new URL(u.toString()):new URL(String(u),typeof document!=='undefined'?document.baseURI:undefined);
          if(!url.searchParams.has('v')){url.searchParams.set('v',BUILD_V);}return url.toString();
        }catch(err){
          const value=String(u);
          if(!value)return value;
          return `${value}${value.includes('?')?'&':'?'}v=${BUILD_V}`;
        }
      };
      async function fetchJson(u){
        return await safeFetchJson(u, { label: '[stress] dataset not found:' });
      }
      
      const BASE='/HR';
      const SCENARIO_PATH={
        live:`${BASE}/data/scenario/live.json`,
        night:`${BASE}/data/scenario/night.json`,
        demo:`${BASE}/data/scenario/demo.json`
      };
      
      const SCENARIO_ALIASES={
        live:'live',
        production:'live',
        prod:'live',
        default:'live',
        main:'live',
        night:'night',
        'night-shift':'night',
        'night_shift':'night',
        nightshift:'night',
        demo:'demo',
        sandbox:'demo',
        preview:'demo'
      };
      
      const scenarioCache=new Map();
      
      const indexCache = new Map();
      const dayCache = new Map();
      
      function ensureLoaderGlobals(){
        const g = typeof window !== 'undefined' ? window : globalThis;
        if (!g.loaderGlobals) {
          g.loaderGlobals = {};
        }
        return g.loaderGlobals;
      }
      
      function normaliseDateKey(value){
        if (!value) return null;
        if (value instanceof Date) {
          const copy = new Date(value);
          copy.setHours(0, 0, 0, 0);
          return copy.toISOString().slice(0, 10);
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return normaliseDateKey(new Date(value));
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return null;
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
          }
          const date = new Date(trimmed);
          if (!Number.isNaN(date.getTime())) {
            return normaliseDateKey(date);
          }
        }
        return null;
      }
      
      function versionedPath(path){
        try {
          return withV(path);
        } catch (err) {
          return path;
        }
      }
      
      const canonicalScenarioKey=value=>{
        const key=String(value||'').toLowerCase().trim();
        if(key&&SCENARIO_ALIASES[key])return SCENARIO_ALIASES[key];
        if(key&&SCENARIO_PATH[key])return key;
        return 'live';
      };
      
      function scenarioUrl(key){
        const canonical=canonicalScenarioKey(key);
        const path=SCENARIO_PATH[canonical];
        if(!path) throw new Error(`Unknown scenario: ${key}`);
        return withV(path);
      }
      
      async function loadScenarioManifest(input,{refresh=false,fallback=true}={}){
        const requested=canonicalScenarioKey(input);
        if(!refresh&&scenarioCache.has(requested)){
          return scenarioCache.get(requested);
        }
      
        const fetchManifest=async key=>{
          const url=scenarioUrl(key);
          const response=await fetch(url,{cache:'no-store'});
          if(!response.ok){
            return {ok:false,status:response.status,url};
          }
          const payload=await response.json();
          return {ok:true,data:payload};
        };
      
        let result=await fetchManifest(requested);
        if(!result.ok){
          if(result.status===404&&fallback&&requested!=='demo'){
            devWarn('Scenario not found, fallback to demo');
            const fallbackResult=await fetchManifest('demo');
            if(!fallbackResult.ok){
              const error=new Error('No dataset available');
              error.code='SCENARIO_UNAVAILABLE';
              throw error;
            }
            const manifest=decorateScenarioManifest(fallbackResult.data,{requested,resolved:'demo',fallback:true});
            cacheScenarioManifest(manifest,requested,'demo');
            dispatchScenarioFallback(requested,'demo');
            return manifest;
          }
          const error=new Error(`Scenario load failed (${result.status||'unknown'})`);
          error.code='SCENARIO_UNAVAILABLE';
          throw error;
        }
      
        const manifest=decorateScenarioManifest(result.data,{requested,resolved:canonicalScenarioKey(result.data?.key||requested),fallback:false});
        cacheScenarioManifest(manifest,requested,manifest.meta.resolved);
        return manifest;
      }
      
      function decorateScenarioManifest(data,{requested,resolved,fallback}){
        const resolvedKey=canonicalScenarioKey(resolved||requested);
        const manifest=Object.assign({},data||{}, {
          key: resolvedKey
        });
        manifest.meta={requested:canonicalScenarioKey(requested),resolved:resolvedKey,fallback:!!fallback};
        return manifest;
      }
      
      function cacheScenarioManifest(manifest,requested,resolved){
        const canonicalRequested=canonicalScenarioKey(requested);
        const canonicalResolved=canonicalScenarioKey(resolved||manifest?.key||canonicalRequested);
        scenarioCache.set(canonicalRequested,manifest);
        scenarioCache.set(canonicalResolved,manifest);
      }
      
      function dispatchScenarioFallback(from,to){
        try{
          if(typeof window!=='undefined'&&window.dispatchEvent){
            window.dispatchEvent(new CustomEvent('scenario:fallback',{detail:{from:canonicalScenarioKey(from),to:canonicalScenarioKey(to)}}));
          }
        }catch(err){
          /* noop */
        }
      }
      
      function currentScenario(){
        try {
          const raw=localStorage.getItem('hr:scenario') || 'live';
          return canonicalScenarioKey(raw);
        } catch (err) {
          return 'live';
        }
      }
      
      async function loadIndex({ refresh = false, scenario } = {}){
        const scenarioKey = canonicalScenarioKey(scenario || currentScenario());
        const cacheKey = `${scenarioKey}`;
        if (!refresh && indexCache.has(cacheKey)) {
          return indexCache.get(cacheKey);
        }
      
        let manifest = null;
        try {
          manifest = await loadScenarioManifest(scenarioKey);
        } catch (err) {
          devError('[DataLoader] Failed to resolve scenario index', err);
        }
      
        const indexPath = manifest?.stress?.index || './data/stress/raw/index.json';
        const url = versionedPath(indexPath);
        try {
          const payload = await fetchJson(url);
          indexCache.set(cacheKey, payload);
          return payload;
        } catch (err) {
          devError('[DataLoader] Failed to load stress index', err);
          indexCache.set(cacheKey, null);
          return null;
        }
      }
      
      async function loadDay(input, { refresh = false, scenario } = {}){
        const iso = normaliseDateKey(input);
        if (!iso) return null;
        const requestedScenario = canonicalScenarioKey(scenario || currentScenario());
        let manifest = null;
        try {
          manifest = await loadScenarioManifest(requestedScenario);
        } catch (err) {
          devError('[DataLoader] Failed to resolve scenario manifest', err);
        }
        const resolvedScenario = canonicalScenarioKey(manifest?.meta?.resolved || manifest?.key || requestedScenario);
        const cacheKey = `${resolvedScenario}|${iso}`;
        if (!refresh && dayCache.has(cacheKey)) {
          return dayCache.get(cacheKey);
        }
      
        const basePath = manifest?.stress?.base || './data/stress/raw';
        const trimmedBase = String(basePath || '').replace(/\/+$/, '');
        const url = versionedPath(`${trimmedBase}/${iso}.json`);
      
        try {
          const payload = await fetchJson(url);
          dayCache.set(cacheKey, payload);
          return payload;
        } catch (err) {
          devError(`[DataLoader] Failed to load stress day ${iso}`, err);
          dayCache.set(cacheKey, null);
          return null;
        }
      }
      
      const globals = ensureLoaderGlobals();
      Object.assign(globals, { BUILD_V, withV, fetchJson, loadIndex, loadDay, canonicalScenarioKey, loadScenarioManifest });
      
      exports.fetchJson = fetchJson;
      exports.loadScenarioManifest = loadScenarioManifest;
      exports.loadIndex = loadIndex;
      exports.loadDay = loadDay;
      exports.BUILD_V = BUILD_V;
      exports.withV = withV;
      exports.canonicalScenarioKey = canonicalScenarioKey;
    },
    'assets/js/api.js': function(require, module, exports) {
      (function(g){
        const loaderGlobals = g.loaderGlobals || {};
        const applyVersion = typeof loaderGlobals.withV === 'function' ? loaderGlobals.withV : (url => url);
        const loadJson = typeof loaderGlobals.fetchJson === 'function'
          ? loaderGlobals.fetchJson
          : async url => {
              const response = await fetch(url, {cache: 'no-store'});
              if (response.status === 404) return null;
              if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
              return response.json();
            };
      
        async function directFetch(path, options){
          const {range, team, params, ...rest} = options || {};
          const url = new URL(path, document.baseURI);
          if (range && typeof range === 'object') {
            Object.entries(range).forEach(([key, value])=>{
              if (value != null) url.searchParams.set(key, value);
            });
          }
          if (team) {
            url.searchParams.set('team', team);
          }
          if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value])=>{
              if (value != null) url.searchParams.set(key, value);
            });
          }
          const finalUrl = applyVersion(url.toString());
          const mode = (options && options.as) || 'json';
          if (mode === 'json') {
            return loadJson(finalUrl);
          }
          const response = await fetch(finalUrl, {cache: 'no-store', ...rest});
          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }
          return response.text();
        }
      
        const API = {
          async fetch(path, options){
            return directFetch(path, options || {});
          },
          async fetchJSON(path, options){
            const opts = Object.assign({}, options, { as: 'json' });
            return directFetch(path, opts);
          },
          clearCache(){
            if (typeof loaderGlobals.clearCache === 'function') {
              loaderGlobals.clearCache();
            }
          }
        };
      
        g.API = API;
      })(window);
    },
    'assets/js/i18n.js': function(require, module, exports) {
      (function(){
        const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
        const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
        let dict = {};
        let ready = false;
        let queue = [];
        let currentLang = 'en';
      
        function safeCall(fn){
          try {
            fn();
          } catch (err) {
            devError('i18n:onReady handler', err);
          }
        }
      
        function format(template, vars){
          return template.replace(/\{(\w+)\}/g, (_, key) => (vars && key in vars) ? vars[key] : `{${key}}`);
        }
      
        function flattenDictionary(source){
          const target = {};
          const walk = (node, prefix) => {
            if (node && typeof node === 'object' && !Array.isArray(node)) {
              Object.entries(node).forEach(([key, value]) => {
                const next = prefix ? `${prefix}.${key}` : key;
                walk(value, next);
              });
            } else if (prefix) {
              target[prefix] = node;
            }
          };
          walk(source, '');
          return target;
        }
      
        function translateElement(el){
          const key = el.getAttribute('data-i18n');
          if (!key) return;
          const attrTargets = (el.getAttribute('data-i18n-attr') || '').split(/[,\s]+/).filter(Boolean);
          const translation = t(key);
          if (!attrTargets.length || attrTargets.includes('text')) {
            el.textContent = translation;
          }
          attrTargets.forEach(attr => {
            if (attr === 'text') return;
            el.setAttribute(attr, translation);
          });
        }
      
        function translateDocument(){
          if (typeof document === 'undefined') return;
          document.querySelectorAll('[data-i18n]').forEach(translateElement);
        }
      
        function flushQueue(){
          const pending = queue.splice(0);
          pending.forEach(safeCall);
        }
      
        function storeLang(lang){
          try {
            const upperLang = typeof lang === 'string' ? lang.toUpperCase() : 'EN';
            localStorage.setItem('demo-lang', upperLang);
            localStorage.setItem('lang', lang);
            localStorage.setItem('hr:lang', lang);
          } catch (err) {
            // ignore storage failures
          }
        }
      
        function t(key, vars){
          let template = dict[key];
          if (typeof template !== 'string') {
            template = key.replace(/^label\.|^range\./, '');
          }
          return format(String(template), vars);
        }
      
        function onReady(fn){
          if (typeof fn !== 'function') return;
          if (ready) {
            safeCall(fn);
          } else {
            queue.push(fn);
          }
        }
      
        async function init(lang){
          const target = (lang || 'en').toLowerCase();
          const ver = window.APP_VERSION || '';
          ready = false;
          try {
            const response = await fetch(`./assets/locales/${target}.json?v=${ver}`);
            if (!response.ok) {
              throw new Error(`i18n: failed ${target}`);
            }
            const payload = await response.json();
            dict = flattenDictionary(payload);
            currentLang = target;
          } catch (err) {
            if (target !== 'en') {
              return init('en');
            }
            devWarn('i18n: fallback to keys');
            dict = {};
            currentLang = 'en';
          }
      
          ready = true;
          storeLang(currentLang);
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('lang', currentLang);
            translateDocument();
          }
          flushQueue();
          window.dispatchEvent(new Event('i18n:ready'));
          window.dispatchEvent(new CustomEvent('i18n:change', {detail: {lang: currentLang}}));
          return currentLang;
        }
      
        function setLang(lang){
          queue = [];
          return init(lang);
        }
      
        function set(lang){
          return setLang(lang);
        }
      
        function getLang(){
          return currentLang;
        }
      
        window.I18N = { t, onReady, init, setLang, set, getLang, translate: translateDocument, refresh: translateDocument };
        window.t = (key, vars) => t(key, vars);
      })();
    },
    'assets/js/team-filter.js': function(require, module, exports) {
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
          const direct = document.getElementById('teamSelect');
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
          label.setAttribute('for', 'team-filter-select');
          label.textContent = window.I18N?.t('label.teamFilter') || 'Team';
      
          selectEl = document.createElement('select');
          selectEl.id = 'team-filter-select';
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
    },
    'assets/js/version.js': function(require, module, exports) {
      (async function(){
        const loaderGlobals = window.loaderGlobals || {};
        const fetchJson = typeof loaderGlobals.fetchJson === 'function'
          ? loaderGlobals.fetchJson
          : async url => {
              const response = await fetch(url, {cache: 'no-store'});
              if (response.status === 404) return null;
              if (!response.ok) throw new Error(`version fetch failed: ${response.status}`);
              return response.json();
            };
        const withVersion = typeof loaderGlobals.withV === 'function'
          ? loaderGlobals.withV
          : value => value;
      
        let version = '';
        try {
          const url = new URL('./data/version.json', document.baseURI);
          url.searchParams.set('ts', Date.now().toString());
          const payload = await fetchJson(withVersion(url.toString()));
          version = payload?.v || '';
        } catch (err) {
          version = '';
        }
      
        window.APP_VERSION = version;
        window.dispatchEvent(new CustomEvent('app:version', {detail: {version}}));
      
        let preferredLang = 'en';
        try {
          preferredLang = localStorage.getItem('demo-lang')
            || localStorage.getItem('lang')
            || localStorage.getItem('hr:lang')
            || 'en';
        } catch (err) {
          preferredLang = 'en';
        }
      
        if (window.I18N?.init) {
          window.I18N.init(preferredLang);
        }
      })();
    },
    'assets/js/site.js': function(require, module, exports) {
      (function(){
        const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
        const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
        const EVENT_NAME = 'site:ready';
        const GROUPS = {
          ops: ['ops'],
          it: ['it'],
          lab: ['lab'],
          cs: ['adm', 'cat', 'oim']
        };
        const LABELS = {
          ops: 'Production',
          it: 'Maintenance & IT',
          lab: 'Lab & HSE',
          cs: 'Day-Shift Support'
        };
        const visibleRows = Object.keys(GROUPS);
        let dispatched = false;
      
        async function init(){
          const version = window.APP_VERSION || '';
          const url = new URL('./data/site/demo.json', document.baseURI);
          if (version) {
            url.searchParams.set('v', version);
          }
          let payload = null;
          let error = null;
          try {
            const response = await fetch(url.toString(), {cache: 'no-store'});
            if (!response.ok) {
              throw new Error(`site: failed to load (${response.status})`);
            }
            payload = await response.json();
          } catch (err) {
            error = err;
            devError('site: data load failed', err);
          }
      
          const site = normalizeSite(payload);
          window.SITE = site;
          dispatched = true;
          window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {site, error}}));
        }
      
        function normalizeSite(payload){
          const departments = Array.isArray(payload?.departments) ? payload.departments : [];
          const map = {};
          let totalHeadcount = 0;
      
          visibleRows.forEach(id => {
            const members = GROUPS[id] || [id];
            const label = LABELS[id] || id;
            const headcount = members.reduce((sum, deptId) => {
              const match = departments.find(dept => String(dept.id) === String(deptId));
              const value = Number(match?.headcount);
              return sum + (Number.isFinite(value) ? value : 0);
            }, 0);
            map[id] = {id, label, headcount};
            totalHeadcount += headcount;
          });
      
          return {
            ready: true,
            visibleRows: visibleRows.slice(),
            map,
            totals: {headcount: totalHeadcount},
            raw: payload || null,
            name: payload?.site || 'Org'
          };
        }
      
        function boot(){
          if (dispatched) return;
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, {once: true});
          } else {
            init();
          }
        }
      
        if (typeof window !== 'undefined') {
          boot();
        }
      })();
    },
    'assets/js/nav.js': function(require, module, exports) {
      // assets/js/nav.js
      (function(){
        // 1) Single source of nav items
        window.NAV_ITEMS = [
          {id:'corporate',  href:'Corporate.html',  i18n:'nav.corporate'},
          {id:'analytics',  href:'Analytics.html',  i18n:'nav.analytics'},
          {id:'engagement', href:'Engagement.html', i18n:'nav.engagement'},
          {id:'devices',    href:'Devices.html',    i18n:'nav.devices'},
          {id:'settings',   href:'Settings.html',   i18n:'nav.settings'},
          // pinned at bottom:
          {id:'demo',       href:'Demo.html',       i18n:'nav.demo', position:'bottom'}
        ];
      
        // 2) Fallback English labels (in case i18n is late)
        const LABEL_EN = {
          analytics:'Analytics', engagement:'Engagement',
          corporate:'Corporate', devices:'Devices', settings:'Settings', demo:'Demo'
        };
      
        // 3) Render function
        window.renderSideNav = function(activeId){
          // Accept either #side-nav or legacy #sidebar-slot
          const host = document.getElementById('side-nav') || document.getElementById('sidebar-slot');
          if(!host) return;
      
          host.innerHTML = `
            <nav class="side">
              <a class="brand" data-brand-link href="Corporate.html">SPA2099 HR Health</a>
              <ul class="menu top"   aria-label="Primary"></ul>
              <ul class="menu bottom" aria-label="Secondary"></ul>
            </nav>`;
      
          const logoLink = host.querySelector('[data-brand-link]');
          if (logoLink) {
            let mode = 'demo';
            try {
              const sp = new URLSearchParams(location.search);
              const queryMode = sp.get('mode');
              const stored = localStorage.getItem('spa2099_mode') || 'DEMO';
              mode = String(queryMode || stored || 'DEMO').toLowerCase();
            } catch (err) {
              const sp = new URLSearchParams(location.search);
              mode = String(sp.get('mode') || 'DEMO').toLowerCase();
            }
            logoLink.href = `Corporate.html?mode=${mode}`;
          }
      
          const top = host.querySelector('.menu.top');
          const bottom = host.querySelector('.menu.bottom');
      
          NAV_ITEMS.forEach(item=>{
            const li = document.createElement('li');
            const a  = document.createElement('a');
            const fallback = LABEL_EN[item.id] || item.id;
            a.href = item.href;
            a.dataset.id = item.id;
            a.dataset.short = (item.short || fallback.charAt(0) || item.id).toUpperCase();
            a.setAttribute('aria-label', fallback);
            a.setAttribute('title', fallback);
            a.setAttribute('data-i18n', item.i18n);
            a.setAttribute('data-i18n-attr', 'aria-label,title');
      
            const label = document.createElement('span');
            label.className = 'nav-label';
            label.textContent = fallback;
            label.setAttribute('data-i18n', item.i18n);
      
            a.appendChild(label);
            li.appendChild(a);
            (item.position === 'bottom' ? bottom : top).appendChild(li);
          });
      
          // Active state
          const here = (location.pathname.split('/').pop() || '').toLowerCase();
          host.querySelectorAll('a').forEach(a=>{
            const fname = a.getAttribute('href').split('/').pop().toLowerCase();
            if (fname === here) a.classList.add('active');
          });
      
          const active = host.querySelector('a.active');
          if (active) {
            const scrollHost = active.closest('.menu.top') || active.parentElement;
            if (scrollHost && typeof active.scrollIntoView === 'function') {
              active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
            }
          }
      
          // Translate just-in-time (if i18n is present)
          try { window.I18N?.refresh?.(host); } catch(e){/* noop */}
      
          const links = Array.from(host.querySelectorAll('.menu a'));
          links.forEach(link => {
            const labelText = link.querySelector('.nav-label')?.textContent?.trim?.();
            if (labelText) {
              link.dataset.short = labelText.charAt(0).toUpperCase();
            }
            link.addEventListener('keydown', evt => handleKeydown(evt, links));
            link.addEventListener('focus', () => {
              if (typeof link.scrollIntoView === 'function') {
                link.scrollIntoView({block: 'nearest'});
              }
            });
          });
      
          // Self-check in console to debug
          console.debug('nav:', [...host.querySelectorAll('a')].map(a=>a.textContent.trim()));
      
          requestAnimationFrame(()=>{
            const initialActive = document.querySelector('#side-nav a.active');
            const topMenu = document.querySelector('#side-nav .menu.top');
            if (initialActive && topMenu && initialActive.closest('.menu.top') === topMenu) {
              initialActive.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
          });
        };
      
        // 4) Last-resort auto-render if page forgot to call
        document.addEventListener('DOMContentLoaded', ()=>{
          if(!document.querySelector('#side-nav a, #sidebar-slot a')){
            const guess = (location.pathname.match(/(\w+)\.html$/)?.[1] || 'corporate').toLowerCase();
            renderSideNav(guess);
          }
        });
      
        function handleKeydown(evt, links){
          if (!evt || !links || !links.length) return;
          const key = evt.key;
          const current = evt.currentTarget;
          const index = links.indexOf(current);
          if (index === -1) return;
      
          if (key === 'ArrowDown') {
            evt.preventDefault();
            const next = links[index + 1] || links[0];
            next?.focus();
          } else if (key === 'ArrowUp') {
            evt.preventDefault();
            const prev = links[index - 1] || links[links.length - 1];
            prev?.focus();
          } else if (key === 'Home') {
            evt.preventDefault();
            links[0]?.focus();
          } else if (key === 'End') {
            evt.preventDefault();
            links[links.length - 1]?.focus();
          } else if (key === 'Enter' || key === ' ') {
            evt.preventDefault();
            current?.click();
          }
        }
      })();
    },
    'assets/js/app-shell.js': function(require, module, exports) {
      (function(){
        window.ASSET_VERSION = '2025.10.19-05';
        if (typeof window.APP_VERSION === 'undefined' || !window.APP_VERSION) {
          window.APP_VERSION = window.ASSET_VERSION;
        }
        function initDensity(){
          if (!document?.body) return;
          let density = 'compact';
          try {
            density = localStorage.getItem('hr:density') || 'compact';
          } catch (err) {
            density = 'compact';
          }
          if (density === 'compact') {
            document.body.classList.add('density--compact');
          }
          try {
            localStorage.setItem('hr:density', 'compact');
          } catch (err) {
            // ignore storage failures
          }
        }
      
        function initLang(){
          const host = document.getElementById('lang-switch');
          if (!host) return;
      
          host.innerHTML = `
            <button class="pill range-pill lang-pill" data-lang="en" id="btn-lang-en" type="button">EN</button>
            <button class="pill range-pill lang-pill" data-lang="nl" id="btn-lang-nl" type="button">NL</button>
            <button class="pill range-pill lang-pill" data-lang="ru" id="btn-lang-ru" type="button">RU</button>
          `;
          host.setAttribute('role', 'group');
      
          const updateGroupLabel = () => {
            const label = window.I18N?.t?.('label.language');
            host.setAttribute('aria-label', label || 'Language');
          };
          updateGroupLabel();
      
          const updateActive = (lang)=>{
            host.querySelectorAll('button').forEach(btn => {
              const isActive = btn.dataset.lang === lang;
              btn.classList.toggle('is-active', isActive);
              btn.classList.remove('active');
              btn.setAttribute('aria-pressed', String(isActive));
            });
          };
      
          const apply = (lang)=>{
            const run = (resolvedLang)=>{
              const nextLang = resolvedLang || lang;
              if (typeof document !== 'undefined') {
                if (window.I18N?.refresh) {
                  window.I18N.refresh(document.body);
                }
              }
              document.dispatchEvent(new CustomEvent('language:changed', {detail: {lang: nextLang}}));
              updateActive(nextLang);
            };
      
            try {
              const upperLang = typeof lang === 'string' ? lang.toUpperCase() : 'EN';
              localStorage.setItem('demo-lang', upperLang);
              localStorage.setItem('lang', lang);
              localStorage.setItem('hr:lang', lang);
            } catch (err) {
              // storage is optional
            }
      
            if (typeof window.I18N?.setLang === 'function') {
              Promise.resolve(window.I18N.setLang(lang))
                .then(() => run(window.I18N?.getLang?.()))
                .catch(() => run(window.I18N?.getLang?.() || lang));
            } else if (typeof window.I18N?.set === 'function') {
              try {
                window.I18N.set(lang);
              } catch (err) {
                // ignore set errors
              }
              run(window.I18N?.getLang?.() || lang);
            } else {
              run(lang);
            }
          };
      
          const saved = (() => {
            try {
              return localStorage.getItem('demo-lang')
                || localStorage.getItem('lang')
                || localStorage.getItem('hr:lang')
                || window.I18N?.getLang?.()
                || 'en';
            } catch (err) {
              return window.I18N?.getLang?.() || 'en';
            }
          })();
      
          apply(saved);
      
          host.addEventListener('click', event => {
            const lang = event.target?.dataset?.lang;
            if (!lang) return;
            if (host.querySelector(`button[data-lang="${lang}"]`)?.classList.contains('active')) {
              return;
            }
            apply(lang);
          });
      
          window.addEventListener('i18n:change', evt => {
            const lang = evt?.detail?.lang || window.I18N?.getLang?.();
            if (lang) {
              updateActive(lang);
            }
            updateGroupLabel();
          });
        }
      
        function init(){
          initDensity();
          initLang();
        }
      
        if (document.readyState !== 'loading') {
          init();
        } else {
          document.addEventListener('DOMContentLoaded', init);
        }
      })();
    },
    'assets/js/date-controls.js': function(require, module, exports) {
      (function(g){
        const RANGE_KEY = 'hr:range';
        const COMPARE_KEY = 'hr:compare';
        const DEFAULT_PRESETS = ['today', '7d', 'mtd', 'qtd', 'ytd'];
        const DEFAULT_PRESET = '7d';
      
        function normalizePreset(value){
          if (!value && value !== 0) return null;
          const normalized = String(value).trim().toLowerCase();
          if (normalized === 'day') return 'today';
          return normalized;
        }
      
        function translateRange(key, fallback){
          const translated = g.I18N?.t?.(`range.${key}`);
          if (translated && translated !== `range.${key}`) return translated;
          if (fallback) return fallback;
          return key.toUpperCase();
        }
      
        function translate(key, fallback){
          const translated = g.I18N?.t?.(key);
          if (translated && translated !== key) return translated;
          return fallback != null ? fallback : key;
        }
      
        function mapPresetToKpiRange(range){
          const preset = normalizePreset(range?.preset);
          if (preset === 'today') return '1d';
          if (preset === '7d') return '7d';
          if (preset === 'mtd' || preset === 'qtd' || preset === 'ytd') return '30d';
          if (range?.start && range?.end) return '30d';
          return '7d';
        }
      
        function emitToolbarRange(range){
          if (typeof document?.dispatchEvent !== 'function') return;
          const resolved = mapPresetToKpiRange(range);
          if (!resolved) return;
          document.dispatchEvent(new CustomEvent('toolbar:range', { detail: { range: resolved } }));
        }
      
        function parseRangeString(raw){
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }
          } catch (err) {
            return null;
          }
          return null;
        }
      
        function readRange(){
          try {
            const raw = localStorage.getItem(RANGE_KEY);
            if (!raw) return null;
            const parsed = parseRangeString(raw);
            if (!parsed) return null;
            if (parsed.preset) return {preset: parsed.preset};
            if (parsed.start && parsed.end) {
              return {start: parsed.start, end: parsed.end};
            }
          } catch (err) {
            return null;
          }
          return null;
        }
      
        function readCompare(){
          try {
            const raw = localStorage.getItem(COMPARE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed && parsed.enabled);
          } catch (err) {
            return false;
          }
        }
      
        function saveRange(value){
          const payload = value && typeof value === 'object' ? value : null;
          if (!payload) return;
          try {
            localStorage.setItem(RANGE_KEY, JSON.stringify(payload));
          } catch (err) {
            /* ignore quota errors */
          }
          emitToolbarRange(payload);
          const evt = new StorageEvent('storage', {key: RANGE_KEY});
          try {
            Object.defineProperty(evt, 'synthetic', { value: true });
          } catch (err) {
            try {
              evt.synthetic = true;
            } catch (err2) {
              /* ignore */
            }
          }
          dispatchEvent(evt);
        }
      
        function saveCompare(enabled){
          try {
            localStorage.setItem(COMPARE_KEY, JSON.stringify({enabled}));
          } catch (err) {
            /* ignore quota errors */
          }
          dispatchEvent(new StorageEvent('storage', {key: COMPARE_KEY}));
        }
      
        function mount(hostSelector, options={}){
          const host = resolveElement(hostSelector);
          if (!host) return;
      
          const config = {
            presets: Array.isArray(options.presets) && options.presets.length
              ? options.presets.map(normalizePreset)
              : DEFAULT_PRESETS,
            compare: Boolean(options.compare)
          };
      
          const startSlot = resolveElement(options.startSlot) || document.querySelector('[data-date-slot="start"]');
          const endSlot = resolveElement(options.endSlot) || document.querySelector('[data-date-slot="end"]');
          const compareSlot = resolveElement(options.compareSlot) || document.querySelector('[data-compare-slot]');
      
          host.innerHTML = '';
          host.classList.add('seg-group');
          host.setAttribute('role', 'group');
      
          const presetButtons = config.presets.map(key => createPresetButton(key, host));
      
          const startField = ensureDateField(startSlot, 'dc-start', 'range.start', 'Start');
          const endField = ensureDateField(endSlot, 'dc-end', 'range.end', 'End');
          const compareToggle = ensureCompareField(compareSlot, config.compare);
      
          const handleDateChange = () => {
            if (startField?.input?.value && endField?.input?.value) {
              saveRange({start: startField.input.value, end: endField.input.value});
            }
          };
      
          if (startField?.input) {
            startField.input.addEventListener('change', handleDateChange);
          }
          if (endField?.input) {
            endField.input.addEventListener('change', handleDateChange);
          }
      
          if (compareToggle?.input) {
            compareToggle.input.addEventListener('change', () => {
              saveCompare(Boolean(compareToggle.input.checked));
            });
          }
      
          function updateLocale(){
            const groupLabel = translate('range.group', 'Date range');
            host.setAttribute('aria-label', groupLabel);
            presetButtons.forEach(button => {
              const key = button.dataset.preset;
              button.textContent = translateRange(key, key.toUpperCase());
            });
            if (startField?.label) {
              const text = translate('range.start', 'Start');
              startField.label.textContent = text;
              startField.input?.setAttribute('aria-label', text);
            }
            if (endField?.label) {
              const text = translate('range.end', 'End');
              endField.label.textContent = text;
              endField.input?.setAttribute('aria-label', text);
            }
            if (compareToggle?.label) {
              compareToggle.label.textContent = translate('range.compare', 'Compare');
            }
          }
      
          function updateActive(){
            const range = readRange();
            const preset = range && range.preset ? normalizePreset(range.preset) : null;
            presetButtons.forEach(button => {
              const isActive = Boolean(preset && button.dataset.preset === preset);
              button.classList.toggle('is-active', isActive);
              button.classList.remove('active');
              button.setAttribute('aria-pressed', String(isActive));
            });
            if (startField?.input) {
              startField.input.value = range && range.start ? range.start : '';
            }
            if (endField?.input) {
              endField.input.value = range && range.end ? range.end : '';
            }
          }
      
          function updateCompareState(){
            if (!compareToggle?.input) return;
            compareToggle.input.checked = readCompare();
          }
      
          presetButtons.forEach(button => {
            button.addEventListener('click', () => {
              const key = button.dataset.preset;
              if (!key) return;
              saveRange({preset: key});
              if (startField?.input) startField.input.value = '';
              if (endField?.input) endField.input.value = '';
              updateActive();
            });
          });
      
          document.addEventListener('i18n:change', updateLocale);
          if (g.I18N?.onReady) {
            g.I18N.onReady(updateLocale);
          } else {
            updateLocale();
          }
      
          updateActive();
          updateCompareState();
      
          const initialRange = readRange();
          if (!initialRange) {
            saveRange({preset: DEFAULT_PRESET});
          } else {
            emitToolbarRange(initialRange);
          }
      
          if (config.compare && !localStorage.getItem(COMPARE_KEY)) {
            saveCompare(false);
          }
      
          window.addEventListener('storage', (evt) => {
            if (!evt) return;
            if (evt.key === RANGE_KEY) {
              updateActive();
              if (!evt.synthetic) {
                const nextRange = evt.newValue ? parseRangeString(evt.newValue) : readRange();
                emitToolbarRange(nextRange || readRange());
              }
            } else if (evt.key === COMPARE_KEY) {
              updateCompareState();
            }
          });
        }
      
        function resolveElement(target){
          if (!target) return null;
          if (typeof target === 'string') return document.querySelector(target);
          if (target instanceof Element) return target;
          if (target && target.nodeType === 1) return target;
          return null;
        }
      
        function createPresetButton(key, wrapper){
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.preset = key;
          button.className = 'seg range-pill';
          button.setAttribute('aria-pressed', 'false');
          button.textContent = translateRange(key, key.toUpperCase());
          wrapper.appendChild(button);
          return button;
        }
      
        function ensureDateField(slot, id, key, fallback){
          const host = resolveElement(slot);
          if (!host) return null;
          host.classList.add('toolbar-date-slot');
          let label = host.querySelector('.toolbar-date-slot__label');
          if (!label) {
            label = document.createElement('span');
            label.className = 'toolbar-date-slot__label';
            host.prepend(label);
          }
          let input = host.querySelector('input[type="date"]');
          if (!input) {
            input = document.createElement('input');
            input.type = 'date';
            host.appendChild(input);
          }
          label.id = label.id || `${id}-label`;
          input.id = id;
          input.classList.add('toolbar-date-slot__input');
          input.classList.add('date-input');
          input.setAttribute('aria-labelledby', label.id);
          label.textContent = translate(key, fallback);
          input.setAttribute('aria-label', translate(key, fallback));
          return {host, label, input};
        }
      
        function ensureCompareField(slot, enabled){
          const host = resolveElement(slot);
          if (!host) return null;
          if (!enabled) {
            host.hidden = true;
            host.setAttribute('aria-hidden', 'true');
            return null;
          }
          host.hidden = false;
          host.removeAttribute('aria-hidden');
          host.classList.add('compare');
          let input = host.querySelector('input[type="checkbox"]');
          if (!input) {
            input = document.createElement('input');
            input.type = 'checkbox';
            host.prepend(input);
          }
          let label = host.querySelector('.compare__label');
          if (!label) {
            label = document.createElement('span');
            label.className = 'compare__label';
            host.appendChild(label);
          }
          label.textContent = translate('range.compare', 'Compare');
          return {host, input, label};
        }
      
        g.DateControls = {
          mount,
          readRange,
          readCompare
        };
      })(window);
    },
    'assets/js/caption.js': function(require, module, exports) {
      (function(g){
        function fDate(d, lang){
          try {
            return new Intl.DateTimeFormat(
              lang || document.documentElement.lang || 'en',
              {year: 'numeric', month: 'short', day: 'numeric'}
            ).format(d);
          } catch (err) {
            return (d instanceof Date && !isNaN(d)) ? d.toISOString().split('T')[0] : '';
          }
        }
      
        function escapeHtml(value){
          const div = document.createElement('div');
          div.textContent = value == null ? '' : String(value);
          return div.innerHTML;
        }
      
        function render(sel, model){
          const host = typeof sel === 'string' ? document.querySelector(sel) : sel;
          if (!host) return;
          const lang = g.I18N?.getLang?.() || document.documentElement.lang;
          const asOf = fDate(model?.asOf || new Date(), lang);
          const insight = escapeHtml(model?.insight || '');
          const label = typeof g.I18N?.t === 'function' ? g.I18N.t('asof', 'As of') : 'As of';
          host.innerHTML = `<div class="caption"><span class="caption__insight">${insight}</span><span class="caption__asof"> · ${label} ${asOf}</span></div>`;
        }
      
        g.Caption = { render };
      })(window);
    },
    'assets/js/lazy-charts.js': function(require, module, exports) {
      (function(g){
        const devError = typeof g.devError === 'function' ? g.devError : () => {};
        const devWarn = typeof g.devWarn === 'function' ? g.devWarn : () => {};
        if (!('IntersectionObserver' in g)) {
          document.querySelectorAll('[data-mount]').forEach(node => {
            const mount = node.getAttribute('data-mount');
            if (mount && typeof g[mount] === 'function') {
              g[mount](node);
            }
          });
          return;
        }
      
        const io = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const target = entry.target;
            const mount = target.getAttribute('data-mount');
            if (mount && typeof g[mount] === 'function') {
              try {
                g[mount](target);
              } catch (err) {
                devError('[lazy-charts] mount failed', mount, err);
              }
            }
            io.unobserve(target);
          });
        }, {rootMargin: '200px'});
      
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('[data-mount]').forEach(node => io.observe(node));
        });
      })(window);
    },
    'assets/js/guard.js': function(require, module, exports) {
      (function(global){
        const MIN_N = 5;
      
        function resolveHost(host){
          if (!host) return null;
          if (typeof host === 'string') {
            try {
              return document.querySelector(host);
            } catch (err) {
              return null;
            }
          }
          return host;
        }
      
        function guardSmallN(n, host, msg){
          const target = resolveHost(host);
          const count = Number(n);
          if (Number.isFinite(count) && count >= MIN_N) {
            if (target) {
              target.removeAttribute('data-guard');
              target.removeAttribute('data-guard-message');
              const placeholder = target.querySelector('.kGuard');
              if (placeholder) {
                placeholder.remove();
              }
            }
            return false;
          }
      
          if (!target) return true;
      
          const message = typeof msg === 'string' && msg.trim()
            ? msg
            : (global.I18N?.t?.('guard.insufficient') || 'Insufficient group size');
          const label = Number.isFinite(count) ? count : '–';
          target.innerHTML = `<div class="kGuard">${message} (n=${label}).</div>`;
          target.setAttribute('data-guard', 'true');
          target.setAttribute('data-guard-message', `${message} (n=${label}).`);
          return true;
        }
      
        global.guardSmallN = guardSmallN;
        global.Guard = Object.assign(global.Guard || {}, {guardSmallN});
      })(window);
    },
    'assets/js/about.js': function(require, module, exports) {
      (function(){
        const modal = document.createElement('div');
        modal.className = 'about';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
          <div class="about__overlay" data-about-close></div>
          <div class="about__sheet" role="document">
            <header class="about__header">
              <h2 class="about__title" id="about-title" data-i18n="about.title">About this platform</h2>
              <button type="button" class="about__close" data-about-close data-i18n="about.close" data-i18n-attr="aria-label" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <ul class="about__list" id="about-desc">
              <li data-i18n="about.bullet1">Aggregates only</li>
              <li data-i18n="about.bullet2">No ML</li>
              <li data-i18n="about.bullet3">EU cloud</li>
              <li data-i18n="about.bullet4">Encryption in transit & at rest</li>
              <li data-i18n="about.bullet5">Wearables last 12+ hours</li>
              <li data-i18n="about.bullet6">Accuracy 2.4–4.7%</li>
            </ul>
          </div>`;
        document.body.appendChild(modal);
        modal.setAttribute('aria-labelledby', 'about-title');
        modal.setAttribute('aria-describedby', 'about-desc');
      
        const focusSelectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
        let lastFocus = null;
        let lastTrigger = null;
      
        document.body.addEventListener('click', evt => {
          const trigger = evt.target.closest('[data-about-open]');
          if (trigger) {
            evt.preventDefault();
            openModal(trigger);
          }
          if (evt.target.closest('[data-about-close]')) {
            evt.preventDefault();
            closeModal();
          }
        });
      
        function openModal(trigger){
          lastFocus = trigger;
          lastTrigger = trigger;
          if (trigger) {
            trigger.setAttribute('aria-haspopup', 'dialog');
            trigger.setAttribute('aria-expanded', 'true');
          }
          modal.setAttribute('aria-hidden', 'false');
          modal.classList.add('is-open');
          const firstFocusable = modal.querySelector(focusSelectors);
          if (firstFocusable) firstFocusable.focus();
          document.body.classList.add('modal-open');
          document.addEventListener('keydown', handleKeyDown, true);
        }
      
        function closeModal(){
          modal.setAttribute('aria-hidden', 'true');
          modal.classList.remove('is-open');
          document.body.classList.remove('modal-open');
          document.removeEventListener('keydown', handleKeyDown, true);
          if (lastTrigger) {
            lastTrigger.setAttribute('aria-expanded', 'false');
          }
          if (lastFocus) {
            try { lastFocus.focus(); } catch (e) { /* ignore */ }
          }
          lastFocus = null;
          lastTrigger = null;
        }
      
        function handleKeyDown(evt){
          if (modal.getAttribute('aria-hidden') === 'true') return;
          if (evt.key === 'Escape') {
            evt.preventDefault();
            closeModal();
            return;
          }
          if (evt.key !== 'Tab') return;
          const focusable = Array.from(modal.querySelectorAll(focusSelectors)).filter(el => el.offsetParent !== null);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (evt.shiftKey && document.activeElement === first) {
            evt.preventDefault();
            last.focus();
          } else if (!evt.shiftKey && document.activeElement === last) {
            evt.preventDefault();
            first.focus();
          }
        }
      })();
    },
    'assets/js/auth.js': function(require, module, exports) {
      (function(){
        const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
        const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
        const STORAGE_KEY = 'hr:role';
        const DEFAULT_ROLE = 'HR';
        const VALID_ROLES = new Set(['HR', 'OH', 'Admin']);
        const ROLE_CHANGE_EVENT = 'hr:role';
      
        let currentRole = DEFAULT_ROLE;
      
        init();
      
        function init(){
          const roleFromUrl = readRoleFromUrl();
          if (typeof window.renderSideNav === 'function') {
            const originalRender = window.renderSideNav;
            window.renderSideNav = function(...args){
              const result = originalRender.apply(this, args);
              handleSidebarReady();
              return result;
            };
          }
          if (roleFromUrl) {
            setRole(roleFromUrl, {skipHistory: true});
          } else {
            currentRole = readRoleFromStorage() || DEFAULT_ROLE;
            persistRole(currentRole);
            notifyRoleChange();
          }
          document.addEventListener(ROLE_CHANGE_EVENT, () => {
            handleSidebarReady();
          });
          handleSidebarReady();
        }
      
        function readRoleFromUrl(){
          try {
            const params = new URLSearchParams(window.location.search);
            const role = params.get('role');
            if (role && VALID_ROLES.has(role)) {
              params.delete('role');
              const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
              window.history.replaceState({}, document.title, next);
              return role;
            }
          } catch (e) {
            devWarn('auth: failed to parse role from URL', e);
          }
          return null;
        }
      
        function readRoleFromStorage(){
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && VALID_ROLES.has(stored)) return stored;
          } catch (e) {
            devWarn('auth: failed to read role from storage', e);
          }
          return null;
        }
      
        function persistRole(role){
          try {
            localStorage.setItem(STORAGE_KEY, role);
          } catch (e) {
            devWarn('auth: failed to persist role', e);
          }
        }
      
        function notifyRoleChange(){
          document.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, {detail: {role: currentRole}}));
        }
      
        function setRole(role, options={}){
          if (!VALID_ROLES.has(role)) return;
          if (currentRole === role) return;
          currentRole = role;
          persistRole(role);
          if (!options.skipHistory) {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('role', role);
              window.history.replaceState({}, document.title, url);
            } catch (e) {
              devWarn('auth: unable to push role to URL', e);
            }
          }
          notifyRoleChange();
        }
      
        function handleSidebarReady(evt){
          const root = evt?.detail?.root || document.getElementById('side-nav') || document.getElementById('sidebar-slot');
          if (!root) return;
          applyRoleToSidebar(root);
        }
      
        function applyRoleToSidebar(root){
          const navItems = root.querySelectorAll('a[data-id]');
          navItems.forEach(link => {
            const key = link.dataset.id || '';
            const allowed = window.routeGuards?.isAllowed(currentRole, key) ?? true;
            const li = link.parentElement;
            if (li && li.tagName === 'LI') {
              li.style.display = allowed ? '' : 'none';
            } else {
              link.style.display = allowed ? '' : 'none';
            }
          });
        }
      
        window.auth = {
          getRole(){
            return currentRole;
          },
          setRole(role){
            setRole(role);
            handleSidebarReady();
          },
          onRoleChange(handler){
            if (typeof handler !== 'function') return () => {};
            const listener = evt => handler(evt?.detail?.role || currentRole);
            document.addEventListener(ROLE_CHANGE_EVENT, listener);
            return () => document.removeEventListener(ROLE_CHANGE_EVENT, listener);
          }
        };
      })();
    },
    'assets/js/guards.js': function(require, module, exports) {
      (function(){
        const ROUTE_MAP = {
          summary: {roles: ['HR', 'OH', 'Admin']},
          analytics: {roles: ['HR', 'OH', 'Admin']},
          engagement: {roles: ['HR', 'OH', 'Admin']},
          corporate: {roles: ['HR', 'OH', 'Admin']},
          devices: {roles: ['HR', 'OH', 'Admin']},
          settings: {roles: ['Admin']},
          demo: {roles: ['HR', 'OH', 'Admin']},
          wellness: {roles: []},
          pilot: {roles: ['Admin']},
          index: {roles: ['HR', 'OH', 'Admin']},
          about: {roles: ['HR', 'OH', 'Admin']}
        };
      
        const FILE_TO_KEY = {
          'summary.html': 'summary',
          'analytics.html': 'analytics',
          'engagement.html': 'engagement',
          'corporate.html': 'corporate',
          'devices.html': 'devices',
          'settings.html': 'settings',
          'demo.html': 'demo',
          'user.html': 'wellness',
          'pilot.html': 'pilot',
          'index.html': 'index'
        };
      
        const DEFAULT_REDIRECT = './Corporate.html';
      
        function getKeyForLocation(){
          try {
            const path = window.location.pathname.split('/').pop() || 'index.html';
            return FILE_TO_KEY[path.toLowerCase()] || 'index';
          } catch (e) {
            return 'index';
          }
        }
      
        function rolesFor(key){
          return ROUTE_MAP[key]?.roles || [];
        }
      
        function isAllowed(role, key){
          if (!role) return false;
          const allowedRoles = rolesFor(key);
          if (!allowedRoles.length) return false;
          return allowedRoles.includes(role);
        }
      
        function enforce(){
          const role = window.auth?.getRole?.() || 'HR';
          const key = getKeyForLocation();
          if (!isAllowed(role, key)) {
            if (key === 'wellness') {
              redirect();
              return;
            }
            if (!rolesFor(key).length) {
              redirect();
              return;
            }
            redirect();
          }
        }
      
        function redirect(){
          if (window.location.pathname.endsWith('Corporate.html')) return;
          window.location.replace(DEFAULT_REDIRECT);
        }
      
        window.routeGuards = {
          isAllowed,
          rolesFor,
          getKeyForLocation
        };
      
        document.addEventListener('DOMContentLoaded', enforce);
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
          enforce();
        }
      
        if (window.auth?.onRoleChange) {
          window.auth.onRoleChange(() => enforce());
        }
      })();
    },
    'assets/js/theme.js': function(require, module, exports) {
      (function(){
        const devError = typeof window !== 'undefined' && typeof window.devError === 'function' ? window.devError : () => {};
        const devWarn = typeof window !== 'undefined' && typeof window.devWarn === 'function' ? window.devWarn : () => {};
        const STORAGE_KEY = 'hr:theme';
        const DEFAULT_THEME = './data/theme.json';
      
        const loaderGlobals = window.loaderGlobals || {};
        const fetchJson = typeof loaderGlobals.fetchJson === 'function'
          ? loaderGlobals.fetchJson
          : async url => {
              const resp = await fetch(url, {cache: 'no-store'});
              if (resp.status === 404) return null;
              if (!resp.ok) throw new Error(`theme fetch failed: ${resp.status}`);
              return resp.json();
            };
        const withVersion = typeof loaderGlobals.withV === 'function'
          ? loaderGlobals.withV
          : value => value;
      
        let currentTheme = null;
        let versionValue = null;
        let versionWait = null;
      
        init();
      
        async function init(){
          const themeFromUrl = readThemeFromUrl();
          const persisted = themeFromUrl || readThemeFromStorage();
          const path = themeFromUrl ? buildThemePath(themeFromUrl) : (persisted ? buildThemePath(persisted) : DEFAULT_THEME);
          if (typeof window.renderSideNav === 'function') {
            const originalRender = window.renderSideNav;
            window.renderSideNav = function(...args){
              const result = originalRender.apply(this, args);
              applyThemeToSidebar(currentTheme);
              return result;
            };
          }
          document.addEventListener('DOMContentLoaded', () => applyThemeToSidebar(currentTheme));
          try {
            currentTheme = await fetchTheme(path);
            if (themeFromUrl) {
              persistTheme(themeFromUrl);
            }
          } catch (e) {
            devWarn('theme: failed to load theme file, using default', e);
            currentTheme = await fallbackTheme();
          }
          if (!currentTheme) {
            currentTheme = await fallbackTheme();
          }
          applyTheme(currentTheme);
        }
      
        function waitForVersion(){
          if (versionValue != null) {
            return Promise.resolve(versionValue);
          }
          if (typeof window.APP_VERSION !== 'undefined') {
            versionValue = window.APP_VERSION || '';
            return Promise.resolve(versionValue);
          }
          if (!versionWait) {
            versionWait = new Promise(resolve => {
              const handler = () => {
                window.removeEventListener('app:version', handler);
                versionValue = window.APP_VERSION || '';
                resolve(versionValue);
              };
              window.addEventListener('app:version', handler, {once: true});
            });
          }
          return versionWait.then(v => {
            versionValue = v || '';
            return versionValue;
          });
        }
      
        function readThemeFromUrl(){
          try {
            const params = new URLSearchParams(window.location.search);
            const value = params.get('theme');
            if (!value) return null;
            params.delete('theme');
            const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, document.title, next);
            return value.toLowerCase();
          } catch (e) {
            devWarn('theme: unable to parse theme parameter', e);
            return null;
          }
        }
      
        function readThemeFromStorage(){
          try {
            return localStorage.getItem(STORAGE_KEY);
          } catch (e) {
            return null;
          }
        }
      
        function persistTheme(id){
          try {
            localStorage.setItem(STORAGE_KEY, id);
          } catch (e) {
            devWarn('theme: persist failed', e);
          }
        }
      
        function buildThemePath(id){
          if (!id) return DEFAULT_THEME;
          return `./data/themes/${id}.json`;
        }
      
        async function fetchTheme(path){
          const version = await waitForVersion();
          const url = new URL(path, document.baseURI);
          if (version) {
            url.searchParams.set('app', version);
          }
          const data = await fetchJson(withVersion(url.toString()));
          if (!data) {
            return null;
          }
          return data;
        }
      
        async function fallbackTheme(){
          try {
            const version = await waitForVersion();
            const url = new URL(DEFAULT_THEME, document.baseURI);
            if (version) {
              url.searchParams.set('app', version);
            }
            const data = await fetchJson(withVersion(url.toString()));
            if (data) return data;
          } catch (e) {
            devWarn('theme: fallback fetch failed', e);
          }
          return {brand: 'SPA2099 HR Health', primary: '#27E0FF', logo: ''};
        }
      
        function applyTheme(theme){
          if (!theme) return;
          const docStyle = document.documentElement.style;
          if (theme.primary) {
            docStyle.setProperty('--cyan', theme.primary);
            docStyle.setProperty('--accent-strong', theme.primary);
            docStyle.setProperty('--stroke', hexToRgba(theme.primary, 0.35));
            docStyle.setProperty('--stroke-strong', hexToRgba(theme.primary, 0.5));
            docStyle.setProperty('--focus-ring', `0 0 0 3px ${hexToRgba(theme.primary, 0.35)}`);
          }
          applyThemeToSidebar(theme);
          document.dispatchEvent(new CustomEvent('theme:change', {detail: theme}));
        }
      
        function applyThemeToSidebar(theme){
          const root = document.getElementById('side-nav') || document.getElementById('sidebar-slot');
          if (!root || !theme) return;
          const logoEl = root.querySelector('[data-theme-logo]');
          if (logoEl) {
            if (theme.logo) {
              logoEl.src = versionedAsset(theme.logo);
              logoEl.hidden = false;
            } else {
              logoEl.hidden = true;
            }
          }
          const brandEl = root.querySelector('.brand');
          if (brandEl && theme.brand) {
            brandEl.textContent = theme.brand;
          }
        }
      
        function hexToRgba(hex, alpha){
          const cleaned = (hex || '').replace('#', '');
          if (cleaned.length !== 6) return `rgba(39,224,255,${alpha})`;
          const bigint = parseInt(cleaned, 16);
          const r = (bigint >> 16) & 255;
          const g = (bigint >> 8) & 255;
          const b = bigint & 255;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      
        function versionedAsset(src){
          if (!src) return src;
          try {
            const url = new URL(src, document.baseURI);
            if (versionValue) {
              url.searchParams.set('v', versionValue);
            }
            return url.toString();
          } catch (e) {
            return src;
          }
        }
      
        window.theme = {
          current(){
            return currentTheme;
          }
        };
      })();
    },
    'assets/js/asof.js': function(require, module, exports) {
      (function(){
        const TZ = 'Europe/Amsterdam';
      
        function lastSunday(y, m){
          const d = new Date(Date.UTC(y, m + 1, 0));
          d.setUTCDate(d.getUTCDate() - d.getUTCDay());
          return d;
        }
      
        function render() {
          const now = new Date();
          const dd  = new Intl.DateTimeFormat('en-GB',{ day:'2-digit',  timeZone:TZ }).format(now);
          const mon = new Intl.DateTimeFormat('en-GB',{ month:'short', timeZone:TZ }).format(now);
          const yy  = new Intl.DateTimeFormat('en-GB',{ year:'numeric', timeZone:TZ }).format(now);
          const hm  = new Intl.DateTimeFormat('en-GB',{ hour:'2-digit', minute:'2-digit', hour12:false, timeZone:TZ }).format(now);
      
          const y = now.getUTCFullYear();
          const dstS = new Date(Date.UTC(y,2,lastSunday(y,2).getUTCDate(),1));
          const dstE = new Date(Date.UTC(y,9,lastSunday(y,9).getUTCDate(),1));
          const tzLabel = (now >= dstS && now < dstE) ? 'CEST' : 'CET';
      
          const text = `${dd} ${mon} ${yy} · ${hm} ${tzLabel}`;
          const iso  = now.toISOString();
      
          document.querySelectorAll('time[data-asof]').forEach(el=>{
            el.textContent = text;
            el.setAttribute('datetime', iso);
            el.style.fontFamily = 'inherit';
          });
        }
      
        function loop(){
          render();
          const now = new Date();
          const next = new Date(now.getTime() + 60000);
          next.setSeconds(0,0);
          setTimeout(loop, next - now);
        }
      
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', loop);
        } else {
          loop();
        }
      })();
    },
    'assets/js/entries/corporate.entry.js': function(require, module, exports) {
      require('assets/js/utils/env.js');
      require('assets/js/data-loader.js');
      require('assets/js/api.js');
      require('assets/js/i18n.js');
      require('assets/js/team-filter.js');
      require('assets/js/version.js');
      require('assets/js/site.js');
      require('assets/js/nav.js');
      require('assets/js/app-shell.js');
      require('assets/js/date-controls.js');
      require('assets/js/caption.js');
      require('assets/js/lazy-charts.js');
      require('assets/js/guard.js');
      require('assets/js/about.js');
      require('assets/js/auth.js');
      require('assets/js/guards.js');
      require('assets/js/theme.js');
      require('assets/js/asof.js');
      
      const { bootstrapCorporatePage } = require('assets/js/pages/corporate.js');
      const { handleExportClick } = require('assets/js/exporter.js');
      const { mountKpiCards, KPI_CONFIG } = require('components/kpi-cards/kpi-cards.js');
      const { exportCurrentView } = require('assets/js/components/Toolbar.js');
      const { getKpiData } = require('adapters/kpiAdapter.js');
      
      const devError = globalThis.devError || ((...args) => console.error(...args));
      
      function onDomReady(callback) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
          callback();
        }
      }
      
      function waitForI18n() {
        if (window.I18N?.onReady) {
          return new Promise(resolve => {
            window.I18N.onReady(() => resolve());
          });
        }
        return Promise.resolve();
      }
      
      async function initKpiCards() {
        try {
          const data = await getKpiData();
      
          function bindExternalRange(cb) {
            document.addEventListener('toolbar:range', event => {
              const range = event?.detail?.range;
              cb(range);
            });
          }
      
          mountKpiCards('#kpi', data, KPI_CONFIG, {
            initialRange: '1d',
            bindExternalRange
          });
        } catch (err) {
          devError('KPI mount failed:', err);
        }
      }
      
      function bindExportButton() {
        const exportBtn = document.getElementById('tb-export');
        if (!exportBtn) return;
        exportBtn.removeEventListener('click', exportCurrentView);
        exportBtn.addEventListener('click', async event => {
          event.preventDefault();
          try {
            await handleExportClick({ trigger: exportBtn, onExport: exportCurrentView });
          } catch (err) {
            devError('Export failed:', err);
          }
        });
      }
      
      function setupLayoutChrome() {
        try {
          if (typeof window.renderSideNav === 'function') {
            window.renderSideNav('corporate');
          }
        } catch (err) {
          devError('Side nav render failed:', err);
        }
      
        if (window.DateControls?.mount) {
          window.DateControls.mount('#tb-quick', {
            presets: ['Today', '7D', 'MTD', 'QTD', 'YTD'],
            compare: false,
            startSlot: '#tb-dates [data-date-slot="start"]',
            endSlot: '#tb-dates [data-date-slot="end"]',
            compareSlot: '#tb-compare'
          });
        }
      
        if (window.Caption?.render) {
          window.Caption.render('#global-caption', {
            asOf: new Date(),
            insight: window.PageInsight || ''
          });
        }
      }
      
      async function bootstrap() {
        await waitForI18n();
        await bootstrapCorporatePage();
        await initKpiCards();
        bindExportButton();
        setupLayoutChrome();
      }
      
      onDomReady(() => {
        bootstrap().catch(err => {
          devError('Corporate bootstrap failed:', err);
        });
      });
    }
  };
  const cache = {};
  function require(id) {
    if (cache[id]) { return cache[id].exports; }
    const module = { exports: {}, id };
    module.importMetaUrl = new URL(id, document.baseURI).href;
    cache[id] = module;
    modules[id](require, module, module.exports);
    return module.exports;
  }
  require('assets/js/entries/corporate.entry.js');
})();
//# sourceMappingURL=corporate.bundle.js.map
