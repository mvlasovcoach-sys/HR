import { clsx } from 'clsx';
import '@/styles/tokens.css';

export interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export default function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div className={clsx('skeleton', ROUNDED[rounded], className)} />
  );
}

type SkeletonLinesProps = {
  lines?: number;
  className?: string;
};

export function SkeletonLines({ lines = 3, className }: SkeletonLinesProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton key={idx} className="h-3 w-full" rounded="sm" />
      ))}
    </div>
  );
}
