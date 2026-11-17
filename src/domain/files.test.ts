import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatPercent,
  MAX_DIMENSION,
  MAX_FILE_BYTES,
  stripExtension,
  validateDimensions,
  validateFile,
} from './files';

describe('validateFile', () => {
  it('accepts PNG and JPEG', () => {
    expect(validateFile({ name: 'a.png', type: 'image/png', size: 10 })).toBeNull();
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 })).toBeNull();
  });

  it('falls back to the extension only when the MIME type is missing', () => {
    expect(validateFile({ name: 'shot.JPEG', type: '', size: 10 })).toBeNull();
    expect(validateFile({ name: 'shot.png', type: 'image/webp', size: 10 })?.code).toBe(
      'unsupported-type',
    );
  });

  it('rejects other types, empty files and oversized files with specific codes', () => {
    expect(validateFile({ name: 'a.gif', type: 'image/gif', size: 10 })?.code).toBe(
      'unsupported-type',
    );
    expect(validateFile({ name: 'a.png', type: 'image/png', size: 0 })?.code).toBe('empty-file');
    expect(validateFile({ name: 'a.png', type: 'image/png', size: MAX_FILE_BYTES + 1 })?.code).toBe(
      'file-too-large',
    );
  });
});

describe('validateDimensions', () => {
  it('accepts ordinary screenshots', () => {
    expect(validateDimensions('a.png', { width: 2880, height: 1800 })).toBeNull();
  });

  it('rejects an over-long side or too many pixels', () => {
    expect(validateDimensions('a.png', { width: MAX_DIMENSION + 1, height: 10 })?.code).toBe(
      'dimensions-exceeded',
    );
    expect(validateDimensions('a.png', { width: 8000, height: 8000 })?.code).toBe(
      'dimensions-exceeded',
    );
  });
});

describe('formatters', () => {
  it('never rounds a non-zero ratio to 0% or a partial ratio to 100%', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.000001)).toBe('<0.01%');
    expect(formatPercent(0.999999)).toBe('>99.99%');
    expect(formatPercent(0.0231)).toBe('2.31%');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('strips a file extension', () => {
    expect(stripExtension('home.final.png')).toBe('home.final');
    expect(stripExtension('noext')).toBe('noext');
  });
});
