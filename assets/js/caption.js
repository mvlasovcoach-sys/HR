(function(g){
  function formatDate(d, lang){
    return new Intl.DateTimeFormat(lang || document.documentElement.lang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  }

  function renderCaption(hostSel, model){
    const host = typeof hostSel === 'string' ? document.querySelector(hostSel) : hostSel;
    if (!host) return;
    const asOf = formatDate(model?.asOf || new Date());
    const insight = model?.insight || '';
    host.innerHTML = `<div class="caption"><span class="caption__insight">${insight}</span><span class="caption__asof"> · As of ${asOf}</span></div>`;
  }

  g.Caption = { renderCaption };
})(window);
