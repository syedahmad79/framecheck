import { useId, type ReactNode } from 'react';
import { formatCount, formatDimensions, formatPercent, isLargeImage } from '@/domain/files';
import type { ComparisonLayout } from '@/domain/layout';
import {
  ANCHORS,
  IMAGE_ROLES,
  ROLE_LABEL,
  type Anchor,
  type DiffSettings,
  type MismatchStrategy,
  type Rect,
} from '@/domain/types';
import type { ImagePair } from '@/services/images';
import type { DiffState } from '@/state/sessionStore';
import { Button } from '@/ui/Button';
import { AlertIcon, TargetIcon } from '@/ui/icons';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { resultIsCurrent, resultMatchesLayout } from '../workspace/comparison';

interface StatsPanelProps {
  readonly images: ImagePair;
  readonly layout: ComparisonLayout;
  readonly settings: DiffSettings;
  readonly diff: DiffState;
  readonly onSettingsChange: (patch: Partial<DiffSettings>) => void;
  readonly onZoomToChanges: (bounds: Rect) => void;
  readonly onRetry: () => void;
}

export function StatsPanel(props: StatsPanelProps) {
  return (
    <aside
      aria-label="Comparison details"
      className="divide-line border-line bg-surface flex shrink-0 flex-col divide-y border-t lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      <ResultSection {...props} />
      <DimensionsSection {...props} />
      <SensitivitySection {...props} />
      <LimitationsSection />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 p-4">
      <h2 id={id} className="text-fg-subtle text-[11px] font-semibold tracking-wider uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatRow({ label, value, swatch }: { label: string; value: ReactNode; swatch?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-fg-muted flex items-center gap-1.5">
        {swatch && <span className={`size-2 rounded-[2px] ${swatch}`} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="tabular text-fg text-right text-xs">{value}</dd>
    </div>
  );
}

function ResultSection({ settings, diff, onZoomToChanges, onRetry }: StatsPanelProps) {
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;
  const updating =
    diff.status === 'computing' || (result !== null && !resultIsCurrent(result, settings));

  if (diff.status === 'error') {
    return (
      <Section title="Result">
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-danger flex items-start gap-1.5">
            <AlertIcon className="mt-0.5 shrink-0" />
            <span>{diff.error}</span>
          </p>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </Section>
    );
  }

  if (!result) {
    return (
      <Section title="Result">
        <p role="status" className="text-fg-muted">
          Comparing pixels…
        </p>
      </Section>
    );
  }

  const { stats } = result;
  const identical = stats.diffPixels === 0;

  return (
    <Section title="Result">
      <div aria-live="polite" aria-busy={updating} className="flex flex-col gap-1">
        <p className="flex items-baseline gap-2">
          <span
            data-testid="diff-percent"
            className={`tabular text-2xl font-semibold tracking-tight ${identical ? 'text-ok' : 'text-fg'}`}
          >
            {formatPercent(stats.diffRatio)}
          </span>
          <span className="text-fg-muted">different</span>
          {updating && <span className="text-fg-subtle ml-auto text-xs">Updating…</span>}
        </p>
        <p className="text-fg-muted text-xs">
          {identical
            ? `No pixel differs by more than the threshold (${result.settings.threshold.toFixed(2)}).`
            : `${formatCount(stats.diffPixels)} of ${formatCount(stats.comparedPixels)} compared pixels differ.`}
        </p>
      </div>

      <dl className="flex flex-col gap-1.5">
        <StatRow label="Different" swatch="bg-diff" value={formatCount(stats.diffPixels)} />
        <StatRow
          label="Anti-aliasing, ignored"
          swatch="bg-aa"
          value={result.settings.includeAA ? 'counted' : formatCount(stats.antialiasedPixels)}
        />
        {stats.outsidePixels > 0 && (
          <StatRow
            label="Outside overlap"
            swatch="bg-outside/60"
            value={formatCount(stats.outsidePixels)}
          />
        )}
        <StatRow label="Compared" value={formatCount(stats.comparedPixels)} />
        <StatRow
          label="Changed region"
          value={
            stats.bounds
              ? `${stats.bounds.width} × ${stats.bounds.height} at ${stats.bounds.x}, ${stats.bounds.y}`
              : 'none'
          }
        />
        <StatRow
          label="Compare time"
          value={`${result.compareMs < 10 ? result.compareMs.toFixed(1) : Math.round(result.compareMs)} ms`}
        />
      </dl>

      {stats.bounds && (
        <Button
          className="self-start"
          onClick={() => {
            if (stats.bounds) onZoomToChanges(stats.bounds);
          }}
        >
          <TargetIcon />
          Zoom to changes
        </Button>
      )}
    </Section>
  );
}

const STRATEGY_OPTIONS = [
  { value: 'pad', label: 'Pad' },
  { value: 'crop', label: 'Crop' },
] as const satisfies readonly { value: MismatchStrategy; label: string }[];

const STRATEGY_HELP: Record<MismatchStrategy, string> = {
  pad: 'The canvas grows to fit both images. Areas covered by only one image are tinted and left out of the comparison.',
  crop: 'Only the area both images cover is shown and compared. The rest is discarded.',
};

const ANCHOR_LABEL: Record<Anchor, string> = {
  'top-left': 'Top left',
  'top-center': 'Top centre',
  center: 'Centre',
};

const signed = (value: number) =>
  value > 0 ? `+${value}` : value === 0 ? '0' : `−${Math.abs(value)}`;

function DimensionsSection({ images, layout, settings, onSettingsChange }: StatsPanelProps) {
  const anchorId = useId();
  const { reference, implementation } = images;
  const large = IMAGE_ROLES.some((role) => isLargeImage(images[role]));

  return (
    <Section title="Dimensions">
      <dl className="flex flex-col gap-1.5">
        {IMAGE_ROLES.map((role) => (
          <StatRow
            key={role}
            label={ROLE_LABEL[role]}
            value={`${formatDimensions(images[role])} px`}
          />
        ))}
        {layout.mismatched && (
          <StatRow label="Comparison canvas" value={`${formatDimensions(layout.canvas)} px`} />
        )}
      </dl>

      {layout.mismatched && (
        <div
          role="group"
          aria-label="Size mismatch handling"
          data-testid="mismatch-notice"
          className="border-aa/40 bg-aa/5 flex flex-col gap-2.5 rounded-md border p-3"
        >
          <p className="text-fg flex items-start gap-1.5">
            <AlertIcon className="text-aa mt-0.5 shrink-0" />
            <span>
              Sizes differ. The implementation is{' '}
              <span className="tabular text-xs">
                {signed(implementation.width - reference.width)} ×{' '}
                {signed(implementation.height - reference.height)} px
              </span>{' '}
              relative to the reference. Images are never rescaled.
            </span>
          </p>
          <SegmentedControl
            label="Mismatch strategy"
            options={STRATEGY_OPTIONS}
            value={settings.strategy}
            onChange={(strategy) => onSettingsChange({ strategy })}
          />
          <p className="text-fg-muted text-xs">{STRATEGY_HELP[settings.strategy]}</p>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={anchorId} className="text-fg-muted">
              Align from
            </label>
            <select
              id={anchorId}
              value={settings.anchor}
              onChange={(event) => onSettingsChange({ anchor: event.target.value as Anchor })}
              className="border-line-strong bg-raised h-7 rounded-md border px-1.5 text-[13px]"
            >
              {ANCHORS.map((anchor) => (
                <option key={anchor} value={anchor}>
                  {ANCHOR_LABEL[anchor]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {large && (
        <p className="text-fg-muted text-xs">
          These are large images. Each comparison can take a moment and uses several hundred
          megabytes of memory.
        </p>
      )}
    </Section>
  );
}

function SensitivitySection({ settings, onSettingsChange }: StatsPanelProps) {
  const thresholdId = useId();
  const helpId = useId();
  return (
    <Section title="Sensitivity">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={thresholdId}>Threshold</label>
          <output htmlFor={thresholdId} className="tabular text-xs">
            {settings.threshold.toFixed(2)}
          </output>
        </div>
        <input
          id={thresholdId}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.threshold}
          aria-describedby={helpId}
          onChange={(event) => onSettingsChange({ threshold: Number(event.target.value) })}
        />
        <p id={helpId} className="text-fg-muted text-xs">
          How far apart two colours must be before a pixel counts as different. 0 flags every
          change; 0.10 is the Pixelmatch default; higher values ignore subtle shifts.
        </p>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={settings.includeAA}
          onChange={(event) => onSettingsChange({ includeAA: event.target.checked })}
          className="accent-accent mt-0.5"
        />
        <span>
          Count anti-aliased pixels
          <span className="text-fg-muted block text-xs">
            Off by default: edge smoothing differs between renderers and is rarely a real change.
          </span>
        </span>
      </label>
    </Section>
  );
}

function LimitationsSection() {
  return (
    <section className="p-4">
      <details className="group">
        <summary className="text-fg-subtle hover:text-fg-muted cursor-pointer rounded-sm text-[11px] font-semibold tracking-wider uppercase">
          What this does and does not measure
        </summary>
        <ul className="text-fg-muted mt-3 flex list-disc flex-col gap-2 pl-4 text-xs">
          <li>
            Pixels are compared one to one by position. A layout shift of a single pixel marks
            everything after it as different, so a high percentage can come from one small cause.
          </li>
          <li>
            The percentage is a share of compared pixels. It says how much of the image changed, not
            how noticeable or important the change is.
          </li>
          <li>
            Anti-aliasing detection is a heuristic. Thin lines and small text can be misclassified
            in either direction.
          </li>
          <li>
            Screenshots taken at different device pixel ratios, or JPEGs saved at different
            qualities, will differ almost everywhere. Compare like with like.
          </li>
          <li>
            Colours are compared after the browser decodes the file. Embedded colour profiles and
            JPEG decoding can vary slightly between browsers.
          </li>
        </ul>
      </details>
    </section>
  );
}
