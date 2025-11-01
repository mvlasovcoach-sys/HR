import { render, screen, fireEvent } from '@testing-library/react';
import AtRiskTable from '@/components/AtRiskTable';
import type { AtRiskRow } from '@/components/AtRiskTable';

describe('AtRiskTable', () => {
  const rows: AtRiskRow[] = [
    {
      personId: 'emp_1',
      name: 'Employee 1',
      stress: 80,
      burnout: 60,
      fatigue: 70,
      maxStatus: 'ALERT',
      drivers: ['sleep_debt'],
    },
  ];

  it('calls onOpenProfile when clicking a row', () => {
    const handler = vi.fn();
    render(<AtRiskTable rows={rows} onOpenProfile={handler} />);

    fireEvent.click(screen.getByText('Employee 1'));
    expect(handler).toHaveBeenCalledWith('emp_1');
  });

  it('supports keyboard activation', () => {
    const handler = vi.fn();
    render(<AtRiskTable rows={rows} onOpenProfile={handler} />);

    const row = screen.getByText('Employee 1').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.keyDown(row!, { key: 'Enter' });
    expect(handler).toHaveBeenCalledWith('emp_1');
  });
});
