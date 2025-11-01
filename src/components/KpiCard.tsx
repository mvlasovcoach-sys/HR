import { clsx } from 'clsx';
import type { RiskStatus } from '@/types/metrics';
import StatusChip from '@/components/StatusChip';
import InfoTooltip from '@/components/InfoTooltip';
import Sparkline from '@/components/Sparkline';
import Skeleton from '@/components/Skeleton';
import '@/styles/tokens.css';

export interface KpiCardProps {
  title: string;
  value: number | null;
  status: RiskStatus;
  trend: number[];
  drivers?: string[];
  hint?: string;
  isLoading?: boolean;
  className?: string;
}

function formatValue(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `${clamped}`;
}

export default function KpiCard({
  title,
  value,
  status,
  trend,
  drivers,
  hint,
  isLoading = false,
  className,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className={clsx('flex flex-col justify-between rounded-xl border border-muted bg-card p-5 shadow-sm', className)}>
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-6" rounded="full" />
        </div>
        <div className="mt-6">
          <Skeleton className="h-10 w-20" rounded="lg" />
        </div>
        <div className="mt-6">
          <Skeleton className="h-12 w-full" rounded="lg" />
        </div>
      </div>
    );
  }

  const formattedValue = formatValue(value);
  const hasDrivers = drivers && drivers.length > 0;

  return (
    <article
      className={clsx(
        'flex h-full flex-col justify-between rounded-xl border border-muted bg-card p-5 shadow-sm transition hover:shadow-md',
        className
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted">{title}</p>
          <StatusChip status={status} className="mt-2" />
        </div>
        {hint ? <InfoTooltip text={hint} /> : null}
      </header>
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-semibold text-primary" data-testid="kpi-value">
            {formattedValue}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted">Score</p>
        </div>
        <div className="flex-1">
          <Sparkline data={trend} />
        </div>
      </div>
      {hasDrivers ? (
        <div className="mt-4 text-xs text-muted">
          <p className="font-semibold uppercase tracking-wide text-secondary">Drivers</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {drivers!.map((driver) => (
              <li key={driver} className="rounded-full bg-chip-muted px-2 py-1 text-[0.7rem] font-medium uppercase">
                {driver.replaceAll('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
