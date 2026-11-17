import { useEffect, useRef } from 'react';
import type { ComparisonLayout } from '@/domain/layout';
import type { DiffSettings, ViewSettings } from '@/domain/types';
import type { ImagePair } from '@/services/images';
import type { DiffState } from '@/state/sessionStore';
import { useViewportStore } from '@/state/viewportStore';
import { resultMatchesLayout } from '../comparison';
import { useStageGestures } from './useStageGestures';
import { DiffView, OverlayView, SideBySideView, SliderView } from './views';

interface StageProps {
  readonly images: ImagePair;
  readonly layout: ComparisonLayout;
  readonly settings: DiffSettings;
  readonly view: ViewSettings;
  readonly diff: DiffState;
  readonly onSliderChange: (position: number) => void;
  readonly onRetryDiff: () => void;
}

/** The interactive comparison surface. Owns gestures; the mode views only draw. */
export function Stage({
  images,
  layout,
  settings,
  view,
  diff,
  onSliderChange,
  onRetryDiff,
}: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useStageGestures(ref);

  const { width, height } = layout.canvas;
  useEffect(() => {
    useViewportStore.getState().setContent({ width, height });
  }, [width, height]);

  const props = { images, layout };

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label="Comparison viewport. Drag or use arrow keys to pan, plus and minus to zoom."
      data-testid="stage"
      className="bg-canvas h-full min-h-0 cursor-grab touch-none overflow-hidden select-none focus-visible:outline-offset-[-2px] data-[panning]:cursor-grabbing"
    >
      {view.mode === 'side-by-side' && <SideBySideView {...props} />}
      {view.mode === 'slider' && (
        <SliderView {...props} position={view.sliderPosition} onPositionChange={onSliderChange} />
      )}
      {view.mode === 'overlay' && <OverlayView {...props} opacity={view.overlayOpacity} />}
      {view.mode === 'diff' && (
        <DiffView
          {...props}
          result={resultMatchesLayout(diff.result, settings) ? diff.result : null}
          error={diff.status === 'error' ? diff.error : null}
          onRetry={onRetryDiff}
        />
      )}
    </div>
  );
}
