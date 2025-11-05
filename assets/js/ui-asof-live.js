// Live "As of" under Toolbar: single mount, minute updates, no duplicates
(function(){
  const TZ = 'Europe/Amsterdam';

  function format(now){
    const dd  = new Intl.DateTimeFormat('en-GB',{day:'2-digit', timeZone:TZ}).format(now);
    const mon = new Intl.DateTimeFormat('en-GB',{month:'short', timeZone:TZ}).format(now);
    const yyyy= new Intl.DateTimeFormat('en-GB',{year:'numeric', timeZone:TZ}).format(now);
    const hm  = new Intl.DateTimeFormat('en-GB',{hour:'2-digit', minute:'2-digit', hour12:false, timeZone:TZ}).format(now);
    function lastSunday(y,m){const d=new Date(Date.UTC(y,m+1,0));const w=d.getUTCDay();d.setUTCDate(d.getUTCDate()-w);return d;}
    const y = now.getUTCFullYear();
    const dstStart = new Date(Date.UTC(y,2,lastSunday(y,2).getUTCDate(),1));
    const dstEnd   = new Date(Date.UTC(y,9,lastSunday(y,9).getUTCDate(),1));
    const tzLabel = (now>=dstStart && now<dstEnd) ? 'CEST' : 'CET';
    return { text: `${dd} ${mon} ${yyyy} · ${hm} ${tzLabel}`, iso: now.toISOString() };
  }

  // ВСТАВИТЬ ОДИН РАЗ
  function mountOnce(){
    document.querySelectorAll('[data-toolbar-root]').forEach(tb=>{
      const parent = tb.parentNode;

      // найти существующие строки у этого родителя
      const rows = Array.from(parent.querySelectorAll(':scope > .toolbar-meta-row'));

      if (rows.length === 0){
        const row = document.createElement('div');
        row.className = 'toolbar-meta-row';
        row.innerHTML = `<div class="asof"><span aria-hidden>🗓</span><time data-asof datetime=""></time></div>`;
        parent.insertBefore(row, tb.nextElementSibling);
      } else {
        // дедупликация: оставить первую, остальные удалить
        rows.slice(1).forEach(n=>n.remove());
        // гарантировать положение сразу после тулбара
        if (tb.nextElementSibling !== rows[0]){
          parent.insertBefore(rows[0], tb.nextElementSibling);
        }
      }
    });
    document.documentElement.setAttribute('data-asof-mounted','1');
  }

  // ТОЛЬКО ОБНОВЛЯТЬ — без повторной вставки
  function render(){
    const { text, iso } = format(new Date());
    document.querySelectorAll('time[data-asof]').forEach(el=>{
      el.textContent = text;
      el.setAttribute('datetime', iso);
      el.style.fontFamily = 'var(--font-ui, inherit)'; // унификация шрифта
    });
  }

  function loop(){
    render();
    const now = new Date();
    const next = new Date(now.getTime()+60000); next.setSeconds(0,0);
    setTimeout(loop, next - now); // обновление ровно по минутам
  }

  function start(){
    if (!document.documentElement.hasAttribute('data-asof-mounted')) mountOnce();
    render();
    loop();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
