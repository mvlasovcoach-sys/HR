(function(g){
  function fDate(d, lang){
    try {
      return new Intl.DateTimeFormat(
        lang || document.documentElement.lang || 'en',
        {year: 'numeric', month: 'short', day: 'numeric'}
      ).format(d);
    } catch (err) {
      return (d instanceof Date && !isNaN(d)) ? d.toISOString().split('T')[0] : '';
    }
  }

  function escapeHtml(value){
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function render(sel, model){
    const host = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!host) return;
    const lang = g.I18N?.getLang?.() || document.documentElement.lang;
    const asOf = fDate(model?.asOf || new Date(), lang);
    const insight = escapeHtml(model?.insight || '');
    const label = typeof g.I18N?.t === 'function' ? g.I18N.t('asof', 'As of') : 'As of';
    host.innerHTML = `<div class="caption"><span class="caption__insight">${insight}</span><span class="caption__asof"> · ${label} ${asOf}</span></div>`;
  }

  g.Caption = { render };
})(window);
