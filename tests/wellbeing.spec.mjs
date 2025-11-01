import test from 'node:test';
import assert from 'node:assert/strict';
import { calcWellbeing } from '../assets/js/modules/lib/scores.js';

test('calcWellbeing returns 100 for zero inputs', () => {
  assert.equal(calcWellbeing(0, 0, 0), 100);
});

test('calcWellbeing returns 0 for maximum inputs', () => {
  assert.equal(calcWellbeing(100, 100, 100), 0);
});

test('calcWellbeing decreases as stress increases', () => {
  const base = calcWellbeing(30, 30, 30);
  const higher = calcWellbeing(70, 30, 30);
  assert.ok(higher < base);
});

test('calcWellbeing decreases as burnout increases', () => {
  const base = calcWellbeing(30, 30, 30);
  const higher = calcWellbeing(30, 70, 30);
  assert.ok(higher < base);
});

test('calcWellbeing decreases as fatigue increases', () => {
  const base = calcWellbeing(30, 30, 30);
  const higher = calcWellbeing(30, 30, 70);
  assert.ok(higher < base);
});

test('calcWellbeing handles realistic high load scenario', () => {
  const value = calcWellbeing(68, 55, 72);
  assert.ok(value >= 0 && value <= 100);
  assert.ok(value < 40);
});
