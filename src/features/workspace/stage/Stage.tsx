import { useEffect, useRef, type ReactNode } from 'react';
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
  readonly onSliderCommit: (position: number) => void;
  readonly children?: ReactNode;
}

/** The interactive comparison surface. Owns gestures; the mode views only draw. */
export function Stage({
  images,
  layout,
  settings,
  view,
  diff,
  onSliderCommit,
  children,
}: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useStageGestures(ref);

  const { width, height } = layout.canvas;
  useEffect(() => {
    useViewportStore.getState().setContent({ width, height });
  }, [width, height]);

  // A different comparison always opens fitted, even when its canvas is the same size.
  useEffect(() => {
    useViewportStore.getState().reset();
  }, [images]);

  const props = { images, layout };
  const result = resultMatchesLayout(diff.result, settings) ? diff.result : null;

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label="Comparison viewport. Drag or use the arrow keys to pan; plus and minus to zoom."
      data-testid="stage"
      className="bg-stage relative h-full min-h-0 cursor-grab touch-none overflow-hidden select-none focus-visible:outline-offset-[-2px] data-[panning]:cursor-grabbing"
    >
      {view.mode === 'side-by-side' && <SideBySideView {...props} />}
      {view.mode === 'slider' && (
        <SliderView {...props} position={view.sliderPosition} onPositionCommit={onSliderCommit} />
      )}
      {view.mode === 'overlay' && <OverlayView {...props} opacity={view.overlayOpacity} />}
      {view.mode === 'diff' && <DiffView {...props} result={result} context={view.diffContext} />}
      {children}
    </div>
  );
}
