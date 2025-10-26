(function(){
  const FOCUS_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), [tabindex]:not([tabindex="-1"])';
  let activePopover = null;
  let activeTrigger = null;
  let restoreFocus = null;

  function getTemplate(id){
    if (!id) return null;
    const tpl = document.getElementById(`help-${id}`);
    if (!tpl) return null;
    return tpl.content ? tpl.content.cloneNode(true) : null;
  }

  function positionPopover(popover, anchor){
    const rect = anchor.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const spacing = 8;
    let top = rect.bottom + window.scrollY + spacing;
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + window.innerWidth - popRect.width - spacing;
    if (left > maxLeft) {
      left = Math.max(window.scrollX + spacing, maxLeft);
    }
    const maxTop = window.scrollY + window.innerHeight - popRect.height - spacing;
    if (top > maxTop) {
      top = Math.max(window.scrollY + spacing, rect.top + window.scrollY - popRect.height - spacing);
    }
    popover.style.top = `${Math.max(window.scrollY + spacing, top)}px`;
    popover.style.left = `${Math.max(window.scrollX + spacing, left)}px`;
  }

  function getFocusable(popover){
    if (!popover) return [];
    return Array.from(popover.querySelectorAll(FOCUS_SELECTOR))
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
  }

  function focusFirst(popover){
    const focusable = getFocusable(popover);
    if (focusable.length) {
      focusable[0].focus({preventScroll: true});
      return;
    }
    popover.setAttribute('tabindex', '-1');
    popover.focus({preventScroll: true});
  }

  function openPopover(id, trigger){
    const fragment = getTemplate(id);
    if (!fragment) return;
    closePopover();

    const popover = document.createElement('div');
    popover.className = 'help-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.dataset.helpId = id;
    popover.appendChild(fragment);

    document.body.appendChild(popover);
    positionPopover(popover, trigger);
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activePopover = popover;
    activeTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    focusFirst(popover);
  }

  function closePopover(){
    if (!activePopover) return;
    if (activePopover.parentNode) {
      activePopover.parentNode.removeChild(activePopover);
    }
    if (activeTrigger) {
      activeTrigger.setAttribute('aria-expanded', 'false');
    }
    if (restoreFocus && typeof restoreFocus.focus === 'function') {
      restoreFocus.focus({preventScroll: true});
    } else if (activeTrigger && typeof activeTrigger.focus === 'function') {
      activeTrigger.focus({preventScroll: true});
    }
    activePopover = null;
    activeTrigger = null;
    restoreFocus = null;
  }

  function handleDocumentClick(event){
    const trigger = event.target.closest('.info-dot[data-help]');
    if (trigger) {
      event.preventDefault();
      if (activeTrigger === trigger) {
        closePopover();
      } else {
        openPopover(trigger.dataset.help, trigger);
      }
      return;
    }
    if (!activePopover) return;
    if (event.target.closest('[data-help-close]')) {
      event.preventDefault();
      closePopover();
      return;
    }
    if (!event.target.closest('.help-popover')) {
      closePopover();
    }
  }

  function handleKeydown(event){
    if (!activePopover) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopover();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(activePopover);
    if (!focusable.length) {
      event.preventDefault();
      activePopover.focus({preventScroll: true});
      return;
    }
    const currentIndex = focusable.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.shiftKey) {
      nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
    }
    event.preventDefault();
    focusable[nextIndex].focus({preventScroll: true});
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('blur', () => {
    if (document.hidden) closePopover();
  });
})();
