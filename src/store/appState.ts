import { loadDemoSamples, loadLiveSamples } from '@/services/dataSource';
import type { PersonSample } from '@/types/metrics';

export type DataSourceMode = 'DEMO' | 'LIVE';

export interface AppState {
  mode: DataSourceMode;
  samples: PersonSample[];
  loading: boolean;
  error?: string;
}

type Listener = (state: Readonly<AppState>) => void;

export class AppStore {
  private state: AppState = {
    mode: 'LIVE',
    samples: [],
    loading: false,
    error: undefined,
  };

  private listeners: Set<Listener> = new Set();

  getState(): Readonly<AppState> {
    return this.state;
  }

  setMode(mode: DataSourceMode): void {
    if (this.state.mode === mode) return;
    this.state = { ...this.state, mode };
    this.notify();
  }

  async loadSamples(mode?: DataSourceMode): Promise<PersonSample[]> {
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

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
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
