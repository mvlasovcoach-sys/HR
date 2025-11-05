import { useEffect, useState } from 'react';
import '@/styles/pill.css';

const CLOCK_INTERVAL = 60_000;

export default function CETClock(): JSX.Element {
  const [value, setValue] = useState('');

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const tick = () => setValue(`${formatter.format(new Date())} CET`);
    tick();

    if (typeof window === 'undefined') {
      return undefined;
    }

    const timer = window.setInterval(tick, CLOCK_INTERVAL);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return <div className="pill ml-2">{value}</div>;
}
