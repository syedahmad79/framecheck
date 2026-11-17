import type { ReactNode } from 'react';
import type { Size } from '@/domain/types';
import { useViewportStore } from '@/state/viewportStore';

/** Above this scale individual pixels are shown as crisp squares instead of being smoothed. */
const PIXELATED_FROM_SCALE = 2;

/** The comparison canvas, positioned by the shared viewport transform. */
export function TransformedContent({ size, children }: { size: Size; children: ReactNode }) {
  const transform = useViewportStore((state) => state.transform);
  return (
    <div
      className="checkerboard absolute top-0 left-0 origin-top-left shadow-[0_0_0_1px_var(--color-line-strong)] [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0"
      style={{
        width: size.width,
        height: size.height,
        transform: `translate(${Math.round(transform.x)}px, ${Math.round(transform.y)}px) scale(${transform.scale})`,
        imageRendering: transform.scale >= PIXELATED_FROM_SCALE ? 'pixelated' : 'auto',
      }}
    >
      {children}
    </div>
  );
}
