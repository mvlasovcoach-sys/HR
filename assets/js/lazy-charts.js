(function(g){
  if (!('IntersectionObserver' in g)) {
    document.querySelectorAll('[data-mount]').forEach(node => {
      const mount = node.getAttribute('data-mount');
      if (mount && typeof g[mount] === 'function') {
        g[mount](node);
      }
    });
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = entry.target;
      const mount = target.getAttribute('data-mount');
      if (mount && typeof g[mount] === 'function') {
        try {
          g[mount](target);
        } catch (err) {
          console.error('[lazy-charts] mount failed', mount, err);
        }
      }
      io.unobserve(target);
    });
  }, {rootMargin: '200px'});

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-mount]').forEach(node => io.observe(node));
  });
})(window);
