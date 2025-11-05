export function renderTeamSelect({ mount, options = [], value = [], onChange }){
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) return;
  const selected = Array.isArray(value) ? value : [];
  host.innerHTML = `
    <div class="filters-row">
      <label class="filters-label" for="teamFilter">Team</label>
      <select id="teamFilter" class="filters-select" multiple>
        ${options.map(option => {
          const id = String(option?.id ?? '');
          const label = option?.label ?? id;
          const isSelected = selected.includes(id);
          return `<option value="${id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        }).join('')}
      </select>
    </div>`;
  const el = host.querySelector('#teamFilter');
  if (!el) return;
  el.addEventListener('change', () => {
    const vals = Array.from(el.selectedOptions || []).map(option => option.value);
    if (typeof onChange === 'function') {
      onChange(vals);
    }
  });
}
