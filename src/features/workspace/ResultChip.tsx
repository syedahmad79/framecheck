import { formatPercent } from '@/domain/files';
import type { DiffSettings } from '@/domain/types';
import type { DiffState } from '@/state/sessionStore';
import { cn } from '@/ui/cn';
import { Spinner } from '@/ui/Spinner';
import { resultIsCurrent, resultMatchesLayout } from './comparison';

/** The headline number, always visible in the toolbar; it opens the inspector for the detail. */
export function ResultChip({
  diff,
  settings,
  expanded,
  onClick,
}: {
  diff: DiffState;
  settings: DiffSettings;
  expanded: boolean;
  onClick: () => void;
}) {
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;
  const current = resultIsCurrent(result, settings) && diff.status !== 'computing';

  let body;
  if (diff.status === 'error') {
    body = <span className="text-danger">Comparison failed</span>;
  } else if (!result) {
    body = (
      <>
        <Spinner />
        <span className="text-fg-muted">Comparing…</span>
      </>
    );
  } else {
    const identical = result.stats.diffPixels === 0;
    body = (
      <>
        {!current && <Spinner />}
        <span
          data-testid="result-chip-value"
          className={cn(
            'tabular font-semibold',
            current ? (identical ? 'text-ok' : 'text-fg') : 'text-fg-subtle',
          )}
        >
          {formatPercent(result.stats.diffRatio)}
        </span>
        <span className="text-fg-muted">{identical ? 'identical' : 'different'}</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Show details"
      aria-expanded={expanded}
      aria-controls="inspector"
      className="motion-colors hover:bg-hover inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm pointer-coarse:min-h-10"
    >
      {body}
    </button>
  );
}
