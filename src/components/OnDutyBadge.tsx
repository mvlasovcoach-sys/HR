import { useEffect, useState } from 'react';
import type { PersonSample } from '@/types/metrics';
import { sampleSize, demoCoverage, coverageFromData } from '@/demo/sample.utils';
import { resolveTeamKey, type TeamKey } from '@/demo/onDuty.utils';
import { FF_DEMO_ONDUTY_BADGE } from '@/config/flags';
import { appStore } from '@/store/appState';
import '@/styles/pill.css';

const TEAM_STORAGE_KEY = 'hr:team';
const UPDATE_INTERVAL_MS = 60_000;

function readStoredTeam(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(TEAM_STORAGE_KEY);
    return value ?? null;
  } catch (err) {
    return null;
  }
}

function formatTemplate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function translate(key: string, fallback: string, vars?: Record<string, string | number>): string {
  if (typeof window !== 'undefined') {
    const api = (window as typeof window & { I18N?: { t?: (k: string, params?: Record<string, string | number>) => string } }).I18N;
    try {
      if (api?.t) {
        const translated = api.t(key, vars);
        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch (err) {
      // ignore translation failures
    }
  }
  return formatTemplate(fallback, vars);
}

function resolveActiveTeam(teamKey?: string | null): TeamKey {
  if (typeof teamKey === 'string' && teamKey.trim()) {
    return resolveTeamKey(teamKey);
  }
  return resolveTeamKey(readStoredTeam());
}

interface OnDutyBadgeProps {
  teamKey?: string | null;
}

export default function OnDutyBadge({ teamKey }: OnDutyBadgeProps) {
  const [text, setText] = useState('—');
  const [samples, setSamples] = useState<readonly PersonSample[] | null>(null);

  useEffect(() => {
    if (!FF_DEMO_ONDUTY_BADGE || typeof window === 'undefined') {
      return;
    }

    const unsubscribe = appStore.subscribe((state) => {
      setSamples(state.samples);
    });

    appStore.setMode('DEMO');
    appStore.loadSamples('DEMO').catch(() => {
      /* optional dataset */
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!FF_DEMO_ONDUTY_BADGE || typeof window === 'undefined') {
      return;
    }

    let isMounted = true;

    const coverageProvider = (team: TeamKey, at: Date) => {
      const ratio = coverageFromData(team, at, samples ?? undefined);
      if (typeof ratio === 'number' && Number.isFinite(ratio)) {
        return ratio;
      }
      return demoCoverage(team, at);
    };

    const update = () => {
      if (!isMounted) {
        return;
      }
      const now = new Date();
      const activeTeam = resolveActiveTeam(teamKey);
      const { expected, sample, coveragePct } = sampleSize(activeTeam, now, coverageProvider);
      const onDutyLabel = translate('toolbar.onDuty', 'On duty: {n}', { n: expected });

      if (expected <= 0) {
        const sampleLabel = translate('toolbar.sampleNA', 'Sample: —');
        setText(`${onDutyLabel} • ${sampleLabel}`);
        return;
      }

      const sampleLabel = translate('toolbar.sample', 'Sample: {n} ({p}%)', {
        n: sample,
        p: coveragePct,
      });
      setText(`${onDutyLabel} • ${sampleLabel}`);
    };

    update();
    const interval = window.setInterval(update, UPDATE_INTERVAL_MS);

    const handleStorage = (event: StorageEvent) => {
      if (event?.key === TEAM_STORAGE_KEY) {
        update();
      }
    };
    const handleI18n = () => update();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('i18n:change', handleI18n);
    window.addEventListener('i18n:ready', handleI18n);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('i18n:change', handleI18n);
      window.removeEventListener('i18n:ready', handleI18n);
    };
  }, [teamKey, samples]);

  if (!FF_DEMO_ONDUTY_BADGE) {
    return null;
  }

  return (
    <div className="pill ml-2" aria-live="polite">
      {text}
    </div>
  );
}
