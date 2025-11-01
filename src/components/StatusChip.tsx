import { clsx } from 'clsx';
import type { RiskStatus } from '@/types/metrics';
import '@/styles/tokens.css';

const STATUS_STYLES: Record<RiskStatus, string> = {
  OK: 'bg-status-ok text-status-ok border border-transparent',
  WARN: 'bg-status-warn text-status-warn border border-transparent',
  ALERT: 'bg-status-alert text-status-alert border border-transparent',
};

export interface StatusChipProps {
  status: RiskStatus;
  label?: string;
  className?: string;
}

const STATUS_LABELS: Record<RiskStatus, string> = {
  OK: 'OK',
  WARN: 'Warn',
  ALERT: 'Alert',
};

export default function StatusChip({ status, label, className }: StatusChipProps) {
  const resolved = STATUS_STYLES[status];
  const text = label ?? STATUS_LABELS[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide',
        resolved,
        className
      )}
      data-status={status}
    >
      {text}
    </span>
  );
}
