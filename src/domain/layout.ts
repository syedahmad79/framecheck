import type { Anchor, MismatchStrategy, Point, Rect, RgbaImage, Size } from './types';
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

/** Source-image pixel at which a canvas-space point lands, for an image drawn with `placement`. */
export function sourceOrigin(placement: Placement, canvasPoint: Point): Point {
  return {
    x: canvasPoint.x - placement.dx + placement.sx,
    y: canvasPoint.y - placement.dy + placement.sy,
  };
}

/**
 * Pixels of `image` covering `region` (a rectangle in canvas space).
 * Returns the image's own buffer, uncopied, when the region is the whole image.
 */
export function extractRegion(
  image: RgbaImage,
  placement: Placement,
  region: Rect,
): Uint8ClampedArray {
  const origin = sourceOrigin(placement, region);
  if (
    origin.x === 0 &&
    origin.y === 0 &&
    region.width === image.width &&
    region.height === image.height
  ) {
    return image.data;
  }
  const out = new Uint8ClampedArray(region.width * region.height * 4);
  const rowBytes = region.width * 4;
  for (let row = 0; row < region.height; row++) {
    const from = ((origin.y + row) * image.width + origin.x) * 4;
    out.set(image.data.subarray(from, from + rowBytes), row * rowBytes);
  }
  return out;
}

/** The parts of `outer` not covered by `inner` (which must lie inside it), as up to four rectangles. */
export function subtractRect(outer: Rect, inner: Rect): Rect[] {
  const rects: Rect[] = [];
  const bottom = inner.y + inner.height;
  const right = inner.x + inner.width;
  if (inner.y > outer.y) {
    rects.push({ x: outer.x, y: outer.y, width: outer.width, height: inner.y - outer.y });
  }
  if (bottom < outer.y + outer.height) {
    rects.push({
      x: outer.x,
      y: bottom,
      width: outer.width,
      height: outer.y + outer.height - bottom,
    });
  }
  if (inner.x > outer.x) {
    rects.push({ x: outer.x, y: inner.y, width: inner.x - outer.x, height: inner.height });
  }
  if (right < outer.x + outer.width) {
    rects.push({
      x: right,
      y: inner.y,
      width: outer.x + outer.width - right,
      height: inner.height,
    });
  }
  return rects;
}
