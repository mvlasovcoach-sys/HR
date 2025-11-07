import { describe, it, expect } from 'vitest';
import { resolveRange } from '../assets/js/utils/dateRange.js';

const tz = 'Europe/Amsterdam';

describe('resolveRange', () => {
  it('resolves today range with compare window', async () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const range = await resolveRange('today', now, tz);
    expect(range.start).toBe(new Date('2024-01-15T00:00:00+01:00').toISOString());
    expect(range.end).toBe(new Date('2024-01-16T00:00:00+01:00').toISOString());
    expect(range.compare.start).toBe(new Date('2024-01-14T00:00:00+01:00').toISOString());
    expect(range.compare.end).toBe(new Date('2024-01-15T00:00:00+01:00').toISOString());
  });

  it('resolves last 7 days ending yesterday', async () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const range = await resolveRange('7d', now, tz);
    expect(range.start).toBe(new Date('2024-01-08T00:00:00+01:00').toISOString());
    expect(range.end).toBe(new Date('2024-01-15T00:00:00+01:00').toISOString());
    expect(range.compare.start).toBe(new Date('2023-12-31T00:00:00+01:00').toISOString());
    expect(range.compare.end).toBe(new Date('2024-01-08T00:00:00+01:00').toISOString());
  });

  it('resolves month-to-date range to yesterday', async () => {
    const now = new Date('2024-06-05T12:00:00Z');
    const range = await resolveRange('mtd', now, tz);
    expect(range.start).toBe(new Date('2024-06-01T00:00:00+02:00').toISOString());
    expect(range.end).toBe(new Date('2024-06-05T00:00:00+02:00').toISOString());
    const span = new Date(range.end).getTime() - new Date(range.start).getTime();
    const compareSpan = new Date(range.compare.end).getTime() - new Date(range.compare.start).getTime();
    expect(compareSpan).toBe(span);
  });

  it('resolves quarter-to-date range across DST', async () => {
    const now = new Date('2024-05-15T08:00:00Z');
    const range = await resolveRange('qtd', now, tz);
    expect(range.start).toBe(new Date('2024-04-01T00:00:00+02:00').toISOString());
    expect(range.end).toBe(new Date('2024-05-15T00:00:00+02:00').toISOString());
    const span = new Date(range.end).getTime() - new Date(range.start).getTime();
    const compareSpan = new Date(range.compare.end).getTime() - new Date(range.compare.start).getTime();
    expect(compareSpan).toBe(span);
  });

  it('resolves year-to-date range', async () => {
    const now = new Date('2024-10-10T10:00:00Z');
    const range = await resolveRange('ytd', now, tz);
    expect(range.start).toBe(new Date('2024-01-01T00:00:00+01:00').toISOString());
    expect(range.end).toBe(new Date('2024-10-10T00:00:00+02:00').toISOString());
    const span = new Date(range.end).getTime() - new Date(range.start).getTime();
    const compareSpan = new Date(range.compare.end).getTime() - new Date(range.compare.start).getTime();
    expect(compareSpan).toBe(span);
  });

  it('resolves custom range and compare', async () => {
    const now = new Date('2024-03-10T12:00:00Z');
    const range = await resolveRange({ kind: 'custom', start: '2024-03-02', end: '2024-03-05' }, now, tz);
    expect(range.start).toBe(new Date('2024-03-02T00:00:00+01:00').toISOString());
    expect(range.end).toBe(new Date('2024-03-06T00:00:00+01:00').toISOString());
    expect(range.compare.start).toBe(new Date('2024-02-27T00:00:00+01:00').toISOString());
    expect(range.compare.end).toBe(new Date('2024-03-02T00:00:00+01:00').toISOString());
  });

  it('returns null for invalid custom ranges', async () => {
    const now = new Date('2024-03-10T12:00:00Z');
    const range = await resolveRange({ kind: 'custom', start: '2024-03-05', end: '2024-03-05' }, now, tz);
    expect(range).toBeNull();
  });
});
