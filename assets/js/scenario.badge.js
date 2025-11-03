(function(){
  const SITE_LABEL = 'AURORA DEEPWATER PLATFORM · 100 STAFF · 24/7';

  function renderScenarioBadge(){
    const el = document.getElementById('scenarioBadge');
    if (!el) return;
    const mode = document.body.dataset.mode === 'live' ? 'live' : 'demo';
    const prefix = mode === 'live' ? 'LIVE' : 'DEMO';
    el.textContent = `${prefix} · ${SITE_LABEL}`;
    el.className = `scenario-badge is-${mode}`;
  }

  window.renderScenarioBadge = renderScenarioBadge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderScenarioBadge, { once: true });
  } else {
    renderScenarioBadge();
  }
})();
