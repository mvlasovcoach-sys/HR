(function(global){
  if (global.MockStream) return;

  const listeners = new Set();
  const baseHr = 72;
  const baseHrv = 46;
  const start = {
    hr: baseHr,
    rmssd: baseHrv,
    steps: 3200,
    restingHr: 58,
    battery: 0.86,
    connected: true,
    lastSync: Date.now()
  };

  let state = {...start};

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function jitter(value, range) {
    return value + (Math.random() * 2 - 1) * range;
  }

  function emit() {
    const payload = {...state, timestamp: new Date(state.lastSync)};
    listeners.forEach(fn => fn(payload));
  }

  function scheduleNext() {
    const next = 1000 + Math.random() * 4000;
    setTimeout(tick, next);
  }

  function tick() {
    state = {
      ...state,
      hr: clamp(jitter(state.hr, 3), 58, 96),
      rmssd: clamp(jitter(state.rmssd, 4), 20, 70),
      steps: Math.floor((state.steps + Math.random() * 180) % 12000),
      restingHr: clamp(jitter(state.restingHr, 1.2), 54, 64),
      battery: clamp(state.battery - Math.random() * 0.01, 0.12, 1),
      connected: Math.random() > 0.02,
      lastSync: Date.now()
    };
    emit();
    scheduleNext();
  }

  global.MockStream = {
    subscribe(fn) {
      if (typeof fn !== 'function') {
        return () => {};
      }
      listeners.add(fn);
      fn({...state, timestamp: new Date(state.lastSync)});
      return () => listeners.delete(fn);
    },
    getState() {
      return {...state};
    }
  };

  scheduleNext();
})(window);
