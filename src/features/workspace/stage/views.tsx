import type { ComparisonLayout } from '@/domain/layout';
import { ROLE_LABEL } from '@/domain/types';
import type { DiffResult } from '@/services/diffProtocol';
import type { ImagePair } from '@/services/images';
import { useViewportStore } from '@/state/viewportStore';
import { Button } from '@/ui/Button';
import { DensityLayer, ImageLayer, MaskLayer } from './layers';
import { PaneFrame, PaneLabel } from './PaneFrame';
import { SliderHandle } from './SliderHandle';
import { TransformedContent } from './TransformedContent';

interface ViewProps {
  readonly images: ImagePair;
  readonly layout: ComparisonLayout;
}

export function SideBySideView({ images, layout }: ViewProps) {
  return (
    <div className="bg-line grid h-full grid-cols-1 grid-rows-2 gap-px sm:grid-cols-2 sm:grid-rows-1">
      <PaneFrame measure className="bg-canvas">
        <TransformedContent size={layout.canvas}>
          <ImageLayer
            image={images.reference}
            placement={layout.reference}
            canvas={layout.canvas}
          />
        </TransformedContent>
        <PaneLabel>{ROLE_LABEL.reference}</PaneLabel>
      </PaneFrame>
      <PaneFrame className="bg-canvas">
        <TransformedContent size={layout.canvas}>
          <ImageLayer
            image={images.implementation}
            placement={layout.implementation}
            canvas={layout.canvas}
          />
        </TransformedContent>
        <PaneLabel>{ROLE_LABEL.implementation}</PaneLabel>
      </PaneFrame>
    </div>
  );
}

interface SliderViewProps extends ViewProps {
  readonly position: number;
  readonly onPositionChange: (position: number) => void;
}

export function SliderView({ images, layout, position, onPositionChange }: SliderViewProps) {
  return (
    <PaneFrame measure className="bg-canvas h-full">
      <TransformedContent size={layout.canvas}>
        <ImageLayer image={images.reference} placement={layout.reference} canvas={layout.canvas} />
      </TransformedContent>
      {/* The divider lives in pane space, so it stays put while the image zooms and pans. */}
      <div
        className="bg-canvas absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${position * 100}%)` }}
      >
        <TransformedContent size={layout.canvas}>
          <ImageLayer
            image={images.implementation}
            placement={layout.implementation}
            canvas={layout.canvas}
          />
        </TransformedContent>
      </div>
      <PaneLabel>{ROLE_LABEL.reference}</PaneLabel>
      <PaneLabel side="right">{ROLE_LABEL.implementation}</PaneLabel>
      <SliderHandle position={position} onChange={onPositionChange} />
    </PaneFrame>
  );
}

export function OverlayView({ images, layout, opacity }: ViewProps & { opacity: number }) {
  return (
    <PaneFrame measure className="bg-canvas h-full">
      <TransformedContent size={layout.canvas}>
        <ImageLayer image={images.reference} placement={layout.reference} canvas={layout.canvas} />
        <ImageLayer
          image={images.implementation}
          placement={layout.implementation}
          canvas={layout.canvas}
          style={{ opacity }}
        />
      </TransformedContent>
      <PaneLabel>
        {ROLE_LABEL.implementation} at {Math.round(opacity * 100)}% over {ROLE_LABEL.reference}
      </PaneLabel>
    </PaneFrame>
  );
}

interface DiffViewProps extends ViewProps {
  /** A result computed for the current layout, or null while none is available. */
  readonly result: DiffResult | null;
  readonly error: string | null;
  readonly onRetry: () => void;
}

export function DiffView({ images, layout, result, error, onRetry }: DiffViewProps) {
  // Zoomed out, single changed pixels vanish; the density layer keeps their area visible.
  const zoomedOut = useViewportStore((state) => state.transform.scale < 1);

  return (
    <PaneFrame measure className="bg-canvas h-full">
      <TransformedContent size={layout.canvas}>
        {/* A flat backdrop: the dimmed reference is context only and must not compete with the mask. */}
        <div className="absolute inset-0 bg-[#0f1113]" />
        <ImageLayer
          image={images.reference}
          placement={layout.reference}
          canvas={layout.canvas}
          style={{ opacity: 0.28, filter: 'grayscale(1)' }}
        />
        {result && zoomedOut && <DensityLayer density={result.density} />}
        {result && <MaskLayer mask={result.mask} canvas={layout.canvas} />}
      </TransformedContent>
      <PaneLabel>Differences over {ROLE_LABEL.reference}</PaneLabel>

      {result && (
        <ul className="bg-surface/85 text-fg-muted ring-line pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded px-2 py-1 text-[11px] ring-1 backdrop-blur-sm">
          <LegendItem color="bg-diff" label="Different" />
          {!result.settings.includeAA && (
            <LegendItem color="bg-aa" label="Anti-aliasing (ignored)" />
          )}
          {layout.mismatched && result.stats.outsidePixels > 0 && (
            <LegendItem color="bg-outside/60" label="Outside overlap (not compared)" />
          )}
        </ul>
      )}

      {!result && !error && (
        <p
          role="status"
          className="bg-surface/90 text-fg-muted ring-line absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 ring-1"
        >
          Comparing pixels…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="bg-surface ring-danger/50 absolute top-1/2 left-1/2 flex w-72 max-w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-2 rounded-md p-3 ring-1"
        >
          <p className="text-danger font-medium">The comparison failed</p>
          <p className="text-fg-muted text-xs">{error}</p>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}
    </PaneFrame>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2 rounded-[2px] ${color}`} />
      {label}
    </li>
  );
}
