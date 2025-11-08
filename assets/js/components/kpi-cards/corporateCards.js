import { resolveBand, KPI_THRESHOLDS } from '../../config/kpiThresholds.js';

const TEMPLATE_URL = new URL('../../../../components/kpi-cards/kpi-cards.html', import.meta.url);
let templatePromise = null;

const METRIC_CONFIG = [
  {
    key: 'wellbeing',
    labelKey: 'kpi.wellbeing',
    fallback: 'Wellbeing',
    description: 'Composite wellbeing score (higher is better)',
    unit: '/100',
    polarity: 'higher'
  },
  {
    key: 'stress',
    labelKey: 'kpi.stress',
    fallback: 'Stress average',
    description: 'Average stress index (lower is better)',
    unit: '/100',
    polarity: 'lower'
  },
  {
    key: 'burnout',
    labelKey: 'kpi.burnoutRisk',
    fallback: 'Burnout risk',
    description: 'Share of users flagged for burnout risk',
    unit: '%',
    polarity: 'lower'
  },
  {
    key: 'fatigue',
    labelKey: 'kpi.elevatedFatigue',
    fallback: 'Elevated fatigue',
    description: 'Share of users with elevated fatigue',
    unit: '%',
    polarity: 'lower'
  }
];

function t(key, fallback){
  if (!key) return fallback;
  const translated = window.I18N?.t?.(key, fallback);
  if (translated && translated !== key) return translated;
  return fallback;
}

function ensureTemplates(){
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load KPI templates');
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
        return { cardsTemplate, cardTemplate };
      });
  }
  return templatePromise;
}

function formatValue(value, unit){
  if (!Number.isFinite(value)) {
    return { number: '—', unit: unit === '/100' ? '/100' : unit === '%' ? '%' : '' };
  }
  if (unit === '/100') {
    return { number: String(Math.round(value)), unit: '/100' };
  }
  if (unit === '%') {
    const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
    return { number: formatted, unit: '%' };
  }
  return { number: String(value), unit: unit || '' };
}

function describeDelta(delta, unit, polarity){
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return t('kpi.delta.noChange', 'No change');
  }
  const absolute = Math.abs(delta);
  const direction = delta > 0 ? 'up' : 'down';
  const goodWhenUp = polarity !== 'lower';
  const isGood = direction === 'up' ? goodWhenUp : !goodWhenUp;
  const unitText = unit === '/100' ? '/100' : unit === '%' ? '%' : '';
  const base = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  const key = isGood ? 'kpi.delta.improved' : 'kpi.delta.degraded';
  const fallback = isGood ? 'Improved' : 'Declined';
  return `${t(key, fallback)} ${base}${unitText}`.trim();
}

function deltaDisplay(delta){
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) return null;
  const rounded = Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(1);
  return `${delta > 0 ? '+' : ''}${rounded}`;
}

function resolveFill(metricKey, value, polarity){
  if (!Number.isFinite(value)) return 0;
  if (polarity === 'lower') {
    return Math.max(0, Math.min(100, 100 - value));
  }
  return Math.max(0, Math.min(100, value));
}

function createOverlay(host, onRetry){
  const container = document.createElement('div');
  container.className = 'kpi-cards__overlay';
  container.setAttribute('role', 'alert');
  container.hidden = true;

  const message = document.createElement('p');
  message.className = 'kpi-cards__overlay-message';
  container.appendChild(message);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kpi-cards__overlay-action';
  button.textContent = t('actions.retry', 'Retry');
  button.addEventListener('click', () => {
    container.hidden = true;
    onRetry?.();
  });
  container.appendChild(button);

  host.appendChild(container);

  return {
    node: container,
    message,
    button,
    show(text){
      message.textContent = text || t('actions.retry', 'Retry');
      container.hidden = false;
    },
    hide(){
      container.hidden = true;
    },
    setOnRetry(fn){
      onRetry = fn;
    }
  };
}

function createCard(cardTemplate, metric){
  const fragment = cardTemplate.content.cloneNode(true);
  const element = fragment.querySelector('.kpi-card');
  element.dataset.metric = metric.key;
  const labelEl = element.querySelector('.kpi-card__label');
  const hintEl = element.querySelector('.kpi-card__hint');
  const numberEl = element.querySelector('.kpi-card__number');
  const unitEl = element.querySelector('.kpi-card__unit');
  const deltaEl = element.querySelector('.kpi-card__delta');
  const deltaIconEl = element.querySelector('.kpi-card__delta-icon');
  const deltaValueEl = element.querySelector('.kpi-card__delta-value');
  const assistiveEl = element.querySelector('.kpi-card__assistive');
  const miniFillEl = element.querySelector('.kpi-card__mini-fill');
  const badgeEl = element.querySelector('.kpi-card__badge');

  labelEl.textContent = t(metric.labelKey, metric.fallback);
  hintEl.textContent = metric.description || '';
  assistiveEl.textContent = t('kpi.assistive.na', 'Data not available for this range.');

  return {
    element,
    refs: {
      numberEl,
      unitEl,
      deltaEl,
      deltaIconEl,
      deltaValueEl,
      assistiveEl,
      miniFillEl,
      badgeEl
    }
  };
}

function renderCard(card, metric, value, delta, options){
  const { element, refs } = card;
  const isLoading = Boolean(options.isLoading);
  const isInsufficient = Boolean(options.isInsufficient);
  const mode = options.mode || 'demo';
  const thresholds = options.thresholds || KPI_THRESHOLDS;

  element.classList.toggle('is-loading', isLoading);
  element.dataset.disabled = 'false';

  if (isLoading) {
    refs.numberEl.textContent = '—';
    refs.unitEl.textContent = metric.unit === '/100' ? '/100' : metric.unit === '%' ? '%' : '';
    if (refs.deltaEl) {
      refs.deltaEl.hidden = true;
    }
    refs.deltaIconEl.textContent = '';
    refs.deltaValueEl.textContent = '';
    refs.assistiveEl.textContent = t('kpi.assistive.loading', 'Loading KPI value…');
    if (refs.miniFillEl) refs.miniFillEl.style.width = '0%';
    element.dataset.tone = 'neutral';
    if (refs.badgeEl) refs.badgeEl.textContent = '';
    return;
  }

  if (isInsufficient) {
    refs.numberEl.textContent = 'N/A';
    refs.unitEl.textContent = '';
    if (refs.deltaEl) {
      refs.deltaEl.hidden = true;
    }
    refs.deltaIconEl.textContent = '';
    refs.deltaValueEl.textContent = '';
    if (mode === 'live') {
      refs.assistiveEl.textContent = t('kpi.assistive.liveNA', 'No live data');
      element.dataset.disabled = 'true';
    } else {
      refs.assistiveEl.textContent = t('kpi.assistive.na', 'Data not available for this range.');
      element.dataset.disabled = 'false';
    }
    if (refs.miniFillEl) refs.miniFillEl.style.width = '0%';
    element.dataset.tone = 'neutral';
    if (refs.badgeEl) refs.badgeEl.textContent = '';
    return;
  }

  if (refs.deltaEl) {
    refs.deltaEl.hidden = false;
  }

  const band = resolveBand(metric.key, value, thresholds);
  element.dataset.tone = band;

  const formatted = formatValue(value, metric.unit);
  refs.numberEl.textContent = formatted.number;
  refs.unitEl.textContent = formatted.unit;

  const deltaLabel = deltaDisplay(delta);
  if (deltaLabel && Number.isFinite(delta)) {
    const direction = delta > 0 ? 'up' : 'down';
    if (refs.deltaEl) refs.deltaEl.dataset.direction = direction;
    refs.deltaValueEl.textContent = `${deltaLabel}${formatted.unit}`;
    refs.deltaIconEl.textContent = direction === 'up' ? '▲' : '▼';
    refs.assistiveEl.textContent = describeDelta(delta, metric.unit, metric.polarity);
  } else {
    if (refs.deltaEl) refs.deltaEl.dataset.direction = 'flat';
    refs.deltaValueEl.textContent = t('kpi.delta.noChange', 'No change');
    refs.deltaIconEl.textContent = '';
    refs.assistiveEl.textContent = t('kpi.delta.noChange', 'No change');
  }

  if (refs.miniFillEl) {
    const fill = resolveFill(metric.key, value, metric.polarity);
    refs.miniFillEl.style.width = `${fill}%`;
  }

  if (refs.badgeEl) {
    switch (band) {
      case 'green':
        refs.badgeEl.textContent = t('kpi.badge.positive', 'On track');
        break;
      case 'red':
        refs.badgeEl.textContent = t('kpi.badge.negative', 'Critical');
        break;
      case 'amber':
        refs.badgeEl.textContent = t('kpi.badge.neutral', 'Monitor');
        break;
      default:
        refs.badgeEl.textContent = '';
        break;
    }
  }
}

export async function mountCorporateKpiCards(target, options = {}){
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new Error('mountCorporateKpiCards: target not found');
  const { cardsTemplate, cardTemplate } = await ensureTemplates();
  host.innerHTML = '';

  const shellFragment = cardsTemplate.content.cloneNode(true);
  const grid = shellFragment.querySelector('.kpi-cards__grid');
  const noticeEl = shellFragment.querySelector('.kpi-cards__notice');
  const cards = new Map();

  METRIC_CONFIG.forEach(metric => {
    const card = createCard(cardTemplate, metric);
    cards.set(metric.key, { ...card, config: metric });
    grid.appendChild(card.element);
  });

  host.classList.add('kpi-cards');
  host.appendChild(shellFragment);

  const overlay = createOverlay(host, options.onRetry);

  let lastData = null;
  let isLoading = false;

  function updateNotice(text){
    if (!noticeEl) return;
    if (text) {
      noticeEl.textContent = text;
      noticeEl.hidden = false;
    } else {
      noticeEl.textContent = '';
      noticeEl.hidden = true;
    }
  }

  function render(){
    const mode = (lastData?.mode || 'demo').toLowerCase();
    const deltas = lastData?.deltas || {};
    cards.forEach(({ config, ...card }) => {
      const rawValue = lastData?.[config.key];
      const value = Number.isFinite(rawValue) ? rawValue : null;
      const delta = Number.isFinite(deltas[config.key]) ? deltas[config.key] : null;
      renderCard(card, config, value, delta, {
        mode,
        isLoading,
        isInsufficient: Boolean(lastData?.isInsufficient),
        thresholds: options.thresholds || KPI_THRESHOLDS
      });
    });
  }

  render();

  return {
    setLoading(value){
      isLoading = Boolean(value);
      host.classList.toggle('is-loading', isLoading);
      if (isLoading) {
        overlay.hide();
      }
      render();
    },
    update(data){
      lastData = data || null;
      isLoading = false;
      host.classList.remove('is-loading');
      overlay.hide();
      render();
    },
    showError(message){
      isLoading = false;
      host.classList.remove('is-loading');
      updateNotice(null);
      overlay.show(message || t('actions.retry', 'Retry'));
    },
    setOnRetry(fn){
      overlay.setOnRetry(fn);
    },
    setNotice(text){
      updateNotice(text);
      return text;
    }
  };
}
