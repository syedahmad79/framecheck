import { useId, type ReactNode } from 'react';
import {
  formatBytes,
  formatCount,
  formatDimensions,
  formatPercent,
  isLargeImage,
} from '@/domain/files';
import type { ComparisonLayout } from '@/domain/layout';
import {
  ANCHORS,
  IMAGE_ROLES,
  ROLE_LABEL,
  type Anchor,
  type DiffSettings,
  type ImageRole,
  type MismatchStrategy,
  type Rect,
} from '@/domain/types';
import type { ImagePair } from '@/services/images';
import type { DiffState } from '@/state/sessionStore';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { AlertIcon, CloseIcon, TargetIcon } from '@/ui/icons';
import { InfoTip } from '@/ui/InfoTip';
import { RangeField } from '@/ui/RangeField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Spinner } from '@/ui/Spinner';
import { Switch } from '@/ui/Switch';
import { resultIsCurrent, resultMatchesLayout } from '../workspace/comparison';

interface InspectorProps {
  readonly open: boolean;
  readonly images: ImagePair;
  readonly layout: ComparisonLayout;
  readonly settings: DiffSettings;
  readonly diff: DiffState;
  readonly onSettingsChange: (patch: Partial<DiffSettings>) => void;
  readonly onZoomToChanges: (bounds: Rect) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

export function Inspector(props: InspectorProps) {
  const { open, onClose } = props;
  return (
    <aside
      id="inspector"
      aria-label="Inspector"
      inert={!open}
      className={cn(
        'bg-chrome',
        // Wide screens: a column that slides closed. Narrow screens: a sheet over the stage.
        'lg:border-line lg:shrink-0 lg:overflow-hidden lg:border-l lg:transition-[width] lg:duration-(--dur-slow) lg:ease-(--ease-out)',
        open ? 'lg:w-80' : 'lg:w-0 lg:border-l-0',
        'max-lg:shadow-dialog max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[75%] max-lg:rounded-t-2xl max-lg:transition-transform max-lg:duration-(--dur-slow) max-lg:ease-(--ease-out)',
        open ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full',
      )}
    >
      <div className="flex h-full flex-col lg:w-80">
        <div className="flex items-center justify-between px-4 pt-3 pb-1 lg:hidden">
          <h2 className="text-sm font-semibold">Details</h2>
          <Button variant="ghost" iconOnly size="sm" aria-label="Close details" onClick={onClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className="divide-line min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
          <ResultSection {...props} />
          <SensitivitySection {...props} />
          <AlignmentSection {...props} />
          <ImagesSection {...props} />
          <NotesSection {...props} />
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 p-4">
      <h2 id={id} className="eyebrow">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  swatch,
  info,
}: {
  label: string;
  value: ReactNode;
  swatch?: string;
  info?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted flex items-center gap-1.5">
        {swatch && (
          <span className={cn('size-2 shrink-0 rounded-[3px]', swatch)} aria-hidden="true" />
        )}
        {label}
        {info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
      </dt>
      <dd className="tabular text-fg text-right">{value}</dd>
    </div>
  );
}

function describeSettings(settings: DiffSettings): string {
  const aa = settings.includeAA ? 'counting anti-aliasing' : 'ignoring anti-aliasing';
  return `Threshold ${settings.threshold.toFixed(2)}, ${aa}`;
}

function ResultSection({ settings, diff, onZoomToChanges, onRetry }: InspectorProps) {
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;

  if (diff.status === 'error') {
    return (
      <Section title="Result">
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-danger flex items-start gap-1.5">
            <AlertIcon className="mt-0.5" />
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
        <p role="status" className="text-fg-muted flex items-center gap-2">
          <Spinner />
          Comparing pixels…
        </p>
      </Section>
    );
  }

  const { stats } = result;
  const current = resultIsCurrent(result, settings) && diff.status !== 'computing';
  const identical = stats.diffPixels === 0;
  const share = (count: number) =>
    stats.comparedPixels === 0 ? 0 : (count / stats.comparedPixels) * 100;

  return (
    <Section title="Result">
      <div aria-live="polite" aria-busy={!current} className="flex flex-col gap-1">
        <p className="flex items-baseline gap-2">
          <span
            data-testid="diff-percent"
            className={cn(
              'tabular font-display text-display font-semibold',
              !current ? 'text-fg-subtle' : identical ? 'text-ok' : 'text-fg',
            )}
          >
            {formatPercent(stats.diffRatio)}
          </span>
          <span className="text-fg-muted">{identical ? 'identical' : 'different'}</span>
          {!current && (
            <span className="text-fg-subtle ml-auto flex items-center gap-1.5 text-xs">
              <Spinner size={12} /> Updating…
            </span>
          )}
        </p>
        <p className={cn('text-xs', current ? 'text-fg-muted' : 'text-fg-subtle')}>
          {identical
            ? `No compared pixel differs by more than the threshold (${result.settings.threshold.toFixed(2)}).`
            : `${formatCount(stats.diffPixels)} of ${formatCount(stats.comparedPixels)} compared pixels differ.`}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="bg-line-strong flex h-1.5 overflow-hidden rounded-full"
        title="Share of compared pixels that differ (pink) or were ignored as anti-aliasing (teal)"
      >
        <span
          className="bg-diff"
          style={{ width: `${share(stats.diffPixels)}%`, minWidth: stats.diffPixels > 0 ? 3 : 0 }}
        />
        <span
          className="bg-aa"
          style={{
            width: `${share(stats.antialiasedPixels)}%`,
            minWidth: stats.antialiasedPixels > 0 ? 3 : 0,
          }}
        />
      </div>

      <dl className={cn('flex flex-col gap-1.5', !current && 'opacity-60')}>
        <Row
          label="Different"
          swatch="bg-diff"
          value={formatCount(stats.diffPixels)}
          info="Pixels whose colour distance from the other image is larger than the threshold. Anti-aliased pixels are not included unless you choose to count them."
        />
        <Row
          label="Ignored"
          swatch="bg-aa"
          value={
            result.settings.includeAA
              ? 'counted as different'
              : formatCount(stats.antialiasedPixels)
          }
          info="Pixels over the threshold that look like edge smoothing. Renderers smooth edges differently, so they are left out of the total."
        />
        <Row
          label="Compared"
          value={formatCount(stats.comparedPixels)}
          info="Pixels covered by both images. The percentage is the different pixels divided by this number."
        />
        {stats.outsidePixels > 0 && (
          <Row
            label="Not compared"
            swatch="bg-outside"
            value={formatCount(stats.outsidePixels)}
            info="Canvas area covered by only one image because the sizes differ. It is never counted as different."
          />
        )}
        <Row
          label="Changed region"
          value={
            stats.bounds
              ? `${formatDimensions(stats.bounds)} at ${stats.bounds.x}, ${stats.bounds.y}`
              : 'none'
          }
          info="The smallest rectangle containing every different pixel, with its top-left corner in canvas pixels."
        />
      </dl>

      <p className="text-fg-subtle text-xs">
        {describeSettings(result.settings)}. Compared in{' '}
        {result.compareMs < 10 ? result.compareMs.toFixed(1) : Math.round(result.compareMs)} ms.
      </p>

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

function SensitivitySection({ settings, onSettingsChange }: InspectorProps) {
  return (
    <Section title="Sensitivity">
      <RangeField
        label="Threshold"
        value={settings.threshold}
        min={0}
        max={1}
        step={0.01}
        ends={['Strict', 'Lenient']}
        format={(value) => value.toFixed(2)}
        onChange={(threshold) => onSettingsChange({ threshold })}
        description="How far apart two colours must be before a pixel counts as different. 0 flags every change; 0.10 is Pixelmatch's default."
      />
      <Switch
        label="Count anti-aliased pixels"
        description="Off by default: edge smoothing differs between renderers and is rarely a real change."
        checked={settings.includeAA}
        onChange={(includeAA) => onSettingsChange({ includeAA })}
      />
    </Section>
  );
}

const STRATEGY_OPTIONS = [
  { value: 'pad', label: 'Pad' },
  { value: 'crop', label: 'Crop' },
] as const satisfies readonly { value: MismatchStrategy; label: string }[];

const STRATEGY_HELP: Record<MismatchStrategy, string> = {
  pad: 'The canvas grows to hold both images. Areas only one image covers are tinted and left out of the comparison.',
  crop: 'Only the area both images cover is shown and compared. The rest is discarded.',
};

const ANCHOR_LABEL: Record<Anchor, string> = {
  'top-left': 'Top left',
  'top-center': 'Top centre',
  center: 'Centre',
};
const ANCHOR_OPTIONS = ANCHORS.map((value) => ({ value, label: ANCHOR_LABEL[value] }));

const signed = (value: number) =>
  value > 0 ? `+${value}` : value === 0 ? '0' : `−${Math.abs(value)}`;

function AlignmentSection({ images, layout, settings, onSettingsChange }: InspectorProps) {
  const { reference, implementation } = images;
  return (
    <Section title="Alignment">
      {layout.mismatched ? (
        <div data-testid="mismatch-notice" className="flex flex-col gap-3">
          <p className="text-fg flex items-start gap-2">
            <AlertIcon className="text-warn mt-0.5" />
            <span>
              The sizes differ: the implementation is{' '}
              <span className="tabular">
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
            className="w-full"
          />
          <p className="text-fg-muted text-xs">{STRATEGY_HELP[settings.strategy]}</p>
          <div className="flex flex-col gap-1.5">
            <span className="text-fg-muted text-xs">Align from</span>
            <SegmentedControl
              label="Align from"
              options={ANCHOR_OPTIONS}
              value={settings.anchor}
              onChange={(anchor) => onSettingsChange({ anchor })}
              size="sm"
              className="w-full"
            />
          </div>
          <p className="tabular text-fg-subtle text-xs">
            Canvas {formatDimensions(layout.canvas)} px
          </p>
        </div>
      ) : (
        <p className="text-fg-muted">
          Both images are {formatDimensions(reference)} px, so there is nothing to align.
        </p>
      )}
    </Section>
  );
}

const ROLE_DOT: Record<ImageRole, string> = { reference: 'bg-ref', implementation: 'bg-impl' };

function ImagesSection({ images }: InspectorProps) {
  return (
    <Section title="Images">
      <dl className="flex flex-col gap-3">
        {IMAGE_ROLES.map((role) => {
          const image = images[role];
          return (
            <div key={role} className="flex flex-col gap-0.5">
              <dt className="text-fg-muted flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', ROLE_DOT[role])} aria-hidden="true" />
                {ROLE_LABEL[role]}
              </dt>
              <dd className="min-w-0">
                <p className="truncate font-medium" title={image.name}>
                  {image.name}
                </p>
                <p className="tabular text-fg-muted text-xs">
                  {formatDimensions(image)} px · {formatBytes(image.bytes)} ·{' '}
                  {image.type.replace('image/', '').toUpperCase()}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function NotesSection({ images, diff, settings }: InspectorProps) {
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;
  const translucent = result?.stats.translucentPixels ?? 0;
  const large = IMAGE_ROLES.some((role) => isLargeImage(images[role]));

  return (
    <section aria-label="Notes" className="flex flex-col gap-3 p-4">
      {translucent > 0 && (
        <p className="text-fg-muted flex items-start gap-2 text-xs">
          <AlertIcon className="text-warn mt-0.5" />
          <span>
            {formatCount(translucent)} compared pixels are partly transparent. They are compared as
            if composited over white, so transparent and white pixels count as equal.
          </span>
        </p>
      )}
      {large && (
        <p className="text-fg-muted text-xs">
          These are large images. A comparison can take a moment and uses several hundred megabytes
          of memory.
        </p>
      )}
      <details className="group">
        <summary className="text-fg-muted hover:text-fg cursor-pointer rounded-sm text-xs font-medium">
          What this does and does not measure
        </summary>
        <ul className="text-fg-muted mt-2.5 flex list-disc flex-col gap-2 pl-4 text-xs">
          <li>
            Pixels are compared one to one by position. A one-pixel layout shift marks everything
            after it as different, so a high percentage can have one small cause.
          </li>
          <li>
            The percentage is a share of compared pixels. It says how much changed, not how
            noticeable or important the change is.
          </li>
          <li>
            Anti-aliasing detection is a heuristic. Thin lines and small text can be misclassified
            in either direction.
          </li>
          <li>
            Screenshots at different device pixel ratios, or JPEGs at different qualities, differ
            almost everywhere. Compare like with like.
          </li>
          <li>
            Colours are compared after the browser decodes each file. Colour profiles and JPEG
            decoding can differ slightly between browsers.
          </li>
        </ul>
      </details>
    </section>
  );
}
