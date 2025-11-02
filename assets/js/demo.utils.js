(function(global){
  const root = global || (typeof window !== 'undefined' ? window : {});
  const devWarn = typeof root.devWarn === 'function' ? root.devWarn : () => {};

  function isFiniteNumber(value){
    return typeof value === 'number' && Number.isFinite(value);
  }

  function toNumber(value){
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function normalizeBands(bands){
    if (!Array.isArray(bands)) return [];
    return bands.map((band, index) => {
      if (!band && band !== 0) return null;
      if (typeof band === 'string') {
        return { key: band, label: band, index };
      }
      const normalized = Object.assign({ index }, band);
      if (!normalized.key) {
        normalized.key = normalized.label || String(index);
      }
      if (!normalized.label && normalized.key) {
        normalized.label = normalized.key;
      }
      return normalized;
    }).filter(Boolean);
  }

  function matchesBand(age, band){
    if (!isFiniteNumber(age) || !band) return false;
    const min = isFiniteNumber(band.min) ? band.min : -Infinity;
    const max = isFiniteNumber(band.max) ? band.max : Infinity;
    const exclusiveMax = band.inclusiveMax === false;
    if (age < min) return false;
    if (exclusiveMax) {
      return age < max;
    }
    return age <= max;
  }

  function computeFromArray(items, bands, options){
    const results = bands.map(() => 0);
    const getAge = typeof options?.getAge === 'function'
      ? options.getAge
      : (item) => (item && (Number(item.age) || Number(item.Age)));
    const getBandKey = typeof options?.getBand === 'function'
      ? options.getBand
      : (item) => (item && (item.age_band || item.ageBand || item.band));

    items.forEach(item => {
      let bandKey = getBandKey(item);
      if (bandKey) {
        const idx = bands.findIndex(band => band.key === bandKey);
        if (idx !== -1) {
          results[idx] += 1;
          return;
        }
      }
      const age = toNumber(getAge(item));
      if (!Number.isFinite(age)) return;
      const match = bands.find(band => matchesBand(age, band));
      if (match) {
        results[match.index] += 1;
      }
    });
    return results;
  }

  function computeFromObject(source, bands){
    return bands.map(band => toNumber(source?.[band.key]));
  }

  function computeAgeBands(source, bands, options={}){
    const normalizedBands = normalizeBands(bands);
    if (!normalizedBands.length) return [];

    let totals = [];
    if (Array.isArray(source)) {
      totals = computeFromArray(source, normalizedBands, options);
    } else if (source && typeof source === 'object') {
      totals = computeFromObject(source, normalizedBands);
    } else {
      totals = normalizedBands.map(() => 0);
    }

    return normalizedBands.map((band, index) => ({
      key: band.key,
      labelKey: band.labelKey || null,
      label: band.label,
      count: toNumber(totals[index]),
      min: band.min,
      max: band.max,
      inclusiveMax: band.inclusiveMax
    }));
  }

  function warnMismatch(label, sum, total){
    const totalNumber = toNumber(total);
    const sumNumber = toNumber(sum);
    if (totalNumber === sumNumber) return;
    const message = `[DEMO] ${label}: ${sumNumber} != n=${totalNumber}`;
    devWarn(message);
    if (typeof document === 'undefined') return;
    const host = document.querySelector('[data-note-host="age"]');
    if (!host) return;
    host.querySelectorAll('.note--warn').forEach(node => node.remove());
    const note = document.createElement('div');
    note.className = 'note note--warn';
    note.textContent = `Data mismatch: ${sumNumber} vs n=${totalNumber}`;
    host.appendChild(note);
  }

  const api = {
    warnMismatch,
    computeAgeBands
  };

  if (root) {
    root.DEMO_UTILS = Object.assign({}, root.DEMO_UTILS, api);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
