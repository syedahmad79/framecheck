import { create } from 'zustand';
import type { Point, Rect, Size } from '@/domain/types';
import { sizesEqual } from '@/domain/types';
import {
  centerAtScale,
  constrainPan,
  fitTransform,
  frameRect,
  IDENTITY_TRANSFORM,
  nextZoomStep,
  panBy,
  toImagePoint,
  zoomTo,
  type ViewTransform,
} from '@/domain/viewport';

const EMPTY: Size = { width: 0, height: 0 };

export interface ViewportState {
  /** One transform shared by every pane, which is what keeps the panes synchronised. */
  readonly transform: ViewTransform;
  /** Size of a single image pane in CSS pixels. */
  readonly pane: Size;
  /** Size of the comparison canvas in image pixels. */
  readonly content: Size;
  /** While true the view re-fits whenever the pane or content size changes. */
  readonly autoFit: boolean;

  readonly setPane: (pane: Size) => void;
  readonly setContent: (content: Size) => void;
  readonly fit: () => void;
  readonly actualSize: () => void;
  readonly zoomStep: (direction: 1 | -1) => void;
  readonly zoomAt: (scale: number, focus: Point) => void;
  readonly pan: (dx: number, dy: number) => void;
  readonly frame: (rect: Rect) => void;
}

export const useViewportStore = create<ViewportState>()((set, get) => {
  const constrained = (transform: ViewTransform) =>
    constrainPan(transform, get().content, get().pane);

  const paneCentre = (): Point => ({ x: get().pane.width / 2, y: get().pane.height / 2 });

  const relayout = (pane: Size, content: Size) => {
    const { autoFit, transform, pane: previousPane } = get();
    if (autoFit) {
      set({ pane, content, transform: fitTransform(content, pane) });
      return;
    }
    // Keep the same image point in the centre of the pane across a resize.
    const centre = toImagePoint(transform, {
      x: previousPane.width / 2,
      y: previousPane.height / 2,
    });
    const next = {
      scale: transform.scale,
      x: pane.width / 2 - centre.x * transform.scale,
      y: pane.height / 2 - centre.y * transform.scale,
    };
    set({ pane, content, transform: constrainPan(next, content, pane) });
  };

  return {
    transform: IDENTITY_TRANSFORM,
    pane: EMPTY,
    content: EMPTY,
    autoFit: true,

    setPane(pane) {
      if (sizesEqual(pane, get().pane)) return;
      relayout(pane, get().content);
    },

    setContent(content) {
      if (sizesEqual(content, get().content)) return;
      // New content (another project, or a different mismatch strategy) starts fitted.
      set({ autoFit: true });
      relayout(get().pane, content);
    },

    fit() {
      set({ autoFit: true, transform: fitTransform(get().content, get().pane) });
    },

    actualSize() {
      set({ autoFit: false, transform: centerAtScale(get().content, get().pane, 1) });
    },

    zoomStep(direction) {
      get().zoomAt(nextZoomStep(get().transform.scale, direction), paneCentre());
    },

    zoomAt(scale, focus) {
      set({ autoFit: false, transform: constrained(zoomTo(get().transform, scale, focus)) });
    },

    pan(dx, dy) {
      set({ autoFit: false, transform: constrained(panBy(get().transform, dx, dy)) });
    },

    frame(rect) {
      set({ autoFit: false, transform: frameRect(rect, get().pane) });
    },
  };
});
