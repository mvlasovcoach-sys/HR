import { useMemo } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { mapToStatus } from '@/lib/status';
import InfoTooltip from '@/components/InfoTooltip';
import StatusChip from '@/components/StatusChip';
import Skeleton from '@/components/Skeleton';
import '@/styles/tokens.css';

export interface MetricTrendPoint {
  ts: string;
  value: number;
}

export interface MetricTrendProps {
  metric: 'stress' | 'burnout' | 'fatigue';
  points: MetricTrendPoint[];
  thresholds: { okMax: number; warnMax: number };
  hint?: string;
  title?: string;
  isLoading?: boolean;
  className?: string;
}

export const METRIC_DOMAIN: [number, number] = [0, 100];

const METRIC_COLORS: Record<MetricTrendProps['metric'], string> = {
  stress: 'var(--accent)',
  burnout: 'var(--warn)',
  fatigue: 'var(--alert)',
};

const metricLabels: Record<MetricTrendProps['metric'], string> = {
  stress: 'Stress',
  burnout: 'Burnout',
  fatigue: 'Fatigue',
};

interface PreparedPoint extends MetricTrendPoint {
  dateLabel: string;
}

function prepare(points: MetricTrendPoint[]): PreparedPoint[] {
  return points
    .slice()
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .map((point) => ({
      ...point,
      dateLabel: format(new Date(point.ts), 'MMM d'),
    }));
}

function MetricTooltip({
  active,
  payload,
  label,
  metric,
}: TooltipProps<ValueType, NameType> & { metric: MetricTrendProps['metric'] }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const { value, payload: original } = payload[0] as {
    value: number;
    payload: PreparedPoint;
  };
  const status = mapToStatus(metric, value);
  return (
    <div className="rounded-md bg-card p-3 shadow-md">
      <p className="text-xs font-medium text-muted">{original.dateLabel ?? label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <span>{Math.round(value)}</span>
        <StatusChip status={status} />
      </div>
    </div>
  );
}

export default function MetricTrend({
  metric,
  points,
  thresholds,
  hint,
  title,
  isLoading = false,
  className,
}: MetricTrendProps) {
  const prepared = useMemo(() => prepare(points), [points]);
  const displayTitle = title ?? `${metricLabels[metric]} trend`;

  if (isLoading) {
    return (
      <section className={clsx('flex h-full flex-col rounded-xl border border-muted bg-card p-5 shadow-sm', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-6" rounded="full" />
        </div>
        <div className="mt-6 flex-1">
          <Skeleton className="h-40 w-full" rounded="lg" />
        </div>
      </section>
    );
  }

  if (!prepared.length) {
    return (
      <section className={clsx('flex h-full flex-col rounded-xl border border-dashed border-muted bg-card p-6 text-center', className)}>
        <div className="mx-auto max-w-sm space-y-3">
          <p className="text-sm font-semibold text-primary">{metricLabels[metric]}</p>
          <p className="text-sm text-muted">No data for selected range</p>
        </div>
      </section>
    );
  }

  return (
    <section className={clsx('flex h-full flex-col rounded-xl border border-muted bg-card p-5 shadow-sm', className)}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-primary">{displayTitle}</p>
          <p className="text-xs uppercase tracking-wide text-muted">14-day view</p>
        </div>
        {hint ? <InfoTooltip text={hint} /> : null}
      </header>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={prepared} margin={{ left: 0, right: 0, top: 12, bottom: 12 }}>
            <CartesianGrid stroke="var(--grid-stroke)" vertical={false} />
            <ReferenceArea y1={0} y2={thresholds.okMax} strokeOpacity={0} fill="var(--accent-soft)" />
            <ReferenceArea y1={thresholds.okMax} y2={thresholds.warnMax} strokeOpacity={0} fill="color-mix(in srgb, var(--warn) 18%, transparent)" />
            <ReferenceArea y1={thresholds.warnMax} y2={METRIC_DOMAIN[1]} strokeOpacity={0} fill="color-mix(in srgb, var(--alert) 18%, transparent)" />
            <XAxis dataKey="dateLabel" stroke="var(--axis-stroke)" tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis domain={METRIC_DOMAIN} stroke="var(--axis-stroke)" tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<MetricTooltip metric={metric} />} cursor={{ stroke: METRIC_COLORS[metric], strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={METRIC_COLORS[metric]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
