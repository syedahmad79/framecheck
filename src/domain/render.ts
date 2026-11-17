import { clamp, type Point, type Rect, type Size } from './types';
import type { ViewTransform } from './viewport';

/** A source rectangle and the pane rectangle (CSS pixels) it is drawn into. */
export interface DrawRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly dx: number;
  readonly dy: number;
  readonly dw: number;
  readonly dh: number;
}

/**
 * Work out how to draw the visible part of `content` into a pane.
 *
 * `content` is where the pixels sit on the comparison canvas and `source` is the source-image
 * pixel at its top-left. Only whole source pixels are drawn, so the destination is always
 * exactly `scale` times the source and an image is never resampled at an unintended ratio.
 * Returns null when nothing is visible.
 */
export function projectToPane(
  content: Rect,
  source: Point,
  transform: ViewTransform,
  pane: Size,
): DrawRect | null {
  const { scale } = transform;
  const left = clamp(Math.floor(-transform.x / scale), content.x, content.x + content.width);
  const top = clamp(Math.floor(-transform.y / scale), content.y, content.y + content.height);
  const right = clamp(
    Math.ceil((pane.width - transform.x) / scale),
    content.x,
    content.x + content.width,
  );
  const bottom = clamp(
    Math.ceil((pane.height - transform.y) / scale),
    content.y,
    content.y + content.height,
  );
  if (right <= left || bottom <= top) return null;

  return {
    sx: source.x + (left - content.x),
    sy: source.y + (top - content.y),
    sw: right - left,
    sh: bottom - top,
    dx: transform.x + left * scale,
    dy: transform.y + top * scale,
    dw: (right - left) * scale,
    dh: (bottom - top) * scale,
  };
}

/** Pane-space rectangle for a canvas-space rectangle. */
export function rectToPane(rect: Rect, transform: ViewTransform): Rect {
  return {
    x: transform.x + rect.x * transform.scale,
    y: transform.y + rect.y * transform.scale,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  };
}

/** Canvas-space pixel under a pane-space point, or null when the point is off the canvas. */
export function pixelAt(transform: ViewTransform, point: Point, canvas: Size): Point | null {
  const x = Math.floor((point.x - transform.x) / transform.scale);
  const y = Math.floor((point.y - transform.y) / transform.scale);
  return x < 0 || y < 0 || x >= canvas.width || y >= canvas.height ? null : { x, y };
}

/** Position of a pointer along a pane as a fraction 0..1, after removing the grab offset. */
export function fractionAlong(
  clientX: number,
  paneLeft: number,
  paneWidth: number,
  grab = 0,
): number {
  if (paneWidth <= 0) return 0;
  return clamp((clientX - grab - paneLeft) / paneWidth, 0, 1);
}
