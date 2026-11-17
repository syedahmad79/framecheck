import { describe, expect, it } from 'vitest';
import { expectedByBruteForce, grayLightness, mulberry32, randomImage } from '@/test/oracle';
import {
  BLACK,
  pixelAt,
  RED,
  solidImage,
  WHITE,
  withPixels,
  withRect,
  type Rgba,
} from '@/test/pixels';
import { computeDiff, densityCellSize, MASK_COLORS } from './diff';
import { ANCHORS, DEFAULT_DIFF_SETTINGS, MISMATCH_STRATEGIES, type DiffSettings } from './types';

const settings = (overrides: Partial<DiffSettings> = {}): DiffSettings => ({
  ...DEFAULT_DIFF_SETTINGS,
  ...overrides,
});

const gray = (v: number): Rgba => [v, v, v, 255];

describe('computeDiff: known cases', () => {
  it('reports no differences for identical images and leaves the mask transparent', () => {
    const { stats, mask, density } = computeDiff(
      solidImage(32, 16),
      solidImage(32, 16),
      settings(),
    );
    expect(stats).toMatchObject({
      canvas: { width: 32, height: 16 },
      comparedPixels: 512,
      outsidePixels: 0,
      diffPixels: 0,
      antialiasedPixels: 0,
      translucentPixels: 0,
      diffRatio: 0,
      bounds: null,
    });
    expect(mask.every((byte) => byte === 0)).toBe(true);
    expect(density.max).toBe(0);
  });

  it('flags every pixel of two completely different images', () => {
    const { stats } = computeDiff(solidImage(9, 7, BLACK), solidImage(9, 7, WHITE), settings());
    expect(stats.diffPixels).toBe(63);
    expect(stats.diffRatio).toBe(1);
    expect(stats.bounds).toEqual({ x: 0, y: 0, width: 9, height: 7 });
  });

  it('counts a single changed pixel exactly, at the first and last positions', () => {
    for (const [x, y] of [
      [0, 0],
      [12, 9],
      [5, 4],
    ] as const) {
      const base = solidImage(13, 10);
      const { stats, mask } = computeDiff(base, withPixels(base, [[x, y]], BLACK), settings());
      expect(stats.diffPixels).toBe(1);
      expect(stats.bounds).toEqual({ x, y, width: 1, height: 1 });
      expect(pixelAt(mask, 13, x, y)).toEqual([...MASK_COLORS.diff, 255]);
    }
  });

  it('counts a changed block exactly, with bounds, ratio, mask colour and density', () => {
    const reference = solidImage(40, 40);
    const block = { x: 10, y: 20, width: 6, height: 4 };
    const { stats, mask, density } = computeDiff(
      reference,
      withRect(reference, block, BLACK),
      settings(),
    );
    expect(stats.diffPixels).toBe(24);
    expect(stats.comparedPixels).toBe(1600);
    expect(stats.diffRatio).toBeCloseTo(24 / 1600);
    expect(stats.bounds).toEqual(block);
    expect(pixelAt(mask, 40, 10, 20)).toEqual([...MASK_COLORS.diff, 255]);
    expect(pixelAt(mask, 40, 9, 20)).toEqual([0, 0, 0, 0]);

    expect(density).toMatchObject({ cellSize: 8, columns: 5, rows: 5, max: 24 });
    expect(density.counts.reduce((sum, count) => sum + count, 0)).toBe(24);
    expect(density.counts[2 * 5 + 1]).toBe(24);
  });

  it('separates anti-aliased pixels from differences unless includeAA is set', () => {
    const size = 16;
    const dark: [number, number][] = [];
    const edge: [number, number][] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x < y) dark.push([x, y]);
        if (x === y) edge.push([x, y]);
      }
    }
    const a = withPixels(solidImage(size, size), dark, BLACK);
    const b = withPixels(withPixels(solidImage(size, size), dark, BLACK), edge, gray(120));

    const ignored = computeDiff(a, b, settings());
    const counted = computeDiff(a, b, settings({ includeAA: true }));

    expect(ignored.stats.antialiasedPixels).toBeGreaterThan(0);
    expect(counted.stats.antialiasedPixels).toBe(0);
    expect(ignored.stats.diffPixels + ignored.stats.antialiasedPixels).toBe(
      counted.stats.diffPixels,
    );
    const aaPixel = edge.find(
      ([x, y]) => pixelAt(ignored.mask, size, x, y)[0] === MASK_COLORS.antialias[0],
    );
    expect(aaPixel).toBeDefined();
    const [x, y] = aaPixel ?? [0, 0];
    expect(pixelAt(ignored.mask, size, x, y)).toEqual([...MASK_COLORS.antialias, 255]);
  });
});

describe('computeDiff: threshold boundary', () => {
  // Expected distance for two grays is |Lr(a) - Lr(b)|, from the published OKLab definition.
  const pairs = [
    [100, 110],
    [0, 10],
    [200, 205],
    [250, 255],
    [30, 31],
    [0, 254],
  ] as const;

  it.each(pairs)('gray %i vs %i flips exactly at its OKLab distance', (a, b) => {
    const distance = Math.abs(grayLightness(a) - grayLightness(b));
    const compare = (threshold: number) =>
      computeDiff(solidImage(3, 3, gray(a)), solidImage(3, 3, gray(b)), settings({ threshold }))
        .stats.diffPixels;
    expect(compare(Math.max(0, distance - 2e-4))).toBe(9);
    expect(compare(Math.min(1, distance + 2e-4))).toBe(0);
  });

  it('threshold 0 flags the smallest possible change; threshold 1 flags nothing', () => {
    const a = solidImage(4, 4, gray(100));
    const b = solidImage(4, 4, gray(101));
    expect(computeDiff(a, b, settings({ threshold: 0 })).stats.diffPixels).toBe(16);
  });

  it('documents an upstream edge case: pure black vs pure white is still flagged at threshold 1', () => {
    // Their lightness distance is exactly 1, so the allowed chroma distance is exactly 0, and
    // floating-point residue in the chroma term is non-zero. Below 1 the oracle above holds.
    const stats = (threshold: number) =>
      computeDiff(solidImage(4, 4, BLACK), solidImage(4, 4, WHITE), settings({ threshold })).stats;
    expect(stats(1).diffPixels).toBe(16);
    expect(stats(0.999).diffPixels).toBe(16);
  });
});

describe('computeDiff: transparency', () => {
  it('composites over white deterministically, so transparent equals white at every position', () => {
    const transparent = solidImage(20, 20, [255, 255, 255, 0]);
    const { stats } = computeDiff(
      transparent,
      solidImage(20, 20, WHITE),
      settings({ threshold: 0 }),
    );
    expect(stats.diffPixels).toBe(0);
    expect(stats.translucentPixels).toBe(400);
  });

  it('matches a half-transparent black pixel to the gray it composites to', () => {
    // 50.2% black over white is 127 gray.
    const a = solidImage(5, 5, [0, 0, 0, 128]);
    const b = solidImage(5, 5, gray(127));
    expect(computeDiff(a, b, settings({ threshold: 0 })).stats.diffPixels).toBe(0);
  });

  it('flags a transparent pixel against an opaque non-white one, and counts translucent pixels', () => {
    const a = withPixels(solidImage(6, 6), [[1, 1]], [0, 0, 0, 0]);
    const b = withPixels(solidImage(6, 6), [[1, 1]], RED);
    const { stats } = computeDiff(a, b, settings());
    expect(stats.diffPixels).toBe(1);
    expect(stats.translucentPixels).toBe(1);
  });
});

describe('computeDiff: mismatched dimensions', () => {
  it('pads, compares only the overlap and reports the rest as outside', () => {
    const reference = solidImage(10, 10);
    const implementation = withPixels(
      solidImage(10, 14),
      [
        [3, 3],
        [3, 12],
      ],
      BLACK,
    );
    const { stats, layout, mask } = computeDiff(reference, implementation, settings());

    expect(layout.mismatched).toBe(true);
    expect(stats.canvas).toEqual({ width: 10, height: 14 });
    expect(stats.comparedPixels).toBe(100);
    expect(stats.outsidePixels).toBe(40);
    // The pixel at y=12 is in the padded strip: it must not count.
    expect(stats.diffPixels).toBe(1);
    expect(stats.diffRatio).toBeCloseTo(0.01);
    expect(stats.bounds).toEqual({ x: 3, y: 3, width: 1, height: 1 });
    expect(mask).toHaveLength(100 * 4);
  });

  it('reports bounds in canvas coordinates when the overlap is offset', () => {
    const reference = solidImage(8, 8);
    const implementation = withPixels(solidImage(4, 4), [[0, 0]], BLACK);
    const { stats, layout } = computeDiff(
      reference,
      implementation,
      settings({ anchor: 'center' }),
    );
    expect(layout.overlap).toEqual({ x: 2, y: 2, width: 4, height: 4 });
    expect(stats.bounds).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });

  it('crops to the shared area and ignores changes outside it', () => {
    const reference = solidImage(10, 10);
    const implementation = withPixels(solidImage(10, 14), [[3, 12]], BLACK);
    const { stats } = computeDiff(reference, implementation, settings({ strategy: 'crop' }));
    expect(stats.canvas).toEqual({ width: 10, height: 10 });
    expect(stats.outsidePixels).toBe(0);
    expect(stats.diffPixels).toBe(0);
  });

  it('applies the anchor before comparing', () => {
    const reference = withRect(solidImage(4, 4), { x: 1, y: 1, width: 2, height: 2 }, BLACK);
    const implementation = solidImage(2, 2, BLACK);
    expect(
      computeDiff(reference, implementation, settings({ anchor: 'top-left' })).stats.diffPixels,
    ).toBe(3);
    expect(
      computeDiff(reference, implementation, settings({ anchor: 'center' })).stats.diffPixels,
    ).toBe(0);
  });
});

describe('computeDiff: randomised against a brute-force oracle', () => {
  const cases = Array.from({ length: 60 }, (_, seed) => seed + 1);

  it.each(cases)(
    'seed %i: counts, bounds and exclusions match for every strategy and anchor',
    (seed) => {
      const random = mulberry32(seed);
      const dim = () => 1 + Math.floor(random() * 22);
      const a = randomImage(random, dim(), dim());
      // Half the cases share a size, to exercise the unmismatched path as well.
      const b =
        random() < 0.5 ? randomImage(random, a.width, a.height) : randomImage(random, dim(), dim());

      for (const strategy of MISMATCH_STRATEGIES) {
        for (const anchor of ANCHORS) {
          const expected = expectedByBruteForce(a, b, strategy, anchor);
          const counted = computeDiff(a, b, settings({ strategy, anchor, includeAA: true }));
          const ignored = computeDiff(a, b, settings({ strategy, anchor, includeAA: false }));
          const label = `${strategy}/${anchor}`;

          expect(counted.stats.canvas, label).toEqual(expected.canvas);
          expect(counted.stats.comparedPixels, label).toBe(expected.compared);
          expect(counted.stats.outsidePixels, label).toBe(expected.outside);
          expect(counted.stats.comparedPixels + counted.stats.outsidePixels, label).toBe(
            expected.canvas.width * expected.canvas.height,
          );
          // With every gray at least 0.4 apart, any positional inequality is over the threshold.
          expect(counted.stats.diffPixels, label).toBe(expected.differing);
          expect(counted.stats.bounds, label).toEqual(expected.bounds);

          // Ignoring anti-aliasing can only move pixels from "different" to "ignored".
          expect(ignored.stats.diffPixels + ignored.stats.antialiasedPixels, label).toBe(
            expected.differing,
          );
          expect(ignored.stats.canvas, label).toEqual(counted.stats.canvas);
        }
      }
    },
  );
});

describe('densityCellSize', () => {
  it('never goes below the minimum cell size and grows with the image', () => {
    expect(densityCellSize({ width: 100, height: 100 })).toBe(8);
    expect(densityCellSize({ width: 3200, height: 1800 })).toBe(20);
  });
});
