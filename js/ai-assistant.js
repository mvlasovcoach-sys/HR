const clamp01 = x => Math.max(0, Math.min(1, x));
const norm100 = (x, min = 0, max = 100) => (x == null || isNaN(x)) ? null : clamp01((x - min) / (max - min));
const series = (hist, key) => hist.map(d => ({ date: d.date, value: d[key] ?? 0 }));
const delta = (arr, days = 7) => {
  if (!arr?.length) return 0;
  const last = arr.at(-1)?.value ?? 0;
  const prev = arr[Math.max(0, arr.length - 1 - days)]?.value ?? arr[0]?.value ?? 0;
  return (last - prev) / 100;
};

export function computeRisk(history) {
  const sS = series(history, 'stress'), bS = series(history, 'burnout'), fS = series(history, 'fatigue');
  const sN = norm100(sS.at(-1)?.value), bN = norm100(bS.at(-1)?.value), fN = norm100(fS.at(-1)?.value);
  const dS7 = Math.max(0, delta(sS, 7)), dB30 = Math.max(0, delta(bS, 30));
  const abs30 = history.at(-1)?.absence_days_30d ?? 0; const absN = clamp01(abs30 / 5);

  const riskAcute   = 0.5 * (sN ?? 0) + 0.3 * (fN ?? 0) + 0.2 * dS7;
  const riskChronic = 0.6 * (bN ?? 0) + 0.2 * dB30        + 0.2 * absN;
  const risk = Math.round(100 * (0.4 * riskAcute + 0.6 * riskChronic));

  const contribs = [
    { key: 'Burnout', value: (bN ?? 0) * 60 + dB30 * 20 },
    { key: 'Stress',  value: (sN ?? 0) * 50 + dS7 * 20  },
    { key: 'Fatigue', value: (fN ?? 0) * 30         },
    { key: 'Absence', value: absN * 20              },
  ];
  const sum = contribs.reduce((a, c) => a + c.value, 0) || 1;
  contribs.forEach(c => c.percent = Math.round((c.value / sum) * 100));
  contribs.sort((a, b) => b.percent - a.percent);

  return { risk, contribs, wellscore: 100 - risk };
}

export function recommend({ risk, contribs }) {
  const top = contribs[0]?.key || '';
  const out = [];
  const add = (id, t, role, delta, eta, eff = 'low') => out.push({ id, title: t, role, expected_delta: delta, eta_days: eta, effort: eff });

  if (risk >= 70) {
    add('R1', 'Remove urgent SLAs for 3–5 days + 1 no-meetings day', 'Manager', 12, 5);
    add('R2', 'EAP contact + 1:1 check-in', 'HR', 10, 7);
  } else if (risk >= 40) {
    add('R3', '2 WFH days this week', 'Manager', 7, 7);
    add('R4', 'Task rotation to break monotony', 'Manager', 6, 14, 'med');
  }

  if (top === 'Burnout') add('R5', 'Focus blocks 3×2h; cut meeting load', 'Manager', 8, 7);
  if (top === 'Stress')  add('R6', 'Redistribute tasks + time audit', 'Manager', 9, 10);
  if (top === 'Fatigue') add('R7', 'Shift tweak + 48h rest window', 'OH', 8, 3);
  return out.slice(0, 3);
}

export function simulate(history, { reduce_load_pct = 10, wfh_days = 2, add_days_off = 0 } = {}) {
  const base = computeRisk(history);
  const bonus = reduce_load_pct * 0.06 + wfh_days * 0.02 + add_days_off * 0.03;
  return { before: base.risk, after: Math.max(0, base.risk - Math.round(100 * bonus)) };
}
