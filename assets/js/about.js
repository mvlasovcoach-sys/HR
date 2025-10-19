(function(){
  const modal = document.createElement('div');
  modal.className = 'about';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="about__overlay" data-about-close></div>
    <div class="about__sheet" role="document">
      <header class="about__header">
        <h2 class="about__title" data-i18n="about.title">About this platform</h2>
        <button type="button" class="about__close" data-about-close data-i18n="about.close" data-i18n-attr="aria-label" aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <ul class="about__list">
        <li data-i18n="about.bullet1">Aggregates only</li>
        <li data-i18n="about.bullet2">No ML</li>
        <li data-i18n="about.bullet3">EU cloud</li>
        <li data-i18n="about.bullet4">Encryption in transit & at rest</li>
        <li data-i18n="about.bullet5">Wearables last 12+ hours</li>
        <li data-i18n="about.bullet6">Accuracy 2.4–4.7%</li>
      </ul>
    </div>`;
  document.body.appendChild(modal);

  const focusSelectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  let lastFocus = null;

  document.body.addEventListener('click', evt => {
    const trigger = evt.target.closest('[data-about-trigger]');
    if (trigger) {
      evt.preventDefault();
      openModal(trigger);
    }
    if (evt.target.closest('[data-about-close]')) {
      evt.preventDefault();
      closeModal();
    }
  });

  function openModal(trigger){
    lastFocus = trigger;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    const firstFocusable = modal.querySelector(focusSelectors);
    if (firstFocusable) firstFocusable.focus();
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown, true);
  }

  function closeModal(){
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleKeyDown, true);
    if (lastFocus) {
      try { lastFocus.focus(); } catch (e) { /* ignore */ }
      lastFocus = null;
    }
  }

  function handleKeyDown(evt){
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (evt.key === 'Escape') {
      evt.preventDefault();
      closeModal();
      return;
    }
    if (evt.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll(focusSelectors)).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  }
})();
