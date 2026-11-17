import type { Size } from './types';

export const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
export const ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,image/png,image/jpeg';

/** Conservative application limits. See "Known limitations" in the README. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_DIMENSION = 16_384;
export const MAX_PIXELS = 40_000_000;
export const LARGE_IMAGE_PIXELS = 12_000_000;

export type ImportErrorCode =
  'unsupported-type' | 'file-too-large' | 'empty-file' | 'decode-failed' | 'dimensions-exceeded';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

const EXTENSION_PATTERN = /\.(png|jpe?g)$/i;

interface FileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

/** Checks that can be made before decoding. Returns null when the file is acceptable. */
export function validateFile(file: FileLike): ImportError | null {
  const typeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  // Some sources (e.g. certain drag origins) provide no MIME type; fall back to the extension.
  const extensionOk = file.type === '' && EXTENSION_PATTERN.test(file.name);
  if (!typeOk && !extensionOk) {
    return new ImportError(
      'unsupported-type',
      `“${file.name}” is not a PNG or JPEG image. Only PNG and JPEG screenshots are supported.`,
    );
  }
  if (file.size === 0) {
    return new ImportError('empty-file', `“${file.name}” is empty.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    return new ImportError(
      'file-too-large',
      `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`,
    );
  }
  return null;
}

/** Checks that need the decoded dimensions. Returns null when the image is acceptable. */
export function validateDimensions(name: string, size: Size): ImportError | null {
  const pixels = size.width * size.height;
  if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION || pixels > MAX_PIXELS) {
    return new ImportError(
      'dimensions-exceeded',
      `“${name}” is ${formatDimensions(size)} (${formatMegapixels(pixels)}). ` +
        `The limit is ${MAX_DIMENSION.toLocaleString('en-US')} px per side and ${formatMegapixels(MAX_PIXELS)}.`,
    );
  }
  return null;
}

export function isLargeImage(size: Size): boolean {
  return size.width * size.height >= LARGE_IMAGE_PIXELS;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimensions(size: Size): string {
  return `${size.width} × ${size.height}`;
}

export function formatMegapixels(pixels: number): string {
  return `${(pixels / 1_000_000).toFixed(1)} MP`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Format a ratio as a percentage without ever rounding a non-zero value to "0%"
 * or a not-quite-total value to "100%".
 */
export function formatPercent(ratio: number): string {
  if (ratio <= 0) return '0%';
  if (ratio >= 1) return '100%';
  const percent = ratio * 100;
  if (percent < 0.01) return '<0.01%';
  if (percent > 99.99) return '>99.99%';
  return `${percent.toFixed(2)}%`;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}
