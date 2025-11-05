export type KpiSource = 'demo' | 'live';

export interface RawKpiPayload {
  [key: string]: unknown;
  updatedAt?: string;
}

export interface KpiMetric {
  value: number | null;
  delta: number | null;
  trend?: string;
  updatedAt: string;
  source: KpiSource;
}

export interface KpiBundle {
  fatigue: KpiMetric;
  raw: RawKpiPayload;
  source: KpiSource;
  updatedAt: string;
}

export const SYNONYMS: Record<string, string[]> = {
  fatigue: ['fatigue', 'tiredness', 'kpi_fatigue'],
};

function normaliseRaw(raw: RawKpiPayload | null | undefined): RawKpiPayload {
  if (raw && typeof raw === 'object') {
    return raw as RawKpiPayload;
  }
  return {};
}

export function pickFirst(raw: RawKpiPayload | null | undefined, keys: string[]): number | null {
  const source = normaliseRaw(raw);
  for (const key of keys) {
    const value = source?.[key];
    if (value === 0) {
      return 0;
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
  }
  return null;
}

function resolveUpdatedAt(raw: RawKpiPayload | null | undefined): string {
  const value = normaliseRaw(raw).updatedAt;
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

function resolveTrend(raw: RawKpiPayload | null | undefined): string | undefined {
  const source = normaliseRaw(raw);
  const trend = source?.['fatigue_trend'];
  if (typeof trend === 'string' && trend.trim()) {
    return trend;
  }
  const tirednessTrend = source?.['tiredness_trend'];
  if (typeof tirednessTrend === 'string' && tirednessTrend.trim()) {
    return tirednessTrend;
  }
  return undefined;
}

export function mapRawKpi(raw: RawKpiPayload | null | undefined, source: KpiSource): KpiBundle {
  const safeRaw = normaliseRaw(raw);
  const updatedAt = resolveUpdatedAt(safeRaw);

  const fatigueValue = pickFirst(safeRaw, SYNONYMS.fatigue);
  const fatigueDelta = pickFirst(
    safeRaw,
    SYNONYMS.fatigue.map((key) => `${key}_delta`)
  );

  const fatigue: KpiMetric = {
    value: fatigueValue == null ? null : Math.round(fatigueValue),
    delta: fatigueDelta == null ? null : Math.round(fatigueDelta),
    trend: resolveTrend(safeRaw),
    updatedAt,
    source,
  };

  return {
    fatigue,
    raw: safeRaw,
    source,
    updatedAt,
  };
}
