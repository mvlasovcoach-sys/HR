import type { Meta, StoryObj } from '@storybook/react';
import MetricTrend from '@/components/MetricTrend';
import { DEFAULT_THRESHOLDS } from '@/config/thresholds';

const meta: Meta<typeof MetricTrend> = {
  title: 'Components/Metric Trend',
  component: MetricTrend,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    thresholds: DEFAULT_THRESHOLDS.stress,
    points: Array.from({ length: 14 }).map((_, index) => ({
      ts: `2024-10-${(index + 1).toString().padStart(2, '0')}T00:00:00.000Z`,
      value: 40 + Math.sin(index) * 10,
    })),
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Stress: Story = {
  args: {
    metric: 'stress',
    hint: 'Crew-wide stress score',
  },
};

export const Burnout: Story = {
  args: {
    metric: 'burnout',
    thresholds: DEFAULT_THRESHOLDS.burnout,
    hint: 'Burnout trend',
  },
};

export const Fatigue: Story = {
  args: {
    metric: 'fatigue',
    thresholds: DEFAULT_THRESHOLDS.fatigue,
    hint: 'Fatigue trend',
  },
};

export const Empty: Story = {
  args: {
    metric: 'stress',
    points: [],
  },
};
