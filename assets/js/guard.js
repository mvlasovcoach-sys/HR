(function(global){
  const MIN_N = 5;

  function resolveHost(host){
    if (!host) return null;
    if (typeof host === 'string') {
      try {
        return document.querySelector(host);
      } catch (err) {
        return null;
      }
    }
    return host;
  }

  function guardSmallN(n, host, msg){
    const target = resolveHost(host);
    const count = Number(n);
    if (Number.isFinite(count) && count >= MIN_N) {
      if (target) {
        target.removeAttribute('data-guard');
        target.removeAttribute('data-guard-message');
        const placeholder = target.querySelector('.kGuard');
        if (placeholder) {
          placeholder.remove();
        }
      }
      return false;
    }

    if (!target) return true;

    const message = typeof msg === 'string' && msg.trim()
      ? msg
      : (global.I18N?.t?.('guard.insufficient') || 'Insufficient group size');
    const label = Number.isFinite(count) ? count : '–';
    target.innerHTML = `<div class="kGuard">${message} (n=${label}).</div>`;
    target.setAttribute('data-guard', 'true');
    target.setAttribute('data-guard-message', `${message} (n=${label}).`);
    return true;
  }

  global.guardSmallN = guardSmallN;
  global.Guard = Object.assign(global.Guard || {}, {guardSmallN});
})(window);
