import type { Anchor, MismatchStrategy, Rect, RgbaImage, Size } from './types';
import { sizesEqual } from './types';

/**
 * Where one source image lands on the shared comparison canvas.
 * `sx/sy` crop into the source; `dx/dy` offset into the canvas.
 */
export interface Placement extends Size {
  readonly sx: number;
  readonly sy: number;
  readonly dx: number;
  readonly dy: number;
}

export interface ComparisonLayout {
  /** Dimensions of the canvas both images are compared on. */
  readonly canvas: Size;
  readonly reference: Placement;
  readonly implementation: Placement;
  /** Region of the canvas covered by both images. Only this region is compared. */
  readonly overlap: Rect;
  /** True when the source images do not have identical dimensions. */
  readonly mismatched: boolean;
}

const ANCHOR_FACTORS: Record<Anchor, { fx: number; fy: number }> = {
  'top-left': { fx: 0, fy: 0 },
  'top-center': { fx: 0.5, fy: 0 },
  center: { fx: 0.5, fy: 0.5 },
};

interface AxisPlacement {
  length: number;
  source: number;
  dest: number;
}

interface AxisLayout {
  size: number;
  a: AxisPlacement;
  b: AxisPlacement;
}

function layoutAxis(a: number, b: number, factor: number, strategy: MismatchStrategy): AxisLayout {
  if (strategy === 'pad') {
    const size = Math.max(a, b);
    return {
      size,
      a: { length: a, source: 0, dest: Math.floor((size - a) * factor) },
      b: { length: b, source: 0, dest: Math.floor((size - b) * factor) },
    };
  }
  const size = Math.min(a, b);
  return {
    size,
    a: { length: size, source: Math.floor((a - size) * factor), dest: 0 },
    b: { length: size, source: Math.floor((b - size) * factor), dest: 0 },
  };
}

/**
 * Decide how two images share one canvas. Images are never resampled:
 * `pad` grows the canvas to contain both, `crop` shrinks it to what both cover.
 */
export function computeLayout(
  reference: Size,
  implementation: Size,
  strategy: MismatchStrategy,
  anchor: Anchor,
): ComparisonLayout {
  const { fx, fy } = ANCHOR_FACTORS[anchor];
  const x = layoutAxis(reference.width, implementation.width, fx, strategy);
  const y = layoutAxis(reference.height, implementation.height, fy, strategy);

  const left = Math.max(x.a.dest, x.b.dest);
  const top = Math.max(y.a.dest, y.b.dest);
  const right = Math.min(x.a.dest + x.a.length, x.b.dest + x.b.length);
  const bottom = Math.min(y.a.dest + y.a.length, y.b.dest + y.b.length);

  return {
    canvas: { width: x.size, height: y.size },
    reference: toPlacement(x.a, y.a),
    implementation: toPlacement(x.b, y.b),
    overlap: { x: left, y: top, width: right - left, height: bottom - top },
    mismatched: !sizesEqual(reference, implementation),
  };
}

function toPlacement(x: AxisPlacement, y: AxisPlacement): Placement {
  return { sx: x.source, sy: y.source, dx: x.dest, dy: y.dest, width: x.length, height: y.length };
}

/**
 * Copy an image onto a transparent canvas-sized buffer according to its placement.
 * Returns the original buffer untouched when the image already fills the canvas.
 */
export function placeOnCanvas(
  image: RgbaImage,
  placement: Placement,
  canvas: Size,
): Uint8ClampedArray {
  const fillsCanvas =
    sizesEqual(image, canvas) &&
    sizesEqual(placement, canvas) &&
    placement.sx === 0 &&
    placement.sy === 0 &&
    placement.dx === 0 &&
    placement.dy === 0;
  if (fillsCanvas) return image.data;

  const out = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  const rowBytes = placement.width * 4;
  for (let row = 0; row < placement.height; row++) {
    const from = ((placement.sy + row) * image.width + placement.sx) * 4;
    const to = ((placement.dy + row) * canvas.width + placement.dx) * 4;
    out.set(image.data.subarray(from, from + rowBytes), to);
  }
  return out;
}

/**
 * One byte per canvas pixel: 1 where only one image has content (excluded from comparison).
 * Returns null when both images cover the whole canvas.
 */
export function buildOutsideMask(layout: ComparisonLayout): Uint8Array | null {
  const { canvas, overlap } = layout;
  if (overlap.width === canvas.width && overlap.height === canvas.height) return null;

  const mask = new Uint8Array(canvas.width * canvas.height).fill(1);
  for (let row = overlap.y; row < overlap.y + overlap.height; row++) {
    const start = row * canvas.width + overlap.x;
    mask.fill(0, start, start + overlap.width);
  }
  return mask;
}
