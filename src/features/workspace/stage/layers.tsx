import { useEffect, useRef, type CSSProperties } from 'react';
import { MASK_COLORS, type DensityGrid } from '@/domain/diff';
import type { Placement } from '@/domain/layout';
import type { Size } from '@/domain/types';
import type { LoadedImage } from '@/services/images';
import { BitmapCanvas } from '@/ui/BitmapCanvas';

interface ImageLayerProps {
  readonly image: LoadedImage;
  readonly placement: Placement;
  readonly canvas: Size;
  readonly style?: CSSProperties;
}

/** A source image drawn at its placement on the comparison canvas, at native resolution. */
export function ImageLayer({ image, placement, canvas, style }: ImageLayerProps) {
  return <BitmapCanvas bitmap={image.bitmap} size={canvas} placement={placement} style={style} />;
}

/** The exact per-pixel diff mask produced by the worker. */
export function MaskLayer({ mask, canvas }: { mask: Uint8ClampedArray; canvas: Size }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context || canvas.width === 0 || canvas.height === 0) return;
    // The buffer was transferred from the worker, so it is always a plain ArrayBuffer.
    const pixels = mask as Uint8ClampedArray<ArrayBuffer>;
    context.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);
  }, [mask, canvas.width, canvas.height]);

  return <canvas ref={ref} width={canvas.width} height={canvas.height} aria-hidden="true" />;
}

const DENSITY_MIN_ALPHA = 70;
const DENSITY_MAX_ALPHA = 215;

/**
 * A coarse heat layer: one canvas pixel per grid cell, stretched over the image.
 * A 1px change is invisible when a 4000px image is fitted to the screen; its cell is not.
 */
export function DensityLayer({ density }: { density: DensityGrid }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { columns, rows, counts, max, cellSize } = density;

  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context || columns === 0 || rows === 0) return;
    const image = context.createImageData(columns, rows);
    const [r, g, b] = MASK_COLORS.diff;
    for (let cell = 0; cell < counts.length; cell++) {
      const count = counts[cell] ?? 0;
      if (count === 0) continue;
      // Square-root ramp so sparse cells stay clearly visible next to dense ones.
      const intensity = Math.sqrt(count / max);
      image.data.set(
        [r, g, b, DENSITY_MIN_ALPHA + (DENSITY_MAX_ALPHA - DENSITY_MIN_ALPHA) * intensity],
        cell * 4,
      );
    }
    context.putImageData(image, 0, 0);
  }, [columns, rows, counts, max]);

  return (
    <canvas
      ref={ref}
      width={columns}
      height={rows}
      aria-hidden="true"
      style={{ width: columns * cellSize, height: rows * cellSize, imageRendering: 'pixelated' }}
    />
  );
}
