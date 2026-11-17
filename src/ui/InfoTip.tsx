import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { InfoIcon } from './icons';

/**
 * A small "what is this?" button. The explanation shows on hover and focus, and toggles on tap
 * for touch screens. It is linked with aria-describedby and hidden from the accessibility tree
 * otherwise, so it does not become part of the name of the term it sits beside.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned]);

  return (
    <span ref={rootRef} className="group/info relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={pinned}
        onClick={() => setPinned((value) => !value)}
        className="motion-colors text-fg-subtle hover:text-fg inline-flex size-4 items-center justify-center rounded-full"
      >
        <InfoIcon width={14} height={14} />
      </button>
      <span
        id={id}
        aria-hidden="true"
        className={cn(
          'bg-raised text-fg-muted shadow-pop motion-colors pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 w-56 -translate-x-1/2 rounded-lg p-2.5 text-xs font-normal',
          pinned
            ? 'opacity-100'
            : 'opacity-0 group-hover/info:opacity-100 group-has-[:focus-visible]/info:opacity-100',
        )}
      >
        {children}
      </span>
    </span>
  );
}
