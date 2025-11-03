const TEMPLATE_URL = new URL('./kpi-cards.html', import.meta.url);
let templatePromise = null;
let cardIdCounter = 0;

const ICONS = {
  up: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 3l5.5 7.5H2.5L8 3z"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 13L2.5 5.5h11L8 13z"/></svg>',
  flat: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 8.25h12v-1.5H2z"/></svg>'
};

export const KPI_CONFIG = {
  defaultRange: '7d',
  ranges: [
    { id: '1d', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' }
  ],
  metrics: {
    wellbeing: {
      label: () => window.I18N?.t?.('kpi.wellbeing', 'Wellbeing') || 'Wellbeing',
      unit: '/100',
      description: 'Composite wellbeing score (higher is better)',
      decimals: 0,
      format: value => value?.toFixed?.(0)
    },
    stressAvg: {
      label: () => window.I18N?.t?.('kpi.stress', 'Stress average') || 'Stress average',
      unit: '/100',
      description: 'Average stress index (lower is better)',
      decimals: 0,
      format: value => value?.toFixed?.(0),
      inverse: true
    },
    burnoutPct: {
      label: () => window.I18N?.t?.('kpi.burnoutRisk', 'Burnout risk') || 'Burnout risk',
      unit: '%',
      description: 'Share of users flagged for burnout risk',
      decimals: 1,
      format: value => value?.toFixed?.(1)
    },
    fatiguePct: {
      label: () => window.I18N?.t?.('kpi.elevatedFatigue', 'Elevated fatigue') || 'Elevated fatigue',
      unit: '%',
      description: 'Share of users with elevated fatigue',
      decimals: 1,
      format: value => value?.toFixed?.(1)
    }
  },
  thresholds: {
    wellbeing: v => (typeof v === 'number' ? (v >= 75 ? 'green' : v >= 60 ? 'amber' : 'red') : 'amber'),
    stressAvg: v => (typeof v === 'number' ? (v <= 35 ? 'green' : v <= 55 ? 'amber' : 'red') : 'amber'),
    burnoutPct: v => (typeof v === 'number' ? (v <= 10 ? 'green' : v <= 20 ? 'amber' : 'red') : 'amber'),
    fatiguePct: v => (typeof v === 'number' ? (v <= 20 ? 'green' : v <= 30 ? 'amber' : 'red') : 'amber')
  },
  polarity: {
    wellbeing: 'higher_is_better',
    stressAvg: 'lower_is_better',
    burnoutPct: 'lower_is_better',
    fatiguePct: 'lower_is_better'
  }
};

async function ensureTemplates() {
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load KPI template');
        return response.text();
      })
      .then(markup => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(markup, 'text/html');
        const cardsTemplate = doc.querySelector('#tpl-kpi-cards');
        const cardTemplate = doc.querySelector('#tpl-kpi-card');
        if (!cardsTemplate || !cardTemplate) {
          throw new Error('Missing KPI templates');
        }
        return {
          cardsTemplate,
          cardTemplate
        };
      });
  }
  return templatePromise;
}

function translate(key, fallback) {
  return window.I18N?.t?.(key, fallback) || fallback;
}

function clampPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function describeTone(tone) {
  switch (tone) {
    case 'green':
      return translate('kpi.state.good', 'On track');
    case 'red':
      return translate('kpi.state.critical', 'Needs attention');
    default:
      return translate('kpi.state.caution', 'Monitor');
  }
}

function describeDelta(metricKey, delta, config) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) {
    return translate('kpi.delta.na', 'No change available');
  }
  const polarity = config.polarity?.[metricKey] || 'higher_is_better';
  const unit = config.metrics?.[metricKey]?.unit || '';
  const absolute = Math.abs(delta);
  const formatted = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  let direction = 'flat';
  let goodDirection = 'up';
  if (polarity === 'lower_is_better') {
    goodDirection = 'down';
  }
  if (absolute < 0.1) {
    direction = 'flat';
  } else if (delta > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }
  const isGood = direction === goodDirection;
  const toneKey = isGood ? 'kpi.delta.improved' : direction === 'flat' ? 'kpi.delta.flat' : 'kpi.delta.degraded';
  const fallback = direction === 'flat' ? 'Holding steady' : isGood ? 'Improved' : 'Declined';
  return `${translate(toneKey, fallback)} ${formatted}${unit}`.trim();
}

function deltaDirection(metricKey, delta, config) {
  if (typeof delta !== 'number' || Number.isNaN(delta) || Math.abs(delta) < 0.1) return 'flat';
  const polarity = config.polarity?.[metricKey] || 'higher_is_better';
  const upIsGood = polarity === 'higher_is_better';
  if (delta > 0) {
    return upIsGood ? 'up' : 'down';
  }
  return upIsGood ? 'down' : 'up';
}

function formatDeltaValue(delta, metricKey, config) {
  if (typeof delta !== 'number' || Number.isNaN(delta) || Math.abs(delta) < 0.05) {
    return translate('kpi.delta.naShort', 'N/A');
  }
  const unit = config.metrics?.[metricKey]?.unit || '';
  const precision = Math.abs(delta) >= 10 ? 0 : 1;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(precision)}${unit}`;
}

function setRangeButtonState(container, activeRange) {
  container.querySelectorAll('[data-range]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.range === activeRange ? 'true' : 'false');
  });
}

function resolveBadge(tone) {
  switch (tone) {
    case 'green':
      return translate('kpi.badge.positive', 'Good');
    case 'red':
      return translate('kpi.badge.negative', 'Critical');
    default:
      return translate('kpi.badge.neutral', 'Monitor');
  }
}

function renderCard(card, metricKey, metricConfig, value, delta, config, variant) {
  const { element, refs } = card;
  const { numberEl, unitEl, badgeEl, hintEl, deltaValueEl, deltaIconEl, assistiveEl, miniFillEl, deltaEl } = refs;
  const tone = typeof value === 'number' ? config.thresholds?.[metricKey]?.(value) : null;
  if (tone) {
    element.dataset.tone = tone;
    badgeEl.textContent = resolveBadge(tone);
  } else {
    delete element.dataset.tone;
    badgeEl.textContent = '';
  }

  const isDisabled = variant === 'life' || typeof value !== 'number' || Number.isNaN(value);
  element.dataset.disabled = isDisabled ? 'true' : 'false';
  element.dataset.state = metricConfig.inverse ? 'inverse' : 'normal';
  element.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');

  if (isDisabled) {
    numberEl.textContent = '—';
    unitEl.textContent = metricConfig.unit || '';
    deltaValueEl.textContent = translate('kpi.delta.naShort', 'N/A');
    deltaIconEl.innerHTML = ICONS.flat;
    if (deltaEl) deltaEl.dataset.direction = 'flat';
    assistiveEl.textContent = translate('kpi.assistive.na', 'Data not available for this range.');
  } else {
    const formatted = typeof metricConfig.format === 'function'
      ? metricConfig.format(value)
      : value.toFixed(metricConfig.decimals ?? 0);
    numberEl.textContent = formatted;
    unitEl.textContent = metricConfig.unit || '';
    const direction = deltaDirection(metricKey, delta, config);
    if (deltaEl) deltaEl.dataset.direction = direction;
    if (direction === 'up') {
      deltaIconEl.innerHTML = ICONS.up;
    } else if (direction === 'down') {
      deltaIconEl.innerHTML = ICONS.down;
    } else {
      deltaIconEl.innerHTML = ICONS.flat;
    }
    deltaValueEl.textContent = formatDeltaValue(delta, metricKey, config);
    assistiveEl.textContent = describeDelta(metricKey, delta, config);
  }

  hintEl.textContent = metricConfig.description || '';

  const fillValue = metricConfig.inverse && typeof value === 'number'
    ? clampPercent(100 - value)
    : clampPercent(value);
  if (isDisabled) {
    miniFillEl.style.width = '0%';
  } else {
    miniFillEl.style.width = `${fillValue}%`;
  }
}

function createCard(metricKey, metricConfig, cardTemplate) {
  const fragment = cardTemplate.content.cloneNode(true);
  const element = fragment.querySelector('.kpi-card');
  element.dataset.metric = metricKey;
  const labelEl = element.querySelector('.kpi-card__label');
  const numberEl = element.querySelector('.kpi-card__number');
  const unitEl = element.querySelector('.kpi-card__unit');
  const badgeEl = element.querySelector('.kpi-card__badge');
  const hintEl = element.querySelector('.kpi-card__hint');
  const deltaValueEl = element.querySelector('.kpi-card__delta-value');
  const deltaIconEl = element.querySelector('.kpi-card__delta-icon');
  const assistiveEl = element.querySelector('.kpi-card__assistive');
  const miniFillEl = element.querySelector('.kpi-card__mini-fill');
  const deltaEl = element.querySelector('.kpi-card__delta');

  const idBase = `kpi-card-${metricKey}-${cardIdCounter += 1}`;
  const labelId = `${idBase}-label`;
  const hintId = `${idBase}-hint`;
  const assistId = `${idBase}-assist`;

  labelEl.id = labelId;
  hintEl.id = hintId;
  assistiveEl.id = assistId;
  element.setAttribute('aria-labelledby', labelId);
  element.setAttribute('aria-describedby', `${hintId} ${assistId}`.trim());

  labelEl.textContent = typeof metricConfig.label === 'function' ? metricConfig.label() : metricConfig.label;
  hintEl.textContent = metricConfig.description || '';
  assistiveEl.textContent = translate('kpi.assistive.na', 'Data not available for this range.');

  return {
    element,
    refs: { numberEl, unitEl, badgeEl, hintEl, deltaValueEl, deltaIconEl, assistiveEl, miniFillEl, deltaEl }
  };
}

function resolveRangeData(data, range, metricKey) {
  return data?.metrics?.[metricKey]?.[range] || {};
}

export async function mountKpiCards(target, data, config = KPI_CONFIG) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) return null;
  const { cardsTemplate, cardTemplate } = await ensureTemplates();
  host.innerHTML = '';
  const wrapperFragment = cardsTemplate.content.cloneNode(true);
  const rangeContainer = wrapperFragment.querySelector('.kpi-cards__ranges');
  const grid = wrapperFragment.querySelector('.kpi-cards__grid');
  const variant = document.body?.dataset?.variant || 'demo';

  const metricKeys = Object.keys(config.metrics);
  const cards = metricKeys.map(metricKey => {
    const metricConfig = config.metrics[metricKey];
    const card = createCard(metricKey, metricConfig, cardTemplate);
    grid.appendChild(card.element);
    return { key: metricKey, config: metricConfig, ...card };
  });

  const state = {
    range: data?.defaultRange || config.defaultRange || config.ranges[0]?.id,
    variant,
    data,
    config,
    cards
  };

  function render() {
    cards.forEach(card => {
      const metricData = resolveRangeData(state.data, state.range, card.key);
      const value = state.variant === 'life' ? undefined : metricData?.value;
      const delta = state.variant === 'life' ? undefined : metricData?.delta;
      renderCard(card, card.key, card.config, value, delta, state.config, state.variant);
    });
    host.dataset.range = state.range;
  }

  if (rangeContainer) {
    rangeContainer.querySelectorAll('[data-range]').forEach(button => {
      button.addEventListener('click', () => {
        const nextRange = button.dataset.range;
        if (!nextRange || nextRange === state.range) return;
        state.range = nextRange;
        setRangeButtonState(rangeContainer, state.range);
        render();
      });
    });
    setRangeButtonState(rangeContainer, state.range);
  }

  render();

  host.classList.add('kpi-cards');
  host.appendChild(wrapperFragment);
  host.dataset.range = state.range;

  return {
    update(newData) {
      state.data = newData;
      render();
    },
    setRange(range) {
      if (config.ranges.some(r => r.id === range)) {
        state.range = range;
        if (rangeContainer) setRangeButtonState(rangeContainer, state.range);
        render();
      }
    }
  };
}
