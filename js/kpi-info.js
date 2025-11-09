const TXT = {
  org_wellbeing: `
    <b>Что это:</b> корпоративный индекс благополучия (0–100) на выбранном срезе.
    <span class="sep"></span>
    <b>Как считается:</b> агрегируем персональные риски и переводим в индекс:
    Wellbeing = 100 − median(Risk_person).
    Risk_person собирается из Stress/Burnout/Fatigue/Absence, с трендовыми компонентами.
    <span class="sep"></span>
    <span class="muted">Диапазон и фильтры: Today / 7 Days / Month и выбранная команда.</span>
  `,
  stress_avg: `
    <b>Что это:</b> медиана значения Stress (0–100) среди выбранной группы.
    <span class="sep"></span>
    <b>Как считается:</b> median(stress_person) на текущем диапазоне.
    Тренд: Today vs ср. пред.7 дней · 7 Days vs пред.7 · Month vs пред.30.
  `,
  burnout_risk: `
    <b>Что это:</b> уровень признаков выгорания в шкале 0–100, агрегированный по группе.
    <span class="sep"></span>
    <b>Как считается:</b> median(burnout_person) на текущем диапазоне (те же правила тренда).
  `,
  fatigue_share: `
    <b>Что это:</b> доля людей с повышенной усталостью.
    <span class="sep"></span>
    <b>Как считается:</b> 100 × count(fatigue ≥ T<sub>f</sub>) / N, где T<sub>f</sub>=60 (настраивается).
    <span class="sep"></span>
    <span class="muted">Все значения пересчитываются при смене диапазона и фильтров.</span>
  `
};

let initialized = false;
const wiredButtons = new WeakSet();
let tipCounter = 0;

function closeAll(){
  document.querySelectorAll('.kpi-tip').forEach(node => node.remove());
  document.querySelectorAll('.kpi-info[aria-expanded="true"]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-describedby');
  });
}

function tip(html){
  const el = document.createElement('div');
  el.className = 'kpi-tip';
  el.setAttribute('role', 'tooltip');
  tipCounter += 1;
  el.id = `kpi-tip-${tipCounter}`;
  el.innerHTML = html;
  el.addEventListener('click', event => event.stopPropagation());
  return el;
}

function bindButtons(root){
  if (!root) return;
  const candidates = root instanceof Element && root.matches('.kpi-info:not([hidden])')
    ? [root]
    : root.querySelectorAll?.('.kpi-info:not([hidden])');
  if (!candidates) return;
  candidates.forEach(btn => {
    if (!(btn instanceof HTMLElement)) return;
    if (wiredButtons.has(btn)) return;
    const key = btn.getAttribute('data-kpi');
    if (!key || !TXT[key]) return;
    wiredButtons.add(btn);
    btn.addEventListener('click', event => {
      event.stopPropagation();
      const parent = btn.parentElement;
      if (!parent) return;
      const existing = parent.querySelector('.kpi-tip');
      if (existing) {
        existing.remove();
        btn.setAttribute('aria-expanded', 'false');
        btn.removeAttribute('aria-describedby');
        return;
      }
      closeAll();
      const node = tip(TXT[key]);
      parent.appendChild(node);
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-describedby', node.id);
      btn.focus();
    });
  });
}

export function initKpiInfo(){
  if (initialized) return;
  initialized = true;

  bindButtons(document);

  const host = document.getElementById('kpi');
  if (host) {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            bindButtons(node);
          }
        });
      });
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeAll();
    }
  });
}
