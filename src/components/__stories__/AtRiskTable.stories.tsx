import type { Meta, StoryObj } from '@storybook/react';
import AtRiskTable, { type AtRiskRow } from '@/components/AtRiskTable';

const rows: AtRiskRow[] = Array.from({ length: 5 }).map((_, index) => ({
  personId: `emp_${index + 1}`,
  name: `Employee ${index + 1}`,
  stress: 50 + index * 5,
  burnout: 40 + index * 7,
  fatigue: 55 + index * 3,
  maxStatus: index > 2 ? 'ALERT' : index > 1 ? 'WARN' : 'OK',
  drivers: ['sleep_debt', 'workload'].slice(0, (index % 2) + 1),
}));

const meta: Meta<typeof AtRiskTable> = {
  title: 'Components/At Risk Table',
  component: AtRiskTable,
  args: {
    rows,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    rows: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};
