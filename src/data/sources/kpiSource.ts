import { mapRawKpi, type KpiBundle } from '@/data/mappers/kpi';

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (err) {
    console.warn('[kpiSource] Failed to parse KPI payload', err);
    return {};
  }
}

export async function loadKpiToday(mode: 'live' | 'demo'): Promise<KpiBundle> {
  if (mode === 'demo') {
    const response = await fetch('data/demo/kpi_today.json', { cache: 'no-store' });
    if (!response.ok) {
      console.warn('[kpiSource] Demo KPI dataset missing, returning empty payload');
      return mapRawKpi({}, 'demo');
    }
    const raw = await readJson(response);
    return mapRawKpi(raw, 'demo');
  }

  const response = await fetch('/api/kpi?period=today', { cache: 'no-store' });
  const raw = response.ok ? await readJson(response) : {};
  return mapRawKpi(raw, 'live');
}
