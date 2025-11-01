import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Area } from 'recharts';
import '@/styles/tokens.css';

export interface SparklineProps {
  data: number[];
}

const buildData = (values: number[]) =>
  values.map((value, index) => ({ index, value }));

export default function Sparkline({ data }: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-12 items-center justify-center text-xs text-muted">
        No data
      </div>
    );
  }

  const prepared = buildData(data);

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={prepared} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <Area type="monotone" dataKey="value" stroke="none" fill="var(--sparkline-fill)" isAnimationActive={false} />
        <XAxis dataKey="index" type="number" hide domain={[0, data.length - 1]} />
        <YAxis domain={[0, 100]} hide />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--sparkline-stroke)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
