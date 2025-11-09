import { loadCorporateData } from '../data-loader.js';
import { computeRisk, recommend, simulate } from '../ai-assistant.js';
import { levelFor } from '../ai-config.js';

const riskEl = () => document.getElementById('ai-risk');
const factorsEl = () => document.getElementById('ai-factors');
const btnExplain = () => document.getElementById('ai-btn-explain');
const btnRecommend = () => document.getElementById('ai-btn-recommend');
const btnWhatIf = () => document.getElementById('ai-btn-whatif');

const renderRisk = (risk) => {
  const el = riskEl();
  if (!el) return;

  el.textContent = `Risk: ${risk}`;
  el.classList.remove('risk--low', 'risk--medium', 'risk--high');

  const level = levelFor(risk);
  el.classList.add(level.colorClass);
  el.setAttribute('aria-label', `Risk ${risk}, ${level.label}`);

  const badge = document.getElementById('ai-risk-level');
  if (badge) badge.textContent = level.label;
};

function setBtnsEnabled(enabled) {
  ['ai-btn-explain','ai-btn-recommend','ai-btn-whatif'].forEach(id=>{
    const b=document.getElementById(id); if(!b) return;
    b.disabled = !enabled;
    // активный вид как у Today — заполняем
    b.classList.toggle('pill-btn--primary', enabled);
  });
}

async function boot() {
  setBtnsEnabled(false);

  try {
    const url = new URL(window.location.href);
    const mode = (url.searchParams.get('mode') || 'demo').toLowerCase();
    const role = (url.searchParams.get('role') || 'hr').toLowerCase();
    window.USER_ROLE = role;
    window.APP_MODE = mode;

    const data = await loadCorporateData(mode);
    window.DEMO_DATA = data;
    window.dispatchEvent(new CustomEvent('corporate:data-ready', { detail: { mode, data } }));

    const team = data?.teams?.[0];
    const person = team?.members?.[0];

    if (!person?.history?.length) {
      const el = riskEl();
      if (el) {
        el.textContent = 'Risk: —';
        el.classList.remove('risk--low', 'risk--medium', 'risk--high');
        el.removeAttribute('aria-label');
      }
      const badge = document.getElementById('ai-risk-level');
      if (badge) badge.textContent = '';
      if (factorsEl()) factorsEl().textContent = 'No data';
      setBtnsEnabled(false);
      return;
    }

    const res = computeRisk(person.history);
    renderRisk(res.risk);
    if (factorsEl()) {
      factorsEl().textContent = res.contribs.slice(0,3)
        .map(c => `${c.key} +${c.percent}%`).join('  •  ');
    }

    setBtnsEnabled(true);

    btnExplain()?.addEventListener('click', () => {
      const r = computeRisk(person.history);
      alert('Top factors:\n' + r.contribs.map(c => `${c.key}: ${c.percent}%`).join('\n'));
    });

    btnRecommend()?.addEventListener('click', () => {
      const r = computeRisk(person.history);
      const recs = recommend(r);
      alert('Recommendations:\n' + recs.map(x => `• ${x.title} (${x.role}) ~Δ${x.expected_delta}`).join('\n'));
    });

    btnWhatIf()?.addEventListener('click', () => {
      const sim = simulate(person.history, { reduce_load_pct: 10, wfh_days: 2 });
      alert(`What-if:\nBefore: ${sim.before}\nAfter: ${sim.after}`);
    });

  } catch (e) {
    console.error('[ai-assistant.boot] init failed', e);
    const el = riskEl();
    if (el) {
      el.textContent = 'Risk: —';
      el.classList.remove('risk--low', 'risk--medium', 'risk--high');
      el.removeAttribute('aria-label');
    }
    const badge = document.getElementById('ai-risk-level');
    if (badge) badge.textContent = '';
    if (factorsEl()) factorsEl().textContent = 'Init error';
    setBtnsEnabled(false);
  }
}
boot();
