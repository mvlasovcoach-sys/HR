(function(){
  const root = document.getElementById('wellness-root');
  if (!root) return;

  function highlightFocus() {
    const params = new URLSearchParams(location.search);
    const focus = params.get('focus');
    if (!focus) return;
    const card = root.querySelector(`[data-trend-card="${focus}"]`);
    if (!card) return;
    card.classList.add('is-highlighted');
    card.setAttribute('tabindex', '0');
    card.focus({preventScroll: true});
    card.scrollIntoView({behavior: 'smooth', block: 'center'});
    setTimeout(() => {
      card.classList.remove('is-highlighted');
      card.blur();
    }, 3000);
  }

  highlightFocus();
})();
