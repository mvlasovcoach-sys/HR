// tiny modal manager without deps
const body = document.documentElement;
let lastTrigger = null;
export function openModal(id){
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if(lastTrigger && lastTrigger!==trigger){
    setExpanded(lastTrigger, false);
  }
  closeAllOverlays(false);
  const m = document.getElementById(id);
  if(!m) return;
  lastTrigger = trigger;
  setExpanded(lastTrigger, true);
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
  body.classList.add('u-modal-open');
  m.querySelector('[data-close]')?.focus();
  document.addEventListener('keydown', escClose, { once:true });
}
export function closeModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden', 'true');
  body.classList.remove('u-modal-open');
  restoreTrigger();
}
function escClose(e){ if(e.key==='Escape') closeAllOverlays(); }
export function closeAllOverlays(restore = true){
  document.querySelectorAll('.modal.is-open,.drawer.is-open').forEach(n=>{
    n.classList.remove('is-open');
    if(n.classList.contains('modal')){
      n.setAttribute('aria-hidden', 'true');
    }
  });
  body.classList.remove('u-modal-open');
  if(restore) restoreTrigger();
}
// click on backdrop closes
document.addEventListener('click', (e)=>{
  const m = e.target.closest('.modal');
  if(m && e.target.matches('.modal, .modal__backdrop')) closeAllOverlays();
});
function restoreTrigger(){
  if(!lastTrigger) return;
  setExpanded(lastTrigger, false);
  try{ lastTrigger.focus(); }catch(e){ /* noop */ }
  lastTrigger = null;
}
function setExpanded(node, state){
  if(!node || !node.hasAttribute('aria-haspopup')) return;
  node.setAttribute('aria-expanded', String(state));
}
if(typeof window!=='undefined'){
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.closeAllOverlays = closeAllOverlays;
}
