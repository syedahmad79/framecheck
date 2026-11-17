import { useEffect, useRef, type CSSProperties } from 'react';
import type { Placement } from '@/domain/layout';
import type { Size } from '@/domain/types';

interface BitmapCanvasProps {
  readonly bitmap: ImageBitmap;
  /** Backing-store size in pixels. */
  readonly size: Size;
  /** Where the bitmap is drawn. Defaults to scaling the whole bitmap to fill the canvas. */
  readonly placement?: Placement;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Draws an ImageBitmap to a canvas. Decorative: the surrounding UI labels what it shows. */
export function BitmapCanvas({ bitmap, size, placement, className, style }: BitmapCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, size.width, size.height);
    if (placement) {
      const { sx, sy, dx, dy, width, height } = placement;
      context.drawImage(bitmap, sx, sy, width, height, dx, dy, width, height);
    } else {
      context.drawImage(bitmap, 0, 0, size.width, size.height);
    }
  }, [bitmap, placement, size.width, size.height]);

  return (
    <canvas
      ref={ref}
      width={size.width}
      height={size.height}
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}
