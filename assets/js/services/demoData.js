let _rows;

export async function loadDemoDaily() {
  if (_rows) return _rows;
  // IMPORTANT: use the SAME source heatmap uses (or adapt to it)
  // expected row: { date:'yyyy-mm-dd', stress:47, burnout:12, fatigue:3.2, wellbeing:65 }
  const res = await fetch('assets/data/demo/daily.json');
  _rows = await res.json();
  return _rows;
}

export async function demoBounds() {
  const rows = await loadDemoDaily();
  if (!rows?.length) return { min: null, max: null };
  return { min: rows[0].date, max: rows[rows.length - 1].date }; // ISO day strings
}
