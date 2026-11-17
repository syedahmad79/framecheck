import { describe, expect, it } from 'vitest';
import { BLACK, pixelAt, solidImage, withPixels, withRect } from '@/test/pixels';
import { computeDiff, densityCellSize, MASK_COLORS } from './diff';
import { DEFAULT_DIFF_SETTINGS, type DiffSettings } from './types';

const settings = (overrides: Partial<DiffSettings> = {}): DiffSettings => ({
  ...DEFAULT_DIFF_SETTINGS,
  ...overrides,
});

describe('computeDiff', () => {
  it('reports no differences for identical images and leaves the mask transparent', () => {
    const image = solidImage(32, 16);
    const { stats, mask, density } = computeDiff(image, solidImage(32, 16), settings());
    expect(stats).toMatchObject({
      canvas: { width: 32, height: 16 },
      comparedPixels: 512,
      outsidePixels: 0,
      diffPixels: 0,
      antialiasedPixels: 0,
      diffRatio: 0,
      bounds: null,
    });
    expect(mask.every((byte) => byte === 0)).toBe(true);
    expect(density.max).toBe(0);
  });

  it('counts a changed block exactly, with bounds, ratio, mask colour and density', () => {
    const reference = solidImage(40, 40);
    const block = { x: 10, y: 20, width: 6, height: 4 };
    const implementation = withRect(reference, block, BLACK);

    const { stats, mask, density } = computeDiff(reference, implementation, settings());

    expect(stats.diffPixels).toBe(24);
    expect(stats.comparedPixels).toBe(1600);
    expect(stats.diffRatio).toBeCloseTo(24 / 1600);
    expect(stats.bounds).toEqual(block);
    expect(pixelAt(mask, 40, 10, 20)).toEqual([...MASK_COLORS.diff, 255]);
    expect(pixelAt(mask, 40, 9, 20)).toEqual([0, 0, 0, 0]);

    expect(density.cellSize).toBe(8);
    expect(density.columns).toBe(5);
    expect(density.rows).toBe(5);
    expect(density.counts.reduce((sum, count) => sum + count, 0)).toBe(24);
    // Block spans x 10..15 (cell column 1) and y 20..23 (cell row 2).
    expect(density.counts[2 * 5 + 1]).toBe(24);
    expect(density.max).toBe(24);
  });

  it('respects the threshold: a subtle change is only a difference when strict', () => {
    const reference = solidImage(16, 16, [200, 200, 200, 255]);
    const implementation = withRect(
      reference,
      { x: 4, y: 4, width: 8, height: 8 },
      [206, 206, 206, 255],
    );
    expect(
      computeDiff(reference, implementation, settings({ threshold: 0.1 })).stats.diffPixels,
    ).toBe(0);
    expect(
      computeDiff(reference, implementation, settings({ threshold: 0 })).stats.diffPixels,
    ).toBe(64);
  });

  it('separates anti-aliased pixels from real differences unless includeAA is set', () => {
    // A hard diagonal edge versus the same edge with a soft, anti-aliased boundary pixel.
    const size = 16;
    const reference = solidImage(size, size);
    const implementation = solidImage(size, size);
    const dark: [number, number][] = [];
    const edge: [number, number][] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x < y) dark.push([x, y]);
        if (x === y) edge.push([x, y]);
      }
    }
    const a = withPixels(reference, dark, BLACK);
    const b = withPixels(withPixels(implementation, dark, BLACK), edge, [120, 120, 120, 255]);

    const ignored = computeDiff(a, b, settings());
    const counted = computeDiff(a, b, settings({ includeAA: true }));

    expect(ignored.stats.antialiasedPixels).toBeGreaterThan(0);
    expect(counted.stats.antialiasedPixels).toBe(0);
    // Every pixel over the threshold is either a difference or ignored anti-aliasing.
    expect(ignored.stats.diffPixels + ignored.stats.antialiasedPixels).toBe(
      counted.stats.diffPixels,
    );

    const [x, y] = edge.find(
      ([ex, ey]) => pixelAt(ignored.mask, size, ex, ey)[0] === MASK_COLORS.antialias[0],
    ) ?? [-1, -1];
    expect(pixelAt(ignored.mask, size, x, y)).toEqual([...MASK_COLORS.antialias, 255]);
  });

  it('pads mismatched images and excludes the non-overlapping area from the comparison', () => {
    const reference = solidImage(10, 10);
    const implementation = withPixels(solidImage(10, 14), [[3, 3]], BLACK);

    const { stats, layout, mask } = computeDiff(reference, implementation, settings());

    expect(layout.mismatched).toBe(true);
    expect(stats.canvas).toEqual({ width: 10, height: 14 });
    expect(stats.outsidePixels).toBe(40);
    expect(stats.comparedPixels).toBe(100);
    expect(stats.diffPixels).toBe(1);
    expect(stats.diffRatio).toBeCloseTo(0.01);
    expect(stats.bounds).toEqual({ x: 3, y: 3, width: 1, height: 1 });
    // Outside area is tinted, not reported as a difference.
    expect(pixelAt(mask, 10, 0, 12).slice(0, 3)).toEqual([...MASK_COLORS.outside]);
    expect(pixelAt(mask, 10, 0, 12)[3]).toBeGreaterThan(0);
  });

  it('crops mismatched images to the shared area', () => {
    const reference = solidImage(10, 10);
    const implementation = withPixels(solidImage(10, 14), [[3, 12]], BLACK);

    const { stats } = computeDiff(reference, implementation, settings({ strategy: 'crop' }));

    expect(stats.canvas).toEqual({ width: 10, height: 10 });
    expect(stats.outsidePixels).toBe(0);
    expect(stats.comparedPixels).toBe(100);
    // The changed pixel is below the cropped area.
    expect(stats.diffPixels).toBe(0);
  });

  it('applies the anchor before comparing', () => {
    // 4x4 white reference vs a 2x2 black implementation.
    const reference = withRect(solidImage(4, 4), { x: 1, y: 1, width: 2, height: 2 }, BLACK);
    const implementation = solidImage(2, 2, BLACK);

    const topLeft = computeDiff(reference, implementation, settings({ anchor: 'top-left' }));
    const centered = computeDiff(reference, implementation, settings({ anchor: 'center' }));

    expect(topLeft.stats.diffPixels).toBe(3);
    expect(centered.stats.diffPixels).toBe(0);
  });
});

describe('densityCellSize', () => {
  it('never goes below the minimum cell size and grows with the image', () => {
    expect(densityCellSize({ width: 100, height: 100 })).toBe(8);
    expect(densityCellSize({ width: 3200, height: 1800 })).toBe(20);
  });
});
