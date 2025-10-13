(function(){
  const mount = document.getElementById('hr-board');
  if (!mount) return;

  const METRICS = {
    stress: {label: 'Stress', type: 'negative'},
    burnout: {label: 'Burnout', type: 'negative'},
    fatigue: {label: 'Fatigue', type: 'negative'},
    cardio: {label: 'Cardio Index', type: 'positive'}
  };

  const defaults = {
    stress: {score: 42, trend: [48, 46, 44, 43, 42, 40, 41], updated_at: new Date().toISOString()},
    burnout: {score: 31, trend: [35, 34, 33, 32, 31, 30, 31], updated_at: new Date().toISOString()},
    fatigue: {score: 58, trend: [61, 60, 59, 58, 57, 58, 58], updated_at: new Date().toISOString()},
    cardio: {score: 72, trend: [70, 71, 72, 72, 73, 72, 74], updated_at: new Date().toISOString()}
  };

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

  function readMetric(key, horizon) {
    try {
      const raw = localStorage.getItem(`hr:${key}`);
      if (!raw) return {...defaults[key]};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.score === 'number') {
        const result = {...defaults[key], ...parsed};
        if (horizon === 'long' && Array.isArray(parsed.trend30d)) {
          result.trend = parsed.trend30d;
        } else if (horizon === 'short' && Array.isArray(parsed.trend7d)) {
          result.trend = parsed.trend7d;
        } else if (!Array.isArray(result.trend) || !result.trend.length) {
          result.trend = defaults[key].trend;
        }
        return result;
      }
    } catch (e) {
      // ignore malformed entries
    }
    return {...defaults[key]};
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
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="var(--cyan)" stroke-width="4" stroke-linecap="round" points="${path}" /></svg>`;
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

  function rangeLabel(range) {
    if (!range) return 'Custom range';
    if (range.preset) {
      return (
        {
          day: 'Daily snapshot',
          '7d': '7-day overview',
          month: 'Monthly trend',
          year: 'Yearly outlook'
        }[range.preset] || 'Custom range'
      );
    }
    if (range.start && range.end) {
      return `${range.start} → ${range.end}`;
    }
    return 'Custom range';
  }

  function render() {
    const range = readRange();
    const horizon = horizonForRange(range);
    const cards = Object.keys(METRICS)
      .map(key => {
        const metric = readMetric(key, horizon);
        const updated = metric.updated_at ? new Date(metric.updated_at) : new Date();
        const updatedText = isNaN(updated.getTime()) ? 'Updated recently' : `Updated ${updated.toLocaleDateString()}`;
        const trend = Array.isArray(metric.trend) && metric.trend.length ? metric.trend : defaults[key].trend;
        const badge = status(metric.score, METRICS[key].type);
        return `<article class="hr-card" role="button" tabindex="0" data-focus="${key}">
        <div class="hr-card__ring"></div>
        <div class="hr-card__head">
          <span class="hr-card__label">${METRICS[key].label}</span>
          <span class="hr-badge hr-badge--${badge.tone}">${badge.label}</span>
        </div>
        <div class="hr-card__score">${Math.round(metric.score)}<span>/100</span></div>
        <div class="hr-card__spark">${sparkline(trend)}</div>
        <footer class="hr-card__foot">
          <span>${updatedText}</span>
          <span>${trend.length} pts</span>
        </footer>
      </article>`;
      })
      .join('');

    mount.innerHTML = `<div class="hr-panel__meta">
      <span>HR Board</span>
      <span>${rangeLabel(range)}</span>
    </div>
    <div class="hr-panel__grid">${cards}</div>`;
  }

  render();

  addEventListener('storage', evt => {
    if (!evt || !evt.key) return;
    if (evt.key === 'hr:range' || (evt.key.startsWith('hr:') && METRICS[evt.key.replace('hr:', '')])) {
      render();
    }
  });

  mount.addEventListener('click', evt => {
    const card = evt.target.closest('[data-focus]');
    if (!card) return;
    const key = card.getAttribute('data-focus');
    if (!key) return;
    window.location.href = `./User.html?focus=${encodeURIComponent(key)}`;
  });

  mount.addEventListener('keydown', evt => {
    if (evt.key !== 'Enter' && evt.key !== ' ') return;
    const card = evt.target.closest('[data-focus]');
    if (!card) return;
    evt.preventDefault();
    card.click();
  });
})();
