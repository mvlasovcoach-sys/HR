import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OnDutyBadge from '../OnDutyBadge';

const sampleSizeMock = vi.fn().mockReturnValue({ expected: 57, sample: 43, coveragePct: 75 });

vi.mock('@/demo/sample.utils', () => ({
  sampleSize: (...args: unknown[]) => sampleSizeMock(...args),
  demoCoverage: vi.fn(() => 0.75),
  coverageFromData: vi.fn(() => null),
}));

const subscribeMock = vi.fn((listener: (state: { samples: unknown[] }) => void) => {
  listener({ samples: [] });
  return () => undefined;
});

vi.mock('@/store/appState', () => ({
  appStore: {
    subscribe: subscribeMock,
    setMode: vi.fn(),
    loadSamples: vi.fn(() => Promise.resolve([])),
  },
}));

describe('OnDutyBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sampleSizeMock.mockClear();
    sampleSizeMock.mockReturnValue({ expected: 57, sample: 43, coveragePct: 75 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders formatted label with defaults', () => {
    render(<OnDutyBadge teamKey="team.all" />);
    vi.runOnlyPendingTimers();
    expect(screen.getByText('On duty: 57 • Sample: 43 (75%)')).toBeInTheDocument();
  });

  it('renders NA sample when expected is zero', () => {
    sampleSizeMock.mockReturnValue({ expected: 0, sample: 0, coveragePct: 0 });
    render(<OnDutyBadge teamKey="team.day_support" />);
    vi.runOnlyPendingTimers();
    expect(screen.getByText('On duty: 0 • Sample: —')).toBeInTheDocument();
  });
});
