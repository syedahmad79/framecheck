import { describe, expect, it } from 'vitest';
import { BLACK, pixelAt, RED, solidImage, withPixels } from '@/test/pixels';
import { buildOutsideMask, computeLayout, placeOnCanvas } from './layout';

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

describe('placeOnCanvas', () => {
  it('returns the source buffer without copying when it already fills the canvas', () => {
    const image = solidImage(4, 4);
    const layout = computeLayout(image, image, 'pad', 'top-left');
    expect(placeOnCanvas(image, layout.reference, layout.canvas)).toBe(image.data);
  });

  it('pads with transparent pixels around an offset image', () => {
    const small = solidImage(2, 2, RED);
    const layout = computeLayout({ width: 4, height: 4 }, small, 'pad', 'center');
    const placed = placeOnCanvas(small, layout.implementation, layout.canvas);
    expect(placed).toHaveLength(4 * 4 * 4);
    expect(pixelAt(placed, 4, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(placed, 4, 1, 1)).toEqual([...RED]);
    expect(pixelAt(placed, 4, 2, 2)).toEqual([...RED]);
    expect(pixelAt(placed, 4, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  it('crops from the correct source offset', () => {
    const big = withPixels(solidImage(4, 4), [[1, 1]], BLACK);
    const layout = computeLayout(big, { width: 2, height: 2 }, 'crop', 'center');
    const placed = placeOnCanvas(big, layout.reference, layout.canvas);
    expect(placed).toHaveLength(2 * 2 * 4);
    expect(pixelAt(placed, 2, 0, 0)).toEqual([...BLACK]);
    expect(pixelAt(placed, 2, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe('buildOutsideMask', () => {
  it('is null when both images cover the canvas', () => {
    const size = { width: 8, height: 8 };
    expect(buildOutsideMask(computeLayout(size, size, 'pad', 'top-left'))).toBeNull();
    expect(
      buildOutsideMask(computeLayout(size, { width: 4, height: 4 }, 'crop', 'top-left')),
    ).toBeNull();
  });

  it('marks every pixel covered by only one image', () => {
    const layout = computeLayout(
      { width: 4, height: 2 },
      { width: 2, height: 3 },
      'pad',
      'top-left',
    );
    const mask = buildOutsideMask(layout);
    // canvas is 4x3; overlap is the top-left 2x2
    expect(Array.from(mask ?? [])).toEqual([0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1]);
  });
});
