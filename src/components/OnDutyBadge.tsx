import { useEffect, useState } from 'react';
import { resolveTeamKey, type TeamKey } from '@/demo/onDuty.utils';
import { sampleSize, demoCoverage } from '@/demo/sample.utils';
import { FF_DEMO_ONDUTY_BADGE } from '@/config/flags';
import '@/styles/pill.css';

const STORAGE_KEY = 'hr:team';

function readStoredTeam(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ?? null;
  } catch (err) {
    return null;
  }
}

function resolveActiveTeam(teamKey?: string | null): TeamKey {
  if (typeof teamKey === 'string' && teamKey.trim()) {
    return resolveTeamKey(teamKey);
  }
  return resolveTeamKey(readStoredTeam());
}

export default function OnDutyBadge({ teamKey }: { teamKey?: string | null }) {
  if (!FF_DEMO_ONDUTY_BADGE) {
    return null;
  }

  const [text, setText] = useState('—');

  useEffect(() => {
    if (!FF_DEMO_ONDUTY_BADGE) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    let isMounted = true;

    const update = () => {
      if (!isMounted) return;
      const now = new Date();
      const team = resolveActiveTeam(teamKey);
      const { expected, sample, coveragePct } = sampleSize(team, now, demoCoverage);
      setText(`On duty: ${expected} • Sample: ${sample} (${coveragePct}%)`);
    };

    update();
    const interval = window.setInterval(update, 60_000);

    const handleStorage = (event: StorageEvent) => {
      if (event?.key === STORAGE_KEY) {
        update();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [teamKey]);

  return <div className="pill ml-2">{text}</div>;
}
