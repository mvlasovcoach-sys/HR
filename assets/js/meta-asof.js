(function(){
  if (typeof document === 'undefined') return;

  const label = '05 Nov 2025 · 20:25 CET';
  const iso = '2025-11-05T20:25:00+01:00';

  const nodes = document.querySelectorAll('#meta-asof-time');
  if (!nodes.length) return;

  nodes.forEach(node => {
    node.textContent = label;
    node.setAttribute('datetime', iso);
  });
})();
