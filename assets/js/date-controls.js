(function(){
  const el = document.getElementById('date-controls');
  if (!el) return;

  const presets = ['day', '7d', 'month', 'year'];
  const wrapper = document.createElement('div');
  wrapper.className = 'dc';
  el.appendChild(wrapper);

  const buttons = presets.map(preset => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.preset = preset;
    btn.textContent = window.t(`range.${preset}`);
    wrapper.appendChild(btn);
    btn.addEventListener('click', () => setRange(preset));
    return btn;
  });

  const sep = document.createElement('span');
  sep.className = 'dc__sep';
  wrapper.appendChild(sep);

  const start = document.createElement('input');
  start.type = 'date';
  start.id = 'dc-start';
  start.setAttribute('aria-label', window.t('range.start'));
  wrapper.appendChild(start);

  const end = document.createElement('input');
  end.type = 'date';
  end.id = 'dc-end';
  end.setAttribute('aria-label', window.t('range.end'));
  wrapper.appendChild(end);

  [start, end].forEach(input => {
    input.addEventListener('change', () => {
      if (start.value && end.value) {
        setRange({start: start.value, end: end.value});
      }
    });
  });

  window.addEventListener('storage', evt => {
    if (!evt || evt.key !== 'hr:range') return;
    restoreSelection();
  });

  document.addEventListener('i18n:change', () => {
    buttons.forEach(btn => {
      btn.textContent = window.t(`range.${btn.dataset.preset}`);
    });
    start.setAttribute('aria-label', window.t('range.start'));
    end.setAttribute('aria-label', window.t('range.end'));
  });

  function setRange(value){
    if (typeof value === 'string') {
      localStorage.setItem('hr:range', JSON.stringify({preset: value}));
      start.value = '';
      end.value = '';
    } else {
      localStorage.setItem('hr:range', JSON.stringify(value));
      start.value = value.start || '';
      end.value = value.end || '';
    }
    dispatchEvent(new StorageEvent('storage', {key: 'hr:range'}));
    updateActiveButton();
  }

  function updateActiveButton(){
    let preset = null;
    try {
      const raw = localStorage.getItem('hr:range');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.preset) preset = parsed.preset;
      }
    } catch (e) {
      preset = null;
    }
    buttons.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.preset === preset);
    });
  }

  function restoreSelection(){
    const raw = localStorage.getItem('hr:range');
    if (!raw) {
      updateActiveButton();
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.preset) {
        start.value = '';
        end.value = '';
      } else if (parsed && parsed.start && parsed.end) {
        start.value = parsed.start;
        end.value = parsed.end;
      }
    } catch (e) {
      // ignore malformed values
    }
    updateActiveButton();
  }

  restoreSelection();

  if (!localStorage.getItem('hr:range')) {
    setRange('7d');
  } else {
    updateActiveButton();
  }
})();
