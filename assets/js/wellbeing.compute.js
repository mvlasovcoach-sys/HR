(function(global){
  const root = document.getElementById('wellness-root');
  if (!root || !global.MockStream) return;

  const baselineKey = 'hr:baseline';
  const defaultBaseline = {
    hr: 72,
    rmssd: 46,
    steps: 8200,
    restingHr: 58
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadBaseline() {
    try {
      const stored = localStorage.getItem(baselineKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {...defaultBaseline, ...parsed};
        }
      }
    } catch (e) {
      // ignore malformed entries
    }
    localStorage.setItem(baselineKey, JSON.stringify(defaultBaseline));
    return {...defaultBaseline};
  }

  const baseline = loadBaseline();

  const trends = {
    stress: {short: [], long: []},
    burnout: {short: [], long: []},
    fatigue: {short: [], long: []},
    cardio: {short: [], long: []}
  };

  function seedTrends(key) {
    try {
      const raw = localStorage.getItem(`hr:${key}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed) return;
      if (Array.isArray(parsed.trend7d)) {
        trends[key].short = parsed.trend7d.slice(-7);
      }
      if (Array.isArray(parsed.trend30d)) {
        trends[key].long = parsed.trend30d.slice(-30);
      }
    } catch (e) {
      // ignore
    }
  }

  Object.keys(trends).forEach(seedTrends);

  function pushTrend(key, value) {
    const rounded = Math.round(value);
    const short = trends[key].short;
    const long = trends[key].long;
    short.push(rounded);
    long.push(rounded);
    if (short.length > 7) short.shift();
    if (long.length > 30) long.shift();
  }

  function computeScores(sample) {
    const stress = clamp(
      50 + (sample.hr - baseline.hr) * 1.8 + (baseline.rmssd - sample.rmssd) * 1.2,
      0,
      100
    );
    const fatigue = clamp(
      45 + (sample.restingHr - baseline.restingHr) * 4 - (sample.steps - baseline.steps) / 450,
      0,
      100
    );
    const burnout = clamp(
      35 + (stress - 50) * 0.5 + (fatigue - 50) * 0.3 - (sample.steps - baseline.steps) / 700,
      0,
      100
    );
    const cardio = clamp(
      60 + (sample.rmssd - baseline.rmssd) * 1.5 - (sample.hr - baseline.hr) * 0.9,
      0,
      100
    );
    const wellbeing = clamp(
      0.4 * cardio + 0.25 * (100 - stress) + 0.2 * (100 - fatigue) + 0.15 * (100 - burnout),
      0,
      100
    );
    return {stress, burnout, fatigue, cardio, wellbeing};
  }

  function horizonForRange(range) {
    if (range && range.preset) {
      if (range.preset === 'month' || range.preset === 'year') return 'long';
      return 'short';
    }
    if (range && range.start && range.end) {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (!isNaN(start) && !isNaN(end)) {
        const diff = (end - start) / (1000 * 60 * 60 * 24);
        if (diff > 14) return 'long';
      }
    }
    return 'short';
  }

  function readRange() {
    try {
      const raw = localStorage.getItem('hr:range');
      if (!raw) return {preset: '7d'};
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    } catch (e) {
      // ignore
    }
    return {preset: '7d'};
  }

  function status(score, type) {
    if (type === 'positive') {
      if (score >= 70) return {label: 'Strong', tone: 'strong'};
      if (score >= 40) return {label: 'Neutral', tone: 'neutral'};
      return {label: 'Weak', tone: 'weak'};
    }
    if (score >= 70) return {label: 'High', tone: 'high'};
    if (score >= 40) return {label: 'Moderate', tone: 'moderate'};
    return {label: 'Low', tone: 'low'};
  }

  function updateStorage(scores, horizon) {
    const now = new Date().toISOString();
    Object.keys(trends).forEach(key => {
      const payload = {
        score: scores[key],
        updated_at: now,
        trend: trends[key][horizon === 'long' ? 'long' : 'short'].slice(),
        trend7d: trends[key].short.slice(),
        trend30d: trends[key].long.slice()
      };
      localStorage.setItem(`hr:${key}`, JSON.stringify(payload));
      dispatchEvent(new StorageEvent('storage', {key: `hr:${key}`}));
    });
  }

  function formatNumber(value) {
    return value.toLocaleString(undefined, {maximumFractionDigits: 0});
  }

  function render(sample, scores, horizon) {
    const frame = root.querySelector('[data-ring-frame]');
    const scoreEl = root.querySelector('[data-wellbeing-score]');
    const statusEl = root.querySelector('[data-wellbeing-status]');
    const copyEl = root.querySelector('[data-wellbeing-copy]');
    const stateEl = root.querySelector('[data-wellbeing-state]');
    const horizonLabel = root.querySelector('[data-trend-horizon]');

    if (frame) frame.style.setProperty('--value', `${Math.round(scores.wellbeing)}%`);
    if (scoreEl) scoreEl.textContent = Math.round(scores.wellbeing);

    const wellbeingState = scores.wellbeing >= 75 ? 'Optimal' : scores.wellbeing >= 50 ? 'Balanced' : 'Watch';
    if (statusEl) statusEl.textContent = wellbeingState;
    if (stateEl) stateEl.textContent = `${wellbeingState}`;
    if (copyEl) {
      if (scores.wellbeing >= 75) {
        copyEl.textContent = 'Wellbeing trending above baseline — maintain current recovery cadence.';
      } else if (scores.wellbeing >= 50) {
        copyEl.textContent = 'Overall balance holds steady; light recovery recommended this evening.';
      } else {
        copyEl.textContent = 'Sustained strain detected. Prioritize rest, hydration, and reduced intensity.';
      }
    }
    if (horizonLabel) horizonLabel.textContent = horizon === 'long' ? '30-day view' : '7-day view';

    ['stress', 'burnout', 'fatigue', 'cardio'].forEach(key => {
      const trendCard = root.querySelector(`[data-trend-card="${key}"]`);
      const badgeEl = root.querySelector(`[data-trend-badge="${key}"]`);
      const scoreEl = root.querySelector(`[data-trend-score="${key}"]`);
      const countEl = root.querySelector(`[data-trend-count="${key}"]`);
      const sparkEl = root.querySelector(`[data-trend-spark="${key}"]`);
      const badge = status(scores[key], key === 'cardio' ? 'positive' : 'negative');
      if (badgeEl) {
        badgeEl.textContent = badge.label;
        badgeEl.className = `hr-badge hr-badge--${badge.tone}`;
      }
      if (scoreEl) scoreEl.textContent = Math.round(scores[key]);
      if (countEl) countEl.textContent = `${trends[key][horizon].length} pts`;
      if (sparkEl) sparkEl.innerHTML = sparkline(trends[key][horizon]);
      if (trendCard) trendCard.setAttribute('tabindex', '0');
    });

    const dot = root.querySelector('[data-device-dot]');
    const statusLabel = root.querySelector('[data-device-status]');
    const syncEl = root.querySelector('[data-device-sync]');
    const batteryEl = root.querySelector('[data-device-battery]');
    const restHrEl = root.querySelector('[data-device-resthr]');
    const stepsEl = root.querySelector('[data-device-steps]');
    const estimateEl = root.querySelector('[data-device-estimate]');

    if (dot) {
      dot.classList.remove('is-warning', 'is-error');
      if (!sample.connected) {
        dot.classList.add('is-error');
      } else if (sample.battery < 0.25) {
        dot.classList.add('is-warning');
      }
    }
    if (statusLabel) statusLabel.textContent = sample.connected ? 'Connected' : 'Reconnecting…';
    if (syncEl) syncEl.textContent = `Last sync: ${timeAgo(sample.lastSync)}`;
    if (batteryEl) batteryEl.textContent = `${Math.round(sample.battery * 100)}%`;
    if (restHrEl) restHrEl.textContent = `${Math.round(sample.restingHr)} bpm`;
    if (stepsEl) stepsEl.textContent = formatNumber(sample.steps);
    if (estimateEl) {
      const estimateHours = Math.round(sample.battery * 18);
      estimateEl.textContent = `~${estimateHours}h`; // 18h full-day projection
    }
  }

  function sparkline(values) {
    const points = values && values.length ? values : [0];
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = max - min || 1;
    const step = points.length > 1 ? 100 / (points.length - 1) : 100;
    const path = points
      .map((v, i) => {
        const x = (step * i).toFixed(2);
        const y = (100 - ((v - min) / span) * 100).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="var(--cyan)" stroke-width="3" stroke-linecap="round" points="${path}" /></svg>`;
  }

  function timeAgo(timestamp) {
    const delta = Date.now() - timestamp;
    if (delta < 60000) return 'just now';
    const minutes = Math.round(delta / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
  }

  let lastScores = computeScores(global.MockStream.getState());
  ['stress', 'burnout', 'fatigue', 'cardio'].forEach(key => {
    if (!trends[key].short.length) {
      pushTrend(key, lastScores[key]);
    }
  });
  const initialRange = readRange();
  const initialHorizon = horizonForRange(initialRange);
  updateStorage(lastScores, initialHorizon);
  render(global.MockStream.getState(), lastScores, initialHorizon);

  global.MockStream.subscribe(sample => {
    const scores = computeScores(sample);
    ['stress', 'burnout', 'fatigue', 'cardio'].forEach(key => pushTrend(key, scores[key]));
    const range = readRange();
    const horizon = horizonForRange(range);
    updateStorage(scores, horizon);
    render(sample, scores, horizon);
    lastScores = scores;
  });

  addEventListener('storage', evt => {
    if (!evt || evt.key !== 'hr:range') return;
    const range = readRange();
    const horizon = horizonForRange(range);
    updateStorage(lastScores, horizon);
    render(global.MockStream.getState(), lastScores, horizon);
  });
})(window);
