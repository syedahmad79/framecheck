import pixelmatch from 'pixelmatch';
import { buildOutsideMask, computeLayout, placeOnCanvas, type ComparisonLayout } from './layout';
import type { DiffSettings, Rect, RgbaImage, Size } from './types';

type Rgb = readonly [number, number, number];

/** Colours written into the diff mask. Mirrored by the `diff`, `aa` and `outside` theme tokens. */
export const MASK_COLORS = {
  diff: [255, 77, 141],
  antialias: [245, 197, 66],
  outside: [91, 140, 255],
} as const satisfies Record<string, Rgb>;

const OUTSIDE_ALPHA = 96;

/** Coarse grid of difference counts, used to keep sparse changes visible when zoomed out. */
export interface DensityGrid {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  /** Differing pixels per cell, row-major. */
  readonly counts: Uint32Array;
  readonly max: number;
}

export interface DiffStats {
  readonly canvas: Size;
  /** Pixels covered by both images; the denominator for `diffRatio`. */
  readonly comparedPixels: number;
  /** Canvas pixels covered by only one image. Never counted as differences. */
  readonly outsidePixels: number;
  /** Pixels whose colour distance exceeds the threshold. */
  readonly diffPixels: number;
  /** Pixels over the threshold but classified as anti-aliasing and ignored. */
  readonly antialiasedPixels: number;
  /** diffPixels / comparedPixels, 0 when nothing was compared. */
  readonly diffRatio: number;
  /** Smallest rectangle containing every differing pixel, in canvas coordinates. */
  readonly bounds: Rect | null;
}

export interface DiffComputation {
  readonly layout: ComparisonLayout;
  readonly stats: DiffStats;
  /** RGBA overlay, canvas sized: transparent where pixels match. */
  readonly mask: Uint8ClampedArray;
  readonly density: DensityGrid;
}

const TARGET_GRID_COLUMNS = 160;
const MIN_CELL_SIZE = 8;

export function densityCellSize(canvas: Size): number {
  return Math.max(
    MIN_CELL_SIZE,
    Math.ceil(Math.max(canvas.width, canvas.height) / TARGET_GRID_COLUMNS),
  );
}

/** Pack a colour the way a little- or big-endian Uint32 view over RGBA bytes will read it. */
function packColor([r, g, b]: Rgb, alpha: number): number {
  const bytes = new Uint8Array([r, g, b, alpha]);
  return new Uint32Array(bytes.buffer)[0] ?? 0;
}

/**
 * Compare two images with Pixelmatch and derive statistics from its real output.
 *
 * Pure and synchronous: it runs inside the diff worker in the app and directly in unit tests.
 */
export function computeDiff(
  reference: RgbaImage,
  implementation: RgbaImage,
  settings: DiffSettings,
): DiffComputation {
  const layout = computeLayout(reference, implementation, settings.strategy, settings.anchor);
  const { canvas } = layout;
  const totalPixels = canvas.width * canvas.height;

  const cellSize = densityCellSize(canvas);
  const columns = Math.ceil(canvas.width / cellSize);
  const rows = Math.ceil(canvas.height / cellSize);
  const counts = new Uint32Array(columns * rows);
  const mask = new Uint8ClampedArray(totalPixels * 4);

  if (totalPixels === 0) {
    return {
      layout,
      mask,
      density: { cellSize, columns, rows, counts, max: 0 },
      stats: {
        canvas,
        comparedPixels: 0,
        outsidePixels: 0,
        diffPixels: 0,
        antialiasedPixels: 0,
        diffRatio: 0,
        bounds: null,
      },
    };
  }

  const a = placeOnCanvas(reference, layout.reference, canvas);
  const b = placeOnCanvas(implementation, layout.implementation, canvas);
  const outside = buildOutsideMask(layout);

  // Pixelmatch does not draw anti-aliased pixels in `diffMask` mode, so we render the full
  // output with a fully faded background (alpha 0 => pure white) and strip the background below.
  const diffPixels = pixelmatch(a, b, mask, canvas.width, canvas.height, {
    threshold: settings.threshold,
    includeAA: settings.includeAA,
    alpha: 0,
    diffColor: [...MASK_COLORS.diff],
    aaColor: [...MASK_COLORS.antialias],
    ...(outside ? { ignoreMask: outside } : {}),
  });

  const pixels = new Uint32Array(mask.buffer, mask.byteOffset, totalPixels);
  const diffValue = packColor(MASK_COLORS.diff, 255);
  const aaValue = packColor(MASK_COLORS.antialias, 255);
  const outsideValue = packColor(MASK_COLORS.outside, OUTSIDE_ALPHA);

  let antialiasedPixels = 0;
  let outsidePixels = 0;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  let max = 0;

  for (let y = 0, i = 0; y < canvas.height; y++) {
    const cellRow = Math.floor(y / cellSize) * columns;
    for (let x = 0; x < canvas.width; x++, i++) {
      if (outside?.[i]) {
        pixels[i] = outsideValue;
        outsidePixels++;
        continue;
      }
      const value = pixels[i];
      if (value === diffValue) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const cell = cellRow + Math.floor(x / cellSize);
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

  const comparedPixels = totalPixels - outsidePixels;

  return {
    layout,
    mask,
    density: { cellSize, columns, rows, counts, max },
    stats: {
      canvas,
      comparedPixels,
      outsidePixels,
      diffPixels,
      antialiasedPixels,
      diffRatio: comparedPixels === 0 ? 0 : diffPixels / comparedPixels,
      bounds:
        maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    },
  };
}
