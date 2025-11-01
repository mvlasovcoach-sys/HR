import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcWellbeing } from '@/lib/scores';

describe('calcWellbeing', () => {
  it('returns 100 when all inputs are zero', () => {
    assert.equal(calcWellbeing(0, 0, 0), 100);
  });

  it('returns 0 when inputs are extreme', () => {
    assert.equal(calcWellbeing(100, 100, 100), 0);
  });

  it('is monotonic decreasing when stress increases', () => {
    const base = calcWellbeing(30, 30, 30);
    const higherStress = calcWellbeing(70, 30, 30);
    assert.ok(higherStress < base);
  });

  it('is monotonic decreasing when burnout increases', () => {
    const base = calcWellbeing(30, 30, 30);
    const higherBurnout = calcWellbeing(30, 70, 30);
    assert.ok(higherBurnout < base);
  });

  it('is monotonic decreasing when fatigue increases', () => {
    const base = calcWellbeing(30, 30, 30);
    const higherFatigue = calcWellbeing(30, 30, 70);
    assert.ok(higherFatigue < base);
  });

  it('handles realistic scenario with high stress and fatigue', () => {
    const value = calcWellbeing(68, 55, 72);
    assert.ok(value >= 0 && value <= 100);
    assert.ok(value < 40);
  });
});
