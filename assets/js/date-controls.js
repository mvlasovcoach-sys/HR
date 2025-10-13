(function(){
  const el = document.getElementById('date-controls');
  if(!el) return;
  el.innerHTML = `
    <div class="dc">
      <button data-preset="day">Day</button>
      <button data-preset="7d" class="is-active">7 Days</button>
      <button data-preset="month">Month</button>
      <button data-preset="year">Year</button>
      <span class="dc__sep"></span>
      <input type="date" id="dc-start" aria-label="Start date">
      <input type="date" id="dc-end" aria-label="End date">
    </div>`;
  const btns = el.querySelectorAll('button[data-preset]');
  const start = el.querySelector('#dc-start');
  const end = el.querySelector('#dc-end');

  function setRange(v){
    if (typeof v === 'string') {
      localStorage.setItem('hr:range', JSON.stringify({preset:v}));
      start.value = '';
      end.value = '';
    } else {
      localStorage.setItem('hr:range', JSON.stringify(v));
      start.value = v.start || '';
      end.value = v.end || '';
    }
    dispatchEvent(new StorageEvent('storage', {key:'hr:range'}));
    btns.forEach(b=>b.classList.toggle('is-active', b.dataset.preset === (v.preset||v)));
  }

  btns.forEach(b=> b.addEventListener('click', ()=> setRange(b.dataset.preset)));
  [start,end].forEach(inp=> inp.addEventListener('change', ()=>{
    if (start.value && end.value) setRange({start:start.value, end:end.value});
  }));

  // restore existing selection
  const existing = localStorage.getItem('hr:range');
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && parsed.preset) {
        btns.forEach(b=> b.classList.toggle('is-active', b.dataset.preset === parsed.preset));
      } else if (parsed && parsed.start && parsed.end) {
        start.value = parsed.start;
        end.value = parsed.end;
        btns.forEach(b=> b.classList.remove('is-active'));
      }
    } catch(e) {
      // ignore malformed
    }
  }

  // default
  if (!localStorage.getItem('hr:range')) setRange('7d');
})();
