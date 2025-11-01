export const AppState = {
  mode: 'LIVE',
  samples: [],
  setMode(mode) {
    this.mode = mode === 'DEMO' ? 'DEMO' : 'LIVE';
  },
  setSamples(samples) {
    this.samples = Array.isArray(samples) ? samples : [];
  }
};
