import { useMemo } from 'react';
import type { ComparisonLayout } from '@/domain/layout';
import type { ImagePair } from '@/services/images';
import { sampleImage, toHex } from '@/services/pixelProbe';
import { useProbe } from '@/state/stageStores';

/** Coordinates and colours under the pointer. Hovering is enough; nothing needs to be clicked. */
export function PixelReadout({ images, layout }: { images: ImagePair; layout: ComparisonLayout }) {
  const point = useProbe();
  const colours = useMemo(
    () =>
      point && {
        reference: sampleImage(images.reference.bitmap, layout.reference, point),
        implementation: sampleImage(images.implementation.bitmap, layout.implementation, point),
      },
    [point, images, layout],
  );

  if (!point || !colours) {
    return <span className="text-fg-subtle">Hover the image to read pixel values</span>;
  }

  return (
    <span className="tabular flex items-center gap-3" aria-label="Pixel under the pointer">
      <span className="text-fg">
        x {point.x} <span className="text-fg-subtle">·</span> y {point.y}
      </span>
      <Swatch className="bg-ref" value={colours.reference ? toHex(colours.reference) : '—'} />
      <Swatch
        className="bg-impl"
        value={colours.implementation ? toHex(colours.implementation) : '—'}
      />
    </span>
  );
}

function Swatch({ className, value }: { className: string; value: string }) {
  return (
    <span className="text-fg-muted flex items-center gap-1.5 font-mono">
      <span className={`size-2 rounded-full ${className}`} aria-hidden="true" />
      {value}
    </span>
  );
}
