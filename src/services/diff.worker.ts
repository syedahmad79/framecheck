import { computeDiff } from '@/domain/diff';
import type { RgbaImage } from '@/domain/types';
import type { DiffRequest, DiffResponse } from './diffProtocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<DiffRequest>) => void) | null;
  postMessage(message: DiffResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

interface DecodedPair {
  readonly key: string;
  readonly reference: RgbaImage;
  readonly implementation: RgbaImage;
}

let cache: DecodedPair | null = null;
let pending: DiffRequest | null = null;
let draining = false;

async function readPixels(blob: Blob): Promise<RgbaImage> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('This browser does not support OffscreenCanvas, which Framecheck needs.');
  }
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const { width, height } = bitmap;
    const context = new OffscreenCanvas(width, height).getContext('2d', {
      willReadFrequently: true,
    });
    if (!context) throw new Error('Could not create a 2D canvas to read image pixels.');
    context.drawImage(bitmap, 0, 0);
    return { width, height, data: context.getImageData(0, 0, width, height).data };
  } finally {
    bitmap.close();
  }
}

async function handle(request: DiffRequest): Promise<void> {
  let decodeMs = 0;
  if (cache?.key !== request.sourceKey) {
    cache = null;
    const started = performance.now();
    const [reference, implementation] = await Promise.all([
      readPixels(request.reference),
      readPixels(request.implementation),
    ]);
    decodeMs = performance.now() - started;
    cache = { key: request.sourceKey, reference, implementation };
  }

  // A newer request arrived while decoding; its result is the only one anyone wants.
  if (pending) return;

  const started = performance.now();
  const computation = computeDiff(cache.reference, cache.implementation, request.settings);
  const compareMs = performance.now() - started;

  scope.postMessage(
    {
      type: 'result',
      jobId: request.jobId,
      result: { ...computation, settings: request.settings, compareMs, decodeMs },
    },
    [computation.mask.buffer, computation.density.counts.buffer],
  );
}

async function drain(): Promise<void> {
  while (pending) {
    const request = pending;
    pending = null;
    try {
      await handle(request);
    } catch (error) {
      scope.postMessage({
        type: 'error',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : 'The comparison failed unexpectedly.',
      });
    }
  }
  draining = false;
}

scope.onmessage = (event) => {
  // Only the most recent request matters. Requests that queued up behind a running
  // comparison overwrite each other here and are answered once, by the latest.
  pending = event.data;
  if (draining) return;
  draining = true;
  setTimeout(() => void drain(), 0);
};
