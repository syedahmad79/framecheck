import { MASK_COLORS } from '@/domain/diff';
import type { ComparisonLayout } from '@/domain/layout';
import type { DiffSettings, ViewSettings } from '@/domain/types';
import type { DiffState } from '@/state/sessionStore';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { CloseIcon } from '@/ui/icons';
import { Spinner } from '@/ui/Spinner';
import { resultMatchesLayout } from './comparison';

const rgb = (color: readonly [number, number, number]) => `rgb(${color.join(' ')})`;

const CAPTIONS = {
  'side-by-side': 'Both images share one pan and zoom.',
  slider: 'Reference on the left of the divider, implementation on the right.',
  overlay: 'Implementation drawn over the reference. Hold R or I to flick between them.',
  diff: 'Pixels that differ by more than the threshold, over a dimmed reference.',
} as const;

interface CaptionProps {
  readonly view: ViewSettings;
  readonly settings: DiffSettings;
  readonly layout: ComparisonLayout;
  readonly diff: DiffState;
}

/** One line saying what the stage is showing, plus a legend in the differences mode. */
export function ModeCaption({ view, settings, layout, diff }: CaptionProps) {
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;
  return (
    <div className="bg-material text-fg-muted shadow-raised pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-lg px-3 py-2 text-xs backdrop-blur-md">
      <p>{CAPTIONS[view.mode]}</p>
      {view.mode === 'diff' && (
        <ul className="text-fg flex flex-wrap gap-x-3 gap-y-1">
          <Legend color={rgb(MASK_COLORS.diff)} label="Different" />
          {!settings.includeAA && (
            <Legend color={rgb(MASK_COLORS.antialias)} label="Anti-aliasing, ignored" />
          )}
          {layout.mismatched && result && result.stats.outsidePixels > 0 && (
            <Legend color={rgb(MASK_COLORS.outside)} label="Not compared" muted />
          )}
        </ul>
      )}
    </div>
  );
}

function Legend({
  color,
  label,
  muted = false,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cn('size-2.5 rounded-[3px]', muted && 'opacity-50')}
        style={{ background: color }}
      />
      {label}
    </li>
  );
}

/** Loading and failure states for the differences view, which cannot draw without a result. */
export function DiffStatus({
  view,
  settings,
  diff,
  onRetry,
}: {
  view: ViewSettings;
  settings: DiffSettings;
  diff: DiffState;
  onRetry: () => void;
}) {
  if (view.mode !== 'diff') return null;
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;

  if (diff.status === 'error') {
    return (
      <div
        role="alert"
        className="bg-raised shadow-pop absolute top-1/2 left-1/2 flex w-72 max-w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-2 rounded-xl p-4"
      >
        <p className="text-danger font-medium">The comparison failed</p>
        <p className="text-fg-muted text-xs">{diff.error}</p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (result) return null;
  return (
    <p
      role="status"
      className="bg-material text-fg-muted shadow-pop absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-3.5 py-2 backdrop-blur-md"
    >
      <Spinner />
      Comparing pixels…
    </p>
  );
}

export function SampleHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-material text-fg shadow-pop absolute top-3 right-3 flex max-w-xs animate-[fc-rise_var(--dur-slow)_var(--ease-out)] items-start gap-2 rounded-xl p-3 text-xs backdrop-blur-md max-md:hidden">
      <p>
        This sample has deliberate regressions. Press <b>2</b> for the slider, <b>3</b> for the
        overlay, or <b>?</b> for every shortcut.
      </p>
      <Button variant="ghost" size="sm" iconOnly aria-label="Dismiss hint" onClick={onDismiss}>
        <CloseIcon />
      </Button>
    </div>
  );
}
