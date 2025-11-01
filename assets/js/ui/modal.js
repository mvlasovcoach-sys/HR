// tiny modal manager without deps
const html = document.documentElement;
const FOCUSABLE_SELECTOR = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,details,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
const supportsInert = 'inert' in HTMLElement.prototype;

let lastTrigger = null;
let activeModal = null;
let activePanel = null;
let keyListener = null;
let inertTargets = [];
const inertCache = new Map();
let previousBodyOverflow = null;

export function openModal(id){
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if(lastTrigger && lastTrigger!==trigger){
    setExpanded(lastTrigger, false);
  }
  closeAllOverlays(false);
  const modal = document.getElementById(id);
  if(!modal) return;
  const panel = getPanel(modal);
  if(!panel) return;

  lastTrigger = trigger;
  setExpanded(lastTrigger, true);

  ensurePanelFocusable(panel);
  modal.classList.add('is-open');
  modal.removeAttribute('aria-hidden');
  html.classList.add('u-modal-open');

  activeModal = modal;
  activePanel = panel;

  applyInert(modal);
  lockBodyScroll();
  attachKeyHandler();

  if(typeof queueMicrotask === 'function'){
    queueMicrotask(()=>panel.focus());
  }else{
    setTimeout(()=>panel.focus(), 0);
  }
}

export function closeModal(id){
  const modal = document.getElementById(id);
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  if(activeModal === modal){
    releaseModalState();
  }

  if(!document.querySelector('.modal.is-open')){
    html.classList.remove('u-modal-open');
  }

  restoreTrigger();
}

export function closeAllOverlays(restore = true){
  document.querySelectorAll('.modal.is-open,.drawer.is-open').forEach(node=>{
    node.classList.remove('is-open');
    if(node.classList.contains('modal')){
      node.setAttribute('aria-hidden', 'true');
    }
  });
  html.classList.remove('u-modal-open');
  releaseModalState();
  if(restore) restoreTrigger();
}

// click on backdrop closes
document.addEventListener('click', (e)=>{
  const modal = e.target.closest('.modal');
  if(modal && e.target.matches('.modal, .modal__backdrop')) closeAllOverlays();
});

function handleKeydown(event){
  if(!activeModal) return;

  if(event.key === 'Escape'){
    event.preventDefault();
    closeAllOverlays();
    return;
  }

  if(event.key !== 'Tab') return;

  const focusable = getFocusable(activeModal);
  if(focusable.length === 0){
    event.preventDefault();
    activePanel?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;

  if(event.shiftKey){
    if(current === first || !activeModal.contains(current)){
      event.preventDefault();
      last.focus();
    }
  }else{
    if(current === last){
      event.preventDefault();
      first.focus();
    }
  }
}

function getPanel(modal){
  return modal.querySelector('.modal__panel');
}

function ensurePanelFocusable(panel){
  if(!panel.hasAttribute('tabindex')){
    panel.setAttribute('tabindex', '-1');
  }
}

function getFocusable(modal){
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

function applyInert(modal){
  clearInert();
  const parent = modal.parentElement;
  if(!parent) return;
  inertTargets = Array.from(parent.children).filter(node => node !== modal);
  inertTargets.forEach(node => setInertState(node, true));
}

function clearInert(){
  inertTargets.forEach(node => setInertState(node, false));
  inertTargets = [];
}

function setInertState(node, enable){
  if(enable){
    if(inertCache.has(node)) return;
    inertCache.set(node, {
      ariaHidden: node.getAttribute('aria-hidden'),
      inertAttr: node.hasAttribute('inert'),
      inertValue: supportsInert ? node.inert : null
    });
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('inert', '');
    if(supportsInert){
      node.inert = true;
    }
  }else{
    const prev = inertCache.get(node);
    if(!prev) return;
    if(prev.ariaHidden === null){
      node.removeAttribute('aria-hidden');
    }else{
      node.setAttribute('aria-hidden', prev.ariaHidden);
    }
    if(prev.inertAttr){
      node.setAttribute('inert', '');
    }else{
      node.removeAttribute('inert');
    }
    if(supportsInert){
      node.inert = typeof prev.inertValue === 'boolean' ? prev.inertValue : false;
    }
    inertCache.delete(node);
  }
}

function lockBodyScroll(){
  const body = document.body;
  if(!body || previousBodyOverflow !== null) return;
  previousBodyOverflow = body.style.overflow;
  body.style.overflow = 'hidden';
}

function unlockBodyScroll(){
  const body = document.body;
  if(!body) return;
  if(previousBodyOverflow !== null){
    body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
}

function attachKeyHandler(){
  detachKeyHandler();
  keyListener = handleKeydown;
  document.addEventListener('keydown', keyListener);
}

function detachKeyHandler(){
  if(!keyListener) return;
  document.removeEventListener('keydown', keyListener);
  keyListener = null;
}

function releaseModalState(){
  detachKeyHandler();
  clearInert();
  unlockBodyScroll();
  activeModal = null;
  activePanel = null;
}

function restoreTrigger(){
  if(!lastTrigger) return;
  setExpanded(lastTrigger, false);
  try{ lastTrigger.focus(); }catch(e){ /* noop */ }
  lastTrigger = null;
}

function setExpanded(node, state){
  if(!node || !node.hasAttribute('aria-haspopup')) return;
  node.setAttribute('aria-expanded', String(Boolean(state)));
}

if(typeof window!=='undefined'){
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.closeAllOverlays = closeAllOverlays;
}
