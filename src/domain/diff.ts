import pixelmatch from 'pixelmatch';
import { computeLayout, extractRegion, type ComparisonLayout } from './layout';
import type { DiffSettings, Rect, RgbaImage, Size } from './types';

type Rgb = readonly [number, number, number];

/** Colours written into the difference mask. Mirrored by the `diff`, `aa` and `outside` theme tokens. */
export const MASK_COLORS = {
  diff: [255, 45, 125],
  antialias: [45, 190, 200],
  outside: [128, 138, 160],
} as const satisfies Record<string, Rgb>;

/** Coarse grid of difference counts, used to keep sparse changes visible when zoomed out. */
export interface DensityGrid {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  /** Differing pixels per cell, row-major, in canvas coordinates. */
  readonly counts: Uint32Array;
  readonly max: number;
}

export interface DiffStats {
  readonly canvas: Size;
  /** Pixels covered by both images: the area that was compared and the denominator of `diffRatio`. */
  readonly comparedPixels: number;
  /** Canvas pixels covered by only one image. They are not compared and never count as differences. */
  readonly outsidePixels: number;
  /** Compared pixels whose colour distance exceeds the threshold, excluding anti-aliasing. */
  readonly diffPixels: number;
  /** Compared pixels over the threshold that were classified as anti-aliasing and ignored. */
  readonly antialiasedPixels: number;
  /** Compared pixels where either image is not fully opaque. They are compared as if over white. */
  readonly translucentPixels: number;
  /** diffPixels / comparedPixels; 0 when nothing was compared. */
  readonly diffRatio: number;
  /** Smallest rectangle containing every differing pixel, in canvas coordinates. */
  readonly bounds: Rect | null;
}

export interface DiffComputation {
  readonly layout: ComparisonLayout;
  readonly stats: DiffStats;
  /**
   * RGBA classification of the overlap region (`layout.overlap`, row-major):
   * `MASK_COLORS.diff` where pixels differ, `MASK_COLORS.antialias` where an over-threshold
   * pixel was ignored as anti-aliasing, fully transparent elsewhere.
   */
  readonly mask: Uint8ClampedArray;
  readonly density: DensityGrid;
}

const TARGET_GRID_COLUMNS = 160;
const MIN_CELL_SIZE = 8;
const OPAQUE = 255;

export function densityCellSize(canvas: Size): number {
  return Math.max(
    MIN_CELL_SIZE,
    Math.ceil(Math.max(canvas.width, canvas.height) / TARGET_GRID_COLUMNS),
  );
}

/** Pack a colour the way a Uint32 view over RGBA bytes reads it, whatever the platform's endianness. */
function packColor([r, g, b]: Rgb): number {
  return new Uint32Array(new Uint8Array([r, g, b, OPAQUE]).buffer)[0] ?? 0;
}

function countTranslucent(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 3; i < a.length; i += 4) {
    if (a[i] !== OPAQUE || b[i] !== OPAQUE) count++;
  }
  return count;
}

/**
 * Compare two images with Pixelmatch and derive statistics from its output.
 *
 * Only the overlap of the two images is compared, so padding can never create or influence
 * differences. Pixelmatch's anti-aliasing detector looks at neighbouring pixels, so comparing
 * the overlap alone also keeps it from reading padding.
 *
 * Pixelmatch returns the count of differing pixels but not of ignored anti-aliased ones, so the
 * mask is read back: it paints every pixel with exactly one of three colours, which is only a
 * valid encoding while the difference count read from the mask equals the returned count. That
 * is checked on every run.
 *
 * Pure and synchronous: it runs inside the diff worker in the app and directly in unit tests.
 */
export function computeDiff(
  reference: RgbaImage,
  implementation: RgbaImage,
  settings: DiffSettings,
): DiffComputation {
  const layout = computeLayout(reference, implementation, settings.strategy, settings.anchor);
  const { canvas, overlap } = layout;
  const comparedPixels = overlap.width * overlap.height;

  const cellSize = densityCellSize(canvas);
  const columns = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);
  const counts = new Uint32Array(columns * rows);
  const mask = new Uint8ClampedArray(comparedPixels * 4);

  const empty = (): DiffComputation => ({
    layout,
    mask,
    density: { cellSize, columns, rows, counts, max: 0 },
    stats: {
      canvas,
      comparedPixels,
      outsidePixels: canvas.width * canvas.height - comparedPixels,
      diffPixels: 0,
      antialiasedPixels: 0,
      translucentPixels: 0,
      diffRatio: 0,
      bounds: null,
    },
  });
  if (comparedPixels === 0) return empty();

  const a = extractRegion(reference, layout.reference, overlap);
  const b = extractRegion(implementation, layout.implementation, overlap);

  // Transparent pixels are composited over plain white. Pixelmatch's default checkerboard
  // background would make a transparent-versus-white comparison depend on pixel position.
  const returned = pixelmatch(a, b, mask, overlap.width, overlap.height, {
    threshold: settings.threshold,
    includeAA: settings.includeAA,
    alpha: 0,
    diffColor: [...MASK_COLORS.diff],
    aaColor: [...MASK_COLORS.antialias],
    checkerboard: false,
  });

  const pixels = new Uint32Array(mask.buffer, mask.byteOffset, comparedPixels);
  const diffValue = packColor(MASK_COLORS.diff);
  const aaValue = packColor(MASK_COLORS.antialias);

  let diffPixels = 0;
  let antialiasedPixels = 0;
  let minX = overlap.width;
  let minY = overlap.height;
  let maxX = -1;
  let maxY = -1;
  let max = 0;

  for (let y = 0, i = 0; y < overlap.height; y++) {
    const cellRow = Math.floor((y + overlap.y) / cellSize) * columns;
    for (let x = 0; x < overlap.width; x++, i++) {
      const value = pixels[i];
      if (value === diffValue) {
        diffPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const cell = cellRow + Math.floor((x + overlap.x) / cellSize);
        const count = (counts[cell] ?? 0) + 1;
        counts[cell] = count;
        if (count > max) max = count;
      } else if (value === aaValue) {
        antialiasedPixels++;
      } else {
        pixels[i] = 0;
      }
    }
  }

  if (diffPixels !== returned) {
    throw new Error(
      `Internal consistency check failed: the mask holds ${diffPixels} differing pixels but Pixelmatch reported ${returned}.`,
    );
  }

  return {
    layout,
    mask,
    density: { cellSize, columns, rows, counts, max },
    stats: {
      canvas,
      comparedPixels,
      outsidePixels: canvas.width * canvas.height - comparedPixels,
      diffPixels,
      antialiasedPixels,
      translucentPixels: countTranslucent(a, b),
      diffRatio: diffPixels / comparedPixels,
      bounds:
        maxX < 0
          ? null
          : {
              x: minX + overlap.x,
              y: minY + overlap.y,
              width: maxX - minX + 1,
              height: maxY - minY + 1,
            },
    },
  };
}
