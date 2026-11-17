import type { ReactNode } from 'react';
import { cn } from './cn';
import { Kbd } from './Kbd';

interface TooltipProps {
  readonly label: string;
  readonly shortcut?: string;
  readonly align?: 'center' | 'start' | 'end';
  readonly children: ReactNode;
}

/**
 * A visual label for a control that already has an accessible name. It is hidden from assistive
 * technology so the name is not announced twice, and it appears on hover (after a short delay,
 * so passing over a toolbar is quiet) and on keyboard focus.
 */
export function Tooltip({ label, shortcut, align = 'center', children }: TooltipProps) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'bg-fg text-bg shadow-pop motion-colors pointer-events-none absolute top-full z-50 mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap opacity-0',
          'group-hover/tip:opacity-100 group-hover/tip:delay-500 group-has-[:focus-visible]/tip:opacity-100 pointer-coarse:hidden',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
        )}
      >
        {label}
        {shortcut && <Kbd className="bg-bg/20 text-bg shadow-none">{shortcut}</Kbd>}
      </span>
    </span>
  );
}
