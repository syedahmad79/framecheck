import type { Placement } from '@/domain/layout';
import { sourceOrigin } from '@/domain/layout';
import type { Point } from '@/domain/types';

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

let scratch: CanvasRenderingContext2D | null | undefined;

function scratchContext(): CanvasRenderingContext2D | null {
  if (scratch === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    scratch = canvas.getContext('2d', { willReadFrequently: true });
  }
  return scratch;
}

/**
 * Colour of one source pixel for a comparison-canvas point, or null when the image does not
 * cover that point. Reads a single pixel, so it is cheap enough to call on pointer movement.
 */
export function sampleImage(
  bitmap: ImageBitmap,
  placement: Placement,
  canvasPoint: Point,
): Rgba | null {
  const { x, y } = sourceOrigin(placement, canvasPoint);
  const inside =
    canvasPoint.x >= placement.dx &&
    canvasPoint.y >= placement.dy &&
    canvasPoint.x < placement.dx + placement.width &&
    canvasPoint.y < placement.dy + placement.height;
  const context = scratchContext();
  if (!inside || !context) return null;
  try {
    context.clearRect(0, 0, 1, 1);
    context.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a };
  } catch {
    return null;
  }
}

export function toHex({ r, g, b, a }: Rgba): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return (
    `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase() +
    (a === 255 ? '' : ` α${Math.round((a / 255) * 100)}%`)
  );
}
