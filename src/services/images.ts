import { ImportError, validateDimensions, validateFile } from '@/domain/files';
import type { ImageRole, Size } from '@/domain/types';

export interface ImageMeta extends Size {
  readonly name: string;
  readonly type: string;
  readonly bytes: number;
}

/** A source image held in memory: the original encoded bytes plus a decoded bitmap for drawing. */
export interface LoadedImage extends ImageMeta {
  readonly blob: Blob;
  readonly bitmap: ImageBitmap;
}

export type ImagePair = Readonly<Record<ImageRole, LoadedImage>>;

export function toImageMeta(image: ImageMeta): ImageMeta {
  const { name, type, bytes, width, height } = image;
  return { name, type, bytes, width, height };
}

/**
 * Decode off the main thread. EXIF orientation is applied so the bitmap matches
 * what an <img> element would display.
 */
export async function decodeBlob(blob: Blob, name: string): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ImportError(
      'decode-failed',
      'This browser cannot decode images off the main thread.',
    );
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new ImportError(
      'decode-failed',
      `“${name}” could not be decoded. The file may be corrupt or not a real PNG/JPEG.`,
    );
  }
}

export async function loadImageBlob(
  blob: Blob,
  meta: { name: string; type?: string },
): Promise<LoadedImage> {
  const bitmap = await decodeBlob(blob, meta.name);
  const size = { width: bitmap.width, height: bitmap.height };
  const dimensionError = validateDimensions(meta.name, size);
  if (dimensionError) {
    bitmap.close();
    throw dimensionError;
  }
  return { ...size, name: meta.name, type: meta.type ?? blob.type, bytes: blob.size, blob, bitmap };
}

/** Validate and decode a user-provided file. Rejects with an `ImportError`. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const fileError = validateFile(file);
  if (fileError) throw fileError;
  return loadImageBlob(file, { name: file.name, type: file.type });
}

export function releaseImage(image: LoadedImage): void {
  image.bitmap.close();
}

/** Free the GPU/CPU memory held by a finished comparison's mask. */
export function releaseResult(result: { readonly maskBitmap: ImageBitmap | null } | null): void {
  result?.maskBitmap?.close();
}
