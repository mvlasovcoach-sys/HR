import test from 'node:test';
import assert from 'node:assert/strict';
import { mapToStatus } from '../assets/js/modules/lib/status.js';

test('mapToStatus stress thresholds', () => {
  assert.equal(mapToStatus('stress', 0), 'OK');
  assert.equal(mapToStatus('stress', 39), 'OK');
  assert.equal(mapToStatus('stress', 40), 'WARN');
  assert.equal(mapToStatus('stress', 59), 'WARN');
  assert.equal(mapToStatus('stress', 60), 'ALERT');
});

test('mapToStatus burnout thresholds', () => {
  assert.equal(mapToStatus('burnout', 10), 'OK');
  assert.equal(mapToStatus('burnout', 34), 'OK');
  assert.equal(mapToStatus('burnout', 35), 'WARN');
  assert.equal(mapToStatus('burnout', 54), 'WARN');
  assert.equal(mapToStatus('burnout', 55), 'ALERT');
});

test('mapToStatus fatigue thresholds', () => {
  assert.equal(mapToStatus('fatigue', 39), 'OK');
  assert.equal(mapToStatus('fatigue', 40), 'WARN');
  assert.equal(mapToStatus('fatigue', 59), 'WARN');
  assert.equal(mapToStatus('fatigue', 60), 'ALERT');
});
