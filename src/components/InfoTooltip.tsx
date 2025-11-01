import { useId, useState } from 'react';
import { clsx } from 'clsx';
import '@/styles/tokens.css';

export interface InfoTooltipProps {
  text: string;
  className?: string;
}

export default function InfoTooltip({ text, className }: InfoTooltipProps) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const show = () => setIsOpen(true);
  const hide = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return (
    <div className={clsx('relative inline-flex items-center', className)}>
      <button
        type="button"
        aria-describedby={tooltipId}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent bg-muted text-xs font-semibold text-muted transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={open}
      >
        i
      </button>
      <div
        role="tooltip"
        id={tooltipId}
        className={clsx(
          'pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden={!isOpen}
      >
        {text}
      </div>
    </div>
  );
}
