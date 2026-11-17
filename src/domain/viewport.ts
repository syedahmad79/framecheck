import { clamp, type Point, type Rect, type Size } from './types';

/** Maps image pixels to pane pixels: `screen = image * scale + (x, y)`. */
export interface ViewTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 32;
export const FIT_PADDING = 24;

const ZOOM_STEPS = [
  0.02, 0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 32,
];

export const IDENTITY_TRANSFORM: ViewTransform = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Centre `content` in `pane` at the given scale. */
export function centerAtScale(content: Size, pane: Size, scale: number): ViewTransform {
  const s = clampScale(scale);
  return {
    scale: s,
    x: (pane.width - content.width * s) / 2,
    y: (pane.height - content.height * s) / 2,
  };
}

/** Largest scale that shows all of `content` inside `pane`. Never upscales past 100%. */
export function fitTransform(content: Size, pane: Size, padding = FIT_PADDING): ViewTransform {
  if (content.width <= 0 || content.height <= 0 || pane.width <= 0 || pane.height <= 0) {
    return IDENTITY_TRANSFORM;
  }
  const availableWidth = Math.max(1, pane.width - padding * 2);
  const availableHeight = Math.max(1, pane.height - padding * 2);
  const scale = Math.min(availableWidth / content.width, availableHeight / content.height, 1);
  return centerAtScale(content, pane, scale);
}

/** Frame a region of the image so it fills the pane, capped at `maxScale`. */
export function frameRect(rect: Rect, pane: Size, padding = FIT_PADDING * 2, maxScale = 8) {
  const availableWidth = Math.max(1, pane.width - padding * 2);
  const availableHeight = Math.max(1, pane.height - padding * 2);
  const scale = clampScale(
    Math.min(
      availableWidth / Math.max(1, rect.width),
      availableHeight / Math.max(1, rect.height),
      maxScale,
    ),
  );
  return {
    scale,
    x: pane.width / 2 - (rect.x + rect.width / 2) * scale,
    y: pane.height / 2 - (rect.y + rect.height / 2) * scale,
  } satisfies ViewTransform;
}

/** Change scale while keeping the image point under `focus` (pane coordinates) stationary. */
export function zoomTo(transform: ViewTransform, scale: number, focus: Point): ViewTransform {
  const next = clampScale(scale);
  const ratio = next / transform.scale;
  return {
    scale: next,
    x: focus.x - (focus.x - transform.x) * ratio,
    y: focus.y - (focus.y - transform.y) * ratio,
  };
}

export function panBy(transform: ViewTransform, dx: number, dy: number): ViewTransform {
  return { scale: transform.scale, x: transform.x + dx, y: transform.y + dy };
}

/** Next stop on the zoom ladder above or below the current scale. */
export function nextZoomStep(scale: number, direction: 1 | -1): number {
  const epsilon = 1e-6;
  if (direction === 1) {
    return ZOOM_STEPS.find((step) => step > scale + epsilon) ?? MAX_SCALE;
  }
  return ZOOM_STEPS.findLast((step) => step < scale - epsilon) ?? MIN_SCALE;
}

/** Convert a pane coordinate to image pixel coordinates. */
export function toImagePoint(transform: ViewTransform, point: Point): Point {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}

/**
 * Keep at least `margin` pane pixels of the content on screen so it can never be lost
 * by panning. Leaves the transform untouched when it is already within bounds.
 */
export function constrainPan(
  transform: ViewTransform,
  content: Size,
  pane: Size,
  margin = 48,
): ViewTransform {
  const width = content.width * transform.scale;
  const height = content.height * transform.scale;
  const mx = Math.min(margin, width);
  const my = Math.min(margin, height);
  const x = clamp(transform.x, mx - width, pane.width - mx);
  const y = clamp(transform.y, my - height, pane.height - my);
  return x === transform.x && y === transform.y ? transform : { scale: transform.scale, x, y };
}
