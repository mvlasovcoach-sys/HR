export async function loadCorporateData(mode = 'demo') {
  try {
    if (mode === 'demo') {
      const res = await fetch('./data/demo_corporate.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Demo data fetch failed');
      return await res.json();
    }
    // Life mode: return empty structure for now (graceful fallback)
    return { generated_at: null, teams: [] };
  } catch (e) {
    console.error('[data-loader] ', e);
    return { generated_at: null, teams: [] };
  }
}
