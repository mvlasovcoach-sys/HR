import { DEFAULT_THRESHOLDS } from '../config/thresholds.js';

export function mapToStatus(metric, value) {
  const thresholds = DEFAULT_THRESHOLDS[metric];
  if (!thresholds) {
    throw new Error(`Unknown metric: ${metric}`);
  }
  if (value <= thresholds.okMax) return 'OK';
  if (value <= thresholds.warnMax) return 'WARN';
  return 'ALERT';
}
