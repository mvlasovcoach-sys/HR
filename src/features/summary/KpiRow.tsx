import KpiCard, { type KpiCardProps } from '@/components/KpiCard';
import '@/styles/tokens.css';

export interface KpiSummaryCard extends Omit<KpiCardProps, 'className'> {
  id: string;
}

export interface KpiRowProps {
  items?: KpiSummaryCard[];
  isLoading?: boolean;
}

const PLACEHOLDER_TEXT = 'No data for selected range';

export default function KpiRow({ items = [], isLoading = false }: KpiRowProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <KpiCard key={`skeleton-${index}`} title="" value={null} status="OK" trend={[]} isLoading />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-muted bg-card p-6 text-center text-sm text-muted">
        {PLACEHOLDER_TEXT}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.id} {...item} />
      ))}
    </div>
  );
}
