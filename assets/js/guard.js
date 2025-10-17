(function(global){
  const MIN_N = 5;

  function resolveHost(host){
    if (typeof host === 'string') {
      return document.querySelector(host);
    }
    return host || null;
  }

  function guardSmallN(n, host, message){
    const target = resolveHost(host);
    if (!target) return false;
    const count = Number(n);
    if (Number.isFinite(count) && count >= MIN_N) {
      target.removeAttribute('data-guard');
      target.removeAttribute('data-guard-message');
      const existing = target.querySelector('[data-guard-placeholder]');
      if (existing) existing.remove();
      return false;
    }
    const text = message || (global.I18N?.t?.('guard.insufficient') || 'Insufficient group size');
    target.setAttribute('data-guard', 'true');
    target.setAttribute('data-guard-message', text);
    let overlay = target.querySelector('[data-guard-placeholder]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.setAttribute('data-guard-placeholder', '');
      overlay.className = 'k-guard';
      target.appendChild(overlay);
    }
    overlay.textContent = text;
    return true;
  }

  global.guardSmallN = guardSmallN;
  global.Guard = Object.assign(global.Guard || {}, {guardSmallN});
})(window);
