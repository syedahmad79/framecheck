import { create } from 'zustand';
import { decayVelocity, isSettled, stepSpring, type Spring1D } from '@/domain/motion';
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
/** A flick slower than this (px/s) just stops instead of coasting. */
const MIN_FLING_SPEED = 120;
const STOP_SPEED = 15;
const MAX_FRAME_SECONDS = 0.05;
const DOUBLE_ZOOM_TOLERANCE = 0.02;

function motionAllowed(): boolean {
  return (
    typeof requestAnimationFrame === 'function' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

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
  /** Re-fit immediately, without animation. Used when a different comparison opens. */
  readonly reset: () => void;
  readonly fit: () => void;
  readonly actualSize: () => void;
  readonly zoomStep: (direction: 1 | -1) => void;
  /** Direct manipulation: applies immediately and stops any running motion. */
  readonly zoomAt: (scale: number, focus: Point) => void;
  readonly pan: (dx: number, dy: number) => void;
  /** Double-click behaviour: from the fitted view zoom in at `focus`, otherwise fit. */
  readonly toggleZoom: (focus: Point) => void;
  readonly frame: (rect: Rect) => void;
  /** Stop any animation or coasting at the current on-screen value. */
  readonly halt: () => void;
  /** Continue a released drag at its release velocity (px/s), decelerating. */
  readonly fling: (vx: number, vy: number) => void;
}

export const useViewportStore = create<ViewportState>()((set, get) => {
  let raf = 0;
  let goal: ViewTransform | null = null;

  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    goal = null;
  };

  const constrained = (transform: ViewTransform) =>
    constrainPan(transform, get().content, get().pane);

  const paneCentre = (): Point => ({ x: get().pane.width / 2, y: get().pane.height / 2 });

  /** Animate to `target` from the current on-screen value; any input interrupts it. */
  const glide = (target: ViewTransform) => {
    halt();
    if (!motionAllowed()) {
      set({ transform: target });
      return;
    }
    goal = target;
    const from = get().transform;
    let scale: Spring1D = { value: from.scale, velocity: 0 };
    let x: Spring1D = { value: from.x, velocity: 0 };
    let y: Spring1D = { value: from.y, velocity: 0 };
    let last = performance.now();
    const tick = (now: number) => {
      // A resize can move the goal mid-flight (see `relayout`), so it is read every frame.
      const aim = goal ?? target;
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      scale = stepSpring(scale, aim.scale, dt);
      x = stepSpring(x, aim.x, dt);
      y = stepSpring(y, aim.y, dt);
      if (isSettled(scale, aim.scale, 0.0005) && isSettled(x, aim.x) && isSettled(y, aim.y)) {
        halt();
        set({ transform: aim });
        return;
      }
      set({ transform: { scale: scale.value, x: x.value, y: y.value } });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  /** The same view after a resize: whatever was at the centre of the old pane stays at the centre of the new one. */
  const recentred = (view: ViewTransform, from: Size, to: Size, content: Size): ViewTransform => {
    const centre = toImagePoint(view, { x: from.width / 2, y: from.height / 2 });
    return constrainPan(
      {
        scale: view.scale,
        x: to.width / 2 - centre.x * view.scale,
        y: to.height / 2 - centre.y * view.scale,
      },
      content,
      to,
    );
  };

  const relayout = (pane: Size, content: Size) => {
    const { autoFit, transform, pane: previousPane } = get();
    if (autoFit) {
      halt();
      set({ pane, content, transform: fitTransform(content, pane) });
      return;
    }
    // A running animation keeps going, aimed at the same place in the resized pane.
    if (goal) goal = recentred(goal, previousPane, pane, content);
    set({ pane, content, transform: recentred(transform, previousPane, pane, content) });
  };

  return {
    transform: IDENTITY_TRANSFORM,
    pane: EMPTY,
    content: EMPTY,
    autoFit: true,

    halt,

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

    reset() {
      halt();
      set({ autoFit: true, transform: fitTransform(get().content, get().pane) });
    },

    fit() {
      set({ autoFit: true });
      glide(fitTransform(get().content, get().pane));
    },

    actualSize() {
      set({ autoFit: false });
      glide(centerAtScale(get().content, get().pane, 1));
    },

    zoomStep(direction) {
      const base = goal ?? get().transform;
      set({ autoFit: false });
      glide(constrained(zoomTo(base, nextZoomStep(base.scale, direction), paneCentre())));
    },

    zoomAt(scale, focus) {
      halt();
      set({ autoFit: false, transform: constrained(zoomTo(get().transform, scale, focus)) });
    },

    pan(dx, dy) {
      halt();
      set({ autoFit: false, transform: constrained(panBy(get().transform, dx, dy)) });
    },

    toggleZoom(focus) {
      const { transform, content, pane } = get();
      const fitted = fitTransform(content, pane);
      const atFit = Math.abs(transform.scale - fitted.scale) / fitted.scale < DOUBLE_ZOOM_TOLERANCE;
      if (!atFit) {
        get().fit();
        return;
      }
      set({ autoFit: false });
      glide(constrained(zoomTo(transform, Math.max(1, fitted.scale * 2), focus)));
    },

    frame(rect) {
      set({ autoFit: false });
      glide(frameRect(rect, get().pane));
    },

    fling(vx, vy) {
      halt();
      if (!motionAllowed() || Math.hypot(vx, vy) < MIN_FLING_SPEED) return;
      let velocity = { x: vx, y: vy };
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
        last = now;
        const before = get().transform;
        const next = constrained(panBy(before, velocity.x * dt, velocity.y * dt));
        velocity = { x: decayVelocity(velocity.x, dt), y: decayVelocity(velocity.y, dt) };
        // A boundary absorbs the motion on its axis rather than letting it build up.
        if (next.x === before.x) velocity = { ...velocity, x: 0 };
        if (next.y === before.y) velocity = { ...velocity, y: 0 };
        if (Math.hypot(velocity.x, velocity.y) < STOP_SPEED) {
          halt();
          return;
        }
        set({ transform: next });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
  };
});
