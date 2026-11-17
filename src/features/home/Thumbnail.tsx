import { useEffect, useRef } from 'react';

/** A preview of a screenshot, decoded and scaled by the browser from the original file. */
export function Thumbnail({ blob, className }: { blob: Blob; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = ref.current;
    if (!image || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(blob);
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
      image.removeAttribute('src');
    };
  }, [blob]);

  return <img ref={ref} alt="" draggable={false} className={className} />;
}
