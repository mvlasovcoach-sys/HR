export type RiskStatus = 'OK' | 'WARN' | 'ALERT';

export interface MetricScores {
  stress: number; // 0–100
  burnout: number; // 0–100
  fatigue: number; // 0–100
  wellbeing: number; // 0–100 (composite, beta)
}

export interface MetricDrivers {
  stress?: string[]; // ['hrv_low','night_shift',...]
  burnout?: string[];
  fatigue?: string[];
  wellbeing?: string[]; // объяснимые факторы композита
}

export interface PersonSample {
  person_id: string; // 'emp_123'
  ts: string; // ISO datetime
  signals: {
    hrv_rmssd?: number;
    rhr?: number;
    sleep_hours?: number;
    shift?: 'day' | 'night' | 'off';
    subjective_energy?: number; // 1–5
  };
  scores: MetricScores;
  explain?: MetricDrivers;
}
