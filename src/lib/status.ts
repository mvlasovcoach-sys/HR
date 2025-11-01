import { DEFAULT_THRESHOLDS } from '@/config/thresholds';
import type { RiskStatus } from '@/types/metrics';

export function mapToStatus(metric: 'stress' | 'burnout' | 'fatigue', value: number): RiskStatus {
  const t = DEFAULT_THRESHOLDS[metric];
  if (!t) {
    throw new Error(`Unknown metric: ${metric}`);
  }
  if (value <= t.okMax) return 'OK';
  if (value <= t.warnMax) return 'WARN';
  return 'ALERT';
}
