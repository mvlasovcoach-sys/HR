import type { PersonSample } from '@/types/metrics';

export async function loadDemoSamples(): Promise<PersonSample[]> {
  const res = await fetch('/demo/night-shift.json');
  if (!res.ok) {
    throw new Error(`Failed to load demo dataset (${res.status})`);
  }
  return res.json();
}

export async function loadLiveSamples(): Promise<PersonSample[]> {
  return [];
}
