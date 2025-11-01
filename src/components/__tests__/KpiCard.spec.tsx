import { render, screen } from '@testing-library/react';
import KpiCard from '@/components/KpiCard';

describe('KpiCard', () => {
  it('renders the formatted value and status chip', () => {
    render(
      <KpiCard
        title="Stress"
        value={42.3}
        status="OK"
        trend={[10, 20, 30]}
        hint="Stress score"
      />
    );

    expect(screen.getByTestId('kpi-value')).toHaveTextContent('42');
    expect(screen.getByText(/OK/i)).toBeInTheDocument();
  });
});
