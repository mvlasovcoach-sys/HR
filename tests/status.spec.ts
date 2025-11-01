import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapToStatus } from '@/lib/status';

describe('mapToStatus thresholds', () => {
  it('maps stress thresholds correctly', () => {
    assert.equal(mapToStatus('stress', 0), 'OK');
    assert.equal(mapToStatus('stress', 39), 'OK');
    assert.equal(mapToStatus('stress', 40), 'WARN');
    assert.equal(mapToStatus('stress', 59), 'WARN');
    assert.equal(mapToStatus('stress', 60), 'ALERT');
  });

  it('maps burnout thresholds correctly', () => {
    assert.equal(mapToStatus('burnout', 10), 'OK');
    assert.equal(mapToStatus('burnout', 34), 'OK');
    assert.equal(mapToStatus('burnout', 35), 'WARN');
    assert.equal(mapToStatus('burnout', 54), 'WARN');
    assert.equal(mapToStatus('burnout', 55), 'ALERT');
  });

  it('maps fatigue thresholds correctly', () => {
    assert.equal(mapToStatus('fatigue', 39), 'OK');
    assert.equal(mapToStatus('fatigue', 40), 'WARN');
    assert.equal(mapToStatus('fatigue', 59), 'WARN');
    assert.equal(mapToStatus('fatigue', 60), 'ALERT');
  });
});
