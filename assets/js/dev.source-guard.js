(function(){
  if (typeof document === 'undefined') return;
  const host = location.hostname || '';
  const path = location.pathname || '';
  if (!host.includes('localhost') && !/\/Demo/i.test(path)) return;
  const panels = document.querySelectorAll('.panel[data-stats="true"], .card.panel[data-stats="true"]');
  panels.forEach(panel => {
    if (panel.hasAttribute('data-source-id')) return;
    console.warn('[SOURCE] Missing data-source-id on stats panel:', panel);
    panel.insertAdjacentHTML('beforeend', '<div class="note note--warn">Missing source</div>');
  });
})();
