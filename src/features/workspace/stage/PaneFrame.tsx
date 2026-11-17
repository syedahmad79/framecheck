import { useEffect, useRef, type ReactNode } from 'react';
import { useViewportStore } from '@/state/viewportStore';
import { cn } from '@/ui/cn';

interface PaneFrameProps {
  readonly children: ReactNode;
  /** Report this pane's size to the viewport. Exactly one pane per view should measure. */
  readonly measure?: boolean;
  readonly className?: string;
}

/** A clipped viewport onto the comparison canvas. All panes in a view have the same size. */
export function PaneFrame({ children, measure = false, className }: PaneFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!measure || !element) return;
    const report = () =>
      useViewportStore
        .getState()
        .setPane({ width: element.clientWidth, height: element.clientHeight });
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={ref} data-pane className={cn('relative min-h-0 min-w-0 overflow-hidden', className)}>
      {children}
    </div>
  );
}

export function PaneLabel({
  children,
  side = 'left',
}: {
  children: ReactNode;
  side?: 'left' | 'right';
}) {
  return (
    <span
      className={cn(
        'bg-surface/85 text-fg-muted ring-line pointer-events-none absolute top-2 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 backdrop-blur-sm',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      {children}
    </span>
  );
}
