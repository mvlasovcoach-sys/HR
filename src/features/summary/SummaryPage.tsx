import KpiRow, { type KpiSummaryCard } from '@/features/summary/KpiRow';
import MetricTrend, { type MetricTrendPoint } from '@/components/MetricTrend';
import AtRiskTable, { type AtRiskRow } from '@/components/AtRiskTable';
import { loadDemoSamples } from '@/services/dataSource';
import { DEFAULT_THRESHOLDS } from '@/config/thresholds';
import { mapToStatus } from '@/lib/status';
import { calcWellbeing } from '@/lib/scores';
import type { PersonSample, RiskStatus } from '@/types/metrics';
import '@/styles/tokens.css';

const KPI_HINTS: Record<string, string> = {
  stress: 'Short-term physiological response.',
  burnout: 'Accumulated exhaustion over weeks.',
  fatigue: 'Last-week fatigue from sleep deficit.',
  wellbeing: 'Composite of stress, burnout and fatigue.',
};

const METRIC_HINTS: Record<'stress' | 'burnout' | 'fatigue', string> = {
  stress: 'Daily average stress across the crew.',
  burnout: 'Weekly accumulation of cognitive overload.',
  fatigue: 'Average recovery and sleep debt levels.',
};

const STATUS_ORDER: Record<RiskStatus, number> = { OK: 0, WARN: 1, ALERT: 2 };

function clampScore(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getRecentSamples(samples: PersonSample[], days: number): PersonSample[] {
  if (!samples.length) return [];
  const sorted = samples.slice().sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const latestTs = new Date(sorted[0].ts).getTime();
  const cutoff = latestTs - (days - 1) * 24 * 60 * 60 * 1000;
  return sorted.filter((sample) => new Date(sample.ts).getTime() >= cutoff);
}

function groupByDay(samples: PersonSample[]): Map<string, PersonSample[]> {
  const map = new Map<string, PersonSample[]>();
  samples.forEach((sample) => {
    const dayKey = sample.ts.slice(0, 10);
    const list = map.get(dayKey) ?? [];
    list.push(sample);
    map.set(dayKey, list);
  });
  return map;
}

function buildTrendPoints(samples: PersonSample[], metric: 'stress' | 'burnout' | 'fatigue'): MetricTrendPoint[] {
  const grouped = groupByDay(samples);
  return Array.from(grouped.entries())
    .map(([day, entries]) => {
      const sum = entries.reduce((acc, sample) => acc + sample.scores[metric], 0);
      const avg = sum / Math.max(1, entries.length);
      return { ts: `${day}T00:00:00.000Z`, value: clampScore(avg) };
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

function buildCompositeTrend(stress: MetricTrendPoint[], burnout: MetricTrendPoint[], fatigue: MetricTrendPoint[]): number[] {
  const length = Math.min(stress.length, burnout.length, fatigue.length);
  return Array.from({ length }).map((_, index) => {
    const value = calcWellbeing(stress[index].value, burnout[index].value, fatigue[index].value);
    return value;
  });
}

function buildSparkline(points: MetricTrendPoint[]): number[] {
  return points.map((point) => clampScore(point.value));
}

function topDrivers(samples: PersonSample[], metric: keyof PersonSample['explain']): string[] {
  const counter = new Map<string, number>();
  samples.forEach((sample) => {
    const drivers = sample.explain?.[metric];
    if (!drivers) return;
    drivers.forEach((driver) => {
      counter.set(driver, (counter.get(driver) ?? 0) + 1);
    });
  });
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([driver]) => driver);
}

function determineWellbeingStatus(value: number): RiskStatus {
  if (value >= 80) return 'OK';
  if (value >= 60) return 'WARN';
  return 'ALERT';
}

function formatName(personId: string): string {
  const suffix = personId.split('_')[1] ?? personId;
  return `Employee ${suffix}`;
}

function worstStatus(statuses: RiskStatus[]): RiskStatus {
  return statuses.reduce((worst, current) => (STATUS_ORDER[current] > STATUS_ORDER[worst] ? current : worst), statuses[0]);
}

function collectRowDrivers(sample: PersonSample): string[] {
  const drivers = new Set<string>();
  const explain = sample.explain;
  if (!explain) return [];
  ['stress', 'burnout', 'fatigue'].forEach((metric) => {
    const list = explain[metric as keyof typeof explain];
    if (list) {
      list.forEach((item) => drivers.add(item));
    }
  });
  return Array.from(drivers).slice(0, 4);
}

function buildAtRiskRows(samples: PersonSample[]): AtRiskRow[] {
  const latest = new Map<string, PersonSample>();
  samples.forEach((sample) => {
    const current = latest.get(sample.person_id);
    if (!current || new Date(sample.ts).getTime() > new Date(current.ts).getTime()) {
      latest.set(sample.person_id, sample);
    }
  });

  return Array.from(latest.values()).map((sample) => {
    const { stress, burnout, fatigue } = sample.scores;
    const statuses: RiskStatus[] = [
      mapToStatus('stress', stress),
      mapToStatus('burnout', burnout),
      mapToStatus('fatigue', fatigue),
    ];
    return {
      personId: sample.person_id,
      name: formatName(sample.person_id),
      stress: clampScore(stress),
      burnout: clampScore(burnout),
      fatigue: clampScore(fatigue),
      maxStatus: worstStatus(statuses),
      drivers: collectRowDrivers(sample),
    } satisfies AtRiskRow;
  });
}

export default async function SummaryPage() {
  const samples = await loadDemoSamples();
  const recent = getRecentSamples(samples, 14);

  const stressPoints = buildTrendPoints(recent, 'stress');
  const burnoutPoints = buildTrendPoints(recent, 'burnout');
  const fatiguePoints = buildTrendPoints(recent, 'fatigue');

  const stressAvg = clampScore(stressPoints.reduce((acc, p) => acc + p.value, 0) / Math.max(1, stressPoints.length));
  const burnoutAvg = clampScore(burnoutPoints.reduce((acc, p) => acc + p.value, 0) / Math.max(1, burnoutPoints.length));
  const fatigueAvg = clampScore(fatiguePoints.reduce((acc, p) => acc + p.value, 0) / Math.max(1, fatiguePoints.length));
  const wellbeingAvg = clampScore(calcWellbeing(stressAvg, burnoutAvg, fatigueAvg));

  const wellbeingTrend = buildCompositeTrend(stressPoints, burnoutPoints, fatiguePoints);

  const kpiItems: KpiSummaryCard[] = [
    {
      id: 'stress',
      title: 'Stress',
      value: stressAvg,
      status: mapToStatus('stress', stressAvg),
      trend: buildSparkline(stressPoints),
      drivers: topDrivers(recent, 'stress'),
      hint: KPI_HINTS.stress,
    },
    {
      id: 'burnout',
      title: 'Burnout',
      value: burnoutAvg,
      status: mapToStatus('burnout', burnoutAvg),
      trend: buildSparkline(burnoutPoints),
      drivers: topDrivers(recent, 'burnout'),
      hint: KPI_HINTS.burnout,
    },
    {
      id: 'fatigue',
      title: 'Fatigue',
      value: fatigueAvg,
      status: mapToStatus('fatigue', fatigueAvg),
      trend: buildSparkline(fatiguePoints),
      drivers: topDrivers(recent, 'fatigue'),
      hint: KPI_HINTS.fatigue,
    },
    {
      id: 'wellbeing',
      title: 'Wellbeing',
      value: wellbeingAvg,
      status: determineWellbeingStatus(wellbeingAvg),
      trend: wellbeingTrend,
      drivers: topDrivers(recent, 'wellbeing'),
      hint: KPI_HINTS.wellbeing,
    },
  ];

  const atRiskRows = buildAtRiskRows(recent);

  return (
    <div className="space-y-6">
      <section>
        <KpiRow items={kpiItems} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <MetricTrend metric="stress" points={stressPoints} thresholds={DEFAULT_THRESHOLDS.stress} hint={METRIC_HINTS.stress} />
        <MetricTrend
          metric="burnout"
          points={burnoutPoints}
          thresholds={DEFAULT_THRESHOLDS.burnout}
          hint={METRIC_HINTS.burnout}
        />
        <MetricTrend
          metric="fatigue"
          points={fatiguePoints}
          thresholds={DEFAULT_THRESHOLDS.fatigue}
          hint={METRIC_HINTS.fatigue}
        />
      </section>

      <section>
        <AtRiskTable rows={atRiskRows} onOpenProfile={(personId) => console.log('open', personId)} />
      </section>
    </div>
  );
}
