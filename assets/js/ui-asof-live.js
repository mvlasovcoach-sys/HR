// Live "As of" for all pages, right-aligned under toolbar
(function(){
  const TZ = 'Europe/Amsterdam';

  function fmt(now){
    const dd = new Intl.DateTimeFormat('en-GB',{day:'2-digit', timeZone:TZ}).format(now);
    const mon= new Intl.DateTimeFormat('en-GB',{month:'short', timeZone:TZ}).format(now);
    const yyyy=new Intl.DateTimeFormat('en-GB',{year:'numeric',timeZone:TZ}).format(now);
    const hm = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ}).format(now);
    // CET/CEST метка (строго)
    function lastSunday(y,m){const d=new Date(Date.UTC(y,m+1,0));const w=d.getUTCDay();d.setUTCDate(d.getUTCDate()-w);return d;}
    const y = now.getUTCFullYear();
    const dstStart = new Date(Date.UTC(y,2,lastSunday(y,2).getUTCDate(),1)); // last Sun Mar 01:00 UTC
    const dstEnd   = new Date(Date.UTC(y,9,lastSunday(y,9).getUTCDate(),1)); // last Sun Oct 01:00 UTC
    const tzLabel = (now>=dstStart && now<dstEnd)?'CEST':'CET';
    return {text:`${dd} ${mon} ${yyyy} · ${hm} ${tzLabel}`, iso: now.toISOString()};
  }

  function ensureRow(){
    // Пытаемся найти существующую строку; если нет — вставим под тулбаром
    document.querySelectorAll('[data-toolbar], #toolbar, .toolbar').forEach(tb=>{
      const next = tb.nextElementSibling;
      const already = (next && next.classList && next.classList.contains('toolbar-meta-row'));
      if(!already){
        const row = document.createElement('div');
        row.className = 'toolbar-meta-row';
        row.innerHTML = `<div class="asof"><span aria-hidden>🗓</span><time data-asof datetime=""></time></div>`;
        tb.parentNode.insertBefore(row, tb.nextSibling);
      }
    });
  }

  function render(){
    ensureRow();
    const {text, iso} = fmt(new Date());
    document.querySelectorAll('.toolbar-meta-row time[data-asof]').forEach(el=>{
      el.textContent = text;
      el.setAttribute('datetime', iso);
      // унифицируем шрифт, если где-то переопределён time { font-family: ... }
      el.style.fontFamily = 'var(--font-ui, inherit)';
    });
  }

  function tick(){
    render();
    const now = new Date();
    const next = new Date(now.getTime() + 60000);
    next.setSeconds(0,0);
    setTimeout(tick, next - now); // обновление ровно по минутам
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tick);
  }else{
    tick();
  }
})();
