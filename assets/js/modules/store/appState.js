import { loadDemoSamples, loadLiveSamples } from '../services/dataSource.js';

export class AppStore {
  constructor() {
    this.state = {
      mode: 'LIVE',
      samples: [],
      loading: false,
      error: undefined
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setMode(mode) {
    if (this.state.mode === mode) return;
    this.state = { ...this.state, mode };
    this.notify();
  }

  async loadSamples(mode) {
    const nextMode = mode ?? this.state.mode;
    if (this.state.mode !== nextMode) {
      this.state = { ...this.state, mode: nextMode };
    }
    this.state = { ...this.state, loading: true, error: undefined };
    this.notify();
    try {
      const samples = nextMode === 'DEMO' ? await loadDemoSamples() : await loadLiveSamples();
      this.state = { ...this.state, samples, loading: false };
      this.notify();
      return samples;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.state = { ...this.state, loading: false, error: message };
      this.notify();
      throw err;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[AppStore] listener failed', err);
      }
    });
  }
}

export const appStore = new AppStore();
