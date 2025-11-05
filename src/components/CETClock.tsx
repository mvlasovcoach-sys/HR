import { useEffect, useState } from 'react';
import '@/styles/pill.css';

const CLOCK_INTERVAL = 60_000;
const TIME_ZONE = 'Europe/Amsterdam';

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function translate(key: string, fallback: string, vars: Record<string, string>): string {
  if (typeof window !== 'undefined') {
    const api = (window as typeof window & { I18N?: { t?: (k: string, params?: Record<string, string>) => string } }).I18N;
    try {
      if (api?.t) {
        const translated = api.t(key, vars);
        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch (err) {
      // ignore translation errors
    }
  }
  return format(fallback, vars);
}

export default function CETClock(): JSX.Element {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const tick = () => {
      const dt = formatter.format(new Date());
      setValue(translate('toolbar.cet', '{dt} CET', { dt }));
    };

    const handleI18n = () => tick();

    tick();
    const timer = window.setInterval(tick, CLOCK_INTERVAL);
    window.addEventListener('i18n:change', handleI18n);
    window.addEventListener('i18n:ready', handleI18n);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('i18n:change', handleI18n);
      window.removeEventListener('i18n:ready', handleI18n);
    };
  }, []);

  return (
    <div className="pill ml-2" aria-live="polite">
      {value}
    </div>
  );
}
