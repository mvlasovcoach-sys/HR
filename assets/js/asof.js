(function(){
  const TZ = 'Europe/Amsterdam';

  function lastSunday(y, m){
    const d = new Date(Date.UTC(y, m + 1, 0));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d;
  }

  function render() {
    const now = new Date();
    const dd  = new Intl.DateTimeFormat('en-GB',{ day:'2-digit',  timeZone:TZ }).format(now);
    const mon = new Intl.DateTimeFormat('en-GB',{ month:'short', timeZone:TZ }).format(now);
    const yy  = new Intl.DateTimeFormat('en-GB',{ year:'numeric', timeZone:TZ }).format(now);
    const hm  = new Intl.DateTimeFormat('en-GB',{ hour:'2-digit', minute:'2-digit', hour12:false, timeZone:TZ }).format(now);

    const y = now.getUTCFullYear();
    const dstS = new Date(Date.UTC(y,2,lastSunday(y,2).getUTCDate(),1));
    const dstE = new Date(Date.UTC(y,9,lastSunday(y,9).getUTCDate(),1));
    const tzLabel = (now >= dstS && now < dstE) ? 'CEST' : 'CET';

    const text = `${dd} ${mon} ${yy} · ${hm} ${tzLabel}`;
    const iso  = now.toISOString();

    document.querySelectorAll('time[data-asof]').forEach(el=>{
      el.textContent = text;
      el.setAttribute('datetime', iso);
      el.style.fontFamily = 'inherit';
    });
  }

  function loop(){
    render();
    const now = new Date();
    const next = new Date(now.getTime() + 60000);
    next.setSeconds(0,0);
    setTimeout(loop, next - now);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loop);
  } else {
    loop();
  }
})();
