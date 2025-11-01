import { render, screen } from '@testing-library/react';
import MetricTrend, { METRIC_DOMAIN } from '@/components/MetricTrend';

const SAMPLE_POINTS = Array.from({ length: 5 }).map((_, index) => ({
  ts: `2024-10-${10 + index}T00:00:00.000Z`,
  value: 20 + index * 5,
}));

describe('MetricTrend', () => {
  it('exposes a fixed metric domain', () => {
    expect(METRIC_DOMAIN).toEqual([0, 100]);
  });

  it('renders chart structure', () => {
    render(
      <MetricTrend
        metric="stress"
        points={SAMPLE_POINTS}
        thresholds={{ okMax: 40, warnMax: 60 }}
        hint="Stress trend"
      />
    );

    expect(screen.getByText(/Stress trend/i)).toBeInTheDocument();
  });
});
