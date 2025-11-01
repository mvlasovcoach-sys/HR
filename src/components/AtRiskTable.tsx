import { useMemo, KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import StatusChip from '@/components/StatusChip';
import { SkeletonLines } from '@/components/Skeleton';
import type { RiskStatus } from '@/types/metrics';
import '@/styles/tokens.css';

export interface AtRiskRow {
  personId: string;
  name: string;
  stress: number;
  burnout: number;
  fatigue: number;
  maxStatus: RiskStatus;
  drivers?: string[];
}

export interface AtRiskTableProps {
  rows: AtRiskRow[];
  onOpenProfile?: (personId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_ORDER: RiskStatus[] = ['OK', 'WARN', 'ALERT'];

const statusWeight = (status: RiskStatus) => STATUS_ORDER.indexOf(status);

function RowSkeleton() {
  return (
    <tr className="border-b border-muted">
      <td className="px-4 py-3" colSpan={5}>
        <SkeletonLines lines={1} />
      </td>
    </tr>
  );
}

export default function AtRiskTable({ rows, onOpenProfile, isLoading = false, className }: AtRiskTableProps) {
  const sortedRows = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => {
        const aScore = Math.max(a.stress, a.burnout, a.fatigue);
        const bScore = Math.max(b.stress, b.burnout, b.fatigue);
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return statusWeight(b.maxStatus) - statusWeight(a.maxStatus);
      })
      .slice(0, 10);
  }, [rows]);

  const handleActivate = (personId: string) => {
    onOpenProfile?.(personId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, personId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenProfile?.(personId);
    }
  };

  return (
    <div className={clsx('overflow-hidden rounded-xl border border-muted bg-card shadow-sm', className)}>
      <div className="border-b border-muted px-4 py-3">
        <p className="text-sm font-semibold text-primary">Top-10 at risk</p>
        <p className="text-xs text-muted">Sorted by highest metric score</p>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="min-w-full text-left">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Stress</th>
              <th className="px-4 py-3 font-medium">Burnout</th>
              <th className="px-4 py-3 font-medium">Fatigue</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm text-primary">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => <RowSkeleton key={`loading-${index}`} />)
              : sortedRows.map((row) => (
                  <tr
                    key={row.personId}
                    tabIndex={onOpenProfile ? 0 : -1}
                    role={onOpenProfile ? 'button' : undefined}
                    className={clsx(
                      'align-top border-b border-muted transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      onOpenProfile
                        ? 'cursor-pointer hover:bg-muted'
                        : 'cursor-default'
                    )}
                    onClick={() => handleActivate(row.personId)}
                    onKeyDown={(event) => handleKeyDown(event, row.personId)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      {row.drivers && row.drivers.length > 0 ? (
                        <p className="mt-1 text-xs text-muted">Drivers: {row.drivers.join(', ')}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{Math.round(row.stress)}</td>
                    <td className="px-4 py-3 text-sm text-muted">{Math.round(row.burnout)}</td>
                    <td className="px-4 py-3 text-sm text-muted">{Math.round(row.fatigue)}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={row.maxStatus} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && sortedRows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">No data for selected range</div>
        ) : null}
      </div>
    </div>
  );
}
