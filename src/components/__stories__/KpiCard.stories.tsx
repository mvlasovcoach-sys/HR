import type { Meta, StoryObj } from '@storybook/react';
import KpiCard from '@/components/KpiCard';

const meta: Meta<typeof KpiCard> = {
  title: 'Components/KPI Card',
  component: KpiCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const baseTrend = [54, 56, 58, 57, 55, 52, 50];

export const StressOk: Story = {
  args: {
    title: 'Stress',
    value: 52,
    status: 'OK',
    trend: baseTrend,
    drivers: ['night_shift', 'sleep_debt'],
    hint: 'Short-term physiological response.',
  },
};

export const BurnoutWarn: Story = {
  args: {
    title: 'Burnout',
    value: 63,
    status: 'WARN',
    trend: baseTrend.map((v) => v + 6),
    drivers: ['workload'],
    hint: 'Accumulated exhaustion.',
  },
};

export const FatigueAlert: Story = {
  args: {
    title: 'Fatigue',
    value: 78,
    status: 'ALERT',
    trend: baseTrend.map((v) => v + 10),
    drivers: ['sleep_debt', 'shift_swaps'],
    hint: 'Last-week fatigue.',
  },
};
