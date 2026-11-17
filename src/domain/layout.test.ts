import { describe, expect, it } from 'vitest';
import { BLACK, pixelAt, RED, solidImage, withPixels } from '@/test/pixels';
import type { Rect } from './types';
import { computeLayout, extractRegion, sourceOrigin, subtractRect } from './layout';

describe('computeLayout', () => {
  it('is an identity layout for equal sizes', () => {
    const size = { width: 100, height: 50 };
    const layout = computeLayout(size, size, 'pad', 'top-left');
    expect(layout.mismatched).toBe(false);
    expect(layout.canvas).toEqual(size);
    expect(layout.overlap).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(layout.reference).toEqual({ sx: 0, sy: 0, dx: 0, dy: 0, width: 100, height: 50 });
    expect(layout.implementation).toEqual(layout.reference);
  });

  it('pads to the union of both sizes, anchored top-left', () => {
    const layout = computeLayout(
      { width: 100, height: 50 },
      { width: 80, height: 70 },
      'pad',
      'top-left',
    );
    expect(layout.mismatched).toBe(true);
    expect(layout.canvas).toEqual({ width: 100, height: 70 });
    expect(layout.reference).toMatchObject({ dx: 0, dy: 0, width: 100, height: 50 });
    expect(layout.implementation).toMatchObject({ dx: 0, dy: 0, width: 80, height: 70 });
    expect(layout.overlap).toEqual({ x: 0, y: 0, width: 80, height: 50 });
  });

  it('centres the smaller image when padding with a centre anchor', () => {
    const layout = computeLayout(
      { width: 100, height: 100 },
      { width: 60, height: 40 },
      'pad',
      'center',
    );
    expect(layout.implementation).toMatchObject({ dx: 20, dy: 30, sx: 0, sy: 0 });
    expect(layout.overlap).toEqual({ x: 20, y: 30, width: 60, height: 40 });
  });

  it('only centres horizontally for the top-center anchor', () => {
    const layout = computeLayout(
      { width: 100, height: 100 },
      { width: 60, height: 40 },
      'pad',
      'top-center',
    );
    expect(layout.implementation).toMatchObject({ dx: 20, dy: 0 });
  });

  it('crops to the intersection and offsets into the larger source', () => {
    const layout = computeLayout(
      { width: 100, height: 50 },
      { width: 80, height: 70 },
      'crop',
      'center',
    );
    expect(layout.canvas).toEqual({ width: 80, height: 50 });
    expect(layout.reference).toEqual({ sx: 10, sy: 0, dx: 0, dy: 0, width: 80, height: 50 });
    expect(layout.implementation).toEqual({ sx: 0, sy: 10, dx: 0, dy: 0, width: 80, height: 50 });
    expect(layout.overlap).toEqual({ x: 0, y: 0, width: 80, height: 50 });
  });
});

describe('extractRegion', () => {
  it('returns the source buffer without copying when the region is the whole image', () => {
    const image = solidImage(4, 4);
    const layout = computeLayout(image, image, 'pad', 'top-left');
    expect(extractRegion(image, layout.reference, layout.overlap)).toBe(image.data);
  });

  it('copies the covered rows from the right source offset (pad)', () => {
    const image = withPixels(solidImage(6, 4), [[2, 1]], RED);
    const layout = computeLayout({ width: 4, height: 4 }, image, 'pad', 'top-left');
    // The overlap is the 4x4 top-left corner of the 6x4 image.
    const region = extractRegion(image, layout.implementation, layout.overlap);
    expect(region).toHaveLength(4 * 4 * 4);
    expect(pixelAt(region, 4, 2, 1)).toEqual([...RED]);
    expect(pixelAt(region, 4, 3, 1)).toEqual([255, 255, 255, 255]);
  });

  it('crops from the centre of the larger source', () => {
    const big = withPixels(solidImage(6, 6), [[2, 2]], BLACK);
    const layout = computeLayout(big, { width: 2, height: 2 }, 'crop', 'center');
    // Centre crop of a 6x6 image to 2x2 starts at source (2, 2).
    const region = extractRegion(big, layout.reference, layout.overlap);
    expect(pixelAt(region, 2, 0, 0)).toEqual([...BLACK]);
    expect(pixelAt(region, 2, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe('sourceOrigin', () => {
  it('maps a canvas point back to the source image', () => {
    const placement = { sx: 3, sy: 0, dx: 5, dy: 2, width: 10, height: 10 };
    expect(sourceOrigin(placement, { x: 5, y: 2 })).toEqual({ x: 3, y: 0 });
    expect(sourceOrigin(placement, { x: 9, y: 4 })).toEqual({ x: 7, y: 2 });
  });
});

describe('subtractRect', () => {
  const area = (rects: Rect[]) => rects.reduce((sum, r) => sum + r.width * r.height, 0);

  it('returns nothing when the inner rectangle is the whole outer one', () => {
    const outer = { x: 0, y: 0, width: 10, height: 8 };
    expect(subtractRect(outer, outer)).toEqual([]);
  });

  it('covers exactly the uncovered area without overlapping the inner rectangle', () => {
    const outer = { x: 0, y: 0, width: 10, height: 8 };
    const inner = { x: 2, y: 3, width: 5, height: 2 };
    const rects = subtractRect(outer, inner);
    expect(area(rects)).toBe(80 - 10);
    for (const r of rects) {
      const overlapsX = r.x < inner.x + inner.width && inner.x < r.x + r.width;
      const overlapsY = r.y < inner.y + inner.height && inner.y < r.y + r.height;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('handles an inner rectangle flush with two edges', () => {
    const rects = subtractRect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 6, height: 4 },
    );
    expect(area(rects)).toBe(100 - 24);
    expect(rects).toHaveLength(2);
  });
});
