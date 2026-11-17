import type { Anchor, MismatchStrategy, Rect, RgbaImage, Size } from '@/domain/types';

/** Small deterministic PRNG so randomised tests are reproducible from their seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random opaque image of blobs drawn from a few well-separated grays. */
export function randomImage(random: () => number, width: number, height: number): RgbaImage {
  const grays = [0, 128, 255];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([255, 255, 255, 255], i);
  const blobs = 1 + Math.floor(random() * 4);
  for (let n = 0; n < blobs; n++) {
    const gray = grays[Math.floor(random() * grays.length)] ?? 0;
    const x0 = Math.floor(random() * width);
    const y0 = Math.floor(random() * height);
    const x1 = Math.min(width, x0 + 1 + Math.floor(random() * width));
    const y1 = Math.min(height, y0 + 1 + Math.floor(random() * height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) data.set([gray, gray, gray, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const FACTOR: Record<Anchor, readonly [number, number]> = {
  'top-left': [0, 0],
  'top-center': [0.5, 0],
  center: [0.5, 0.5],
};

/**
 * Where canvas pixel `c` comes from in an image: `source = c - shift`.
 * Written from the definition of each strategy, independently of the layout module.
 */
function shiftOf(
  image: number,
  canvas: number,
  factor: number,
  strategy: MismatchStrategy,
): number {
  return strategy === 'pad'
    ? Math.floor((canvas - image) * factor)
    : -Math.floor((image - canvas) * factor);
}

export interface Expected {
  readonly canvas: Size;
  readonly compared: number;
  readonly outside: number;
  /** Compared positions where the two images hold different RGBA values. */
  readonly differing: number;
  readonly bounds: Rect | null;
}

/** Brute-force walk over every canvas pixel. */
export function expectedByBruteForce(
  a: RgbaImage,
  b: RgbaImage,
  strategy: MismatchStrategy,
  anchor: Anchor,
): Expected {
  const [fx, fy] = FACTOR[anchor];
  const pick = strategy === 'pad' ? Math.max : Math.min;
  const canvas = { width: pick(a.width, b.width), height: pick(a.height, b.height) };
  const shiftA = [
    shiftOf(a.width, canvas.width, fx, strategy),
    shiftOf(a.height, canvas.height, fy, strategy),
  ] as const;
  const shiftB = [
    shiftOf(b.width, canvas.width, fx, strategy),
    shiftOf(b.height, canvas.height, fy, strategy),
  ] as const;

  const read = (image: RgbaImage, sx: number, sy: number): string | null =>
    sx < 0 || sy < 0 || sx >= image.width || sy >= image.height
      ? null
      : Array.from(
          image.data.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4),
        ).join(',');

  let compared = 0;
  let outside = 0;
  let differing = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const pa = read(a, x - shiftA[0], y - shiftA[1]);
      const pb = read(b, x - shiftB[0], y - shiftB[1]);
      if (pa === null || pb === null) {
        outside++;
        continue;
      }
      compared++;
      if (pa !== pb) {
        differing++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    canvas,
    compared,
    outside,
    differing,
    bounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

/**
 * Lightness Pixelmatch compares for an opaque gray, from Ottosson's published OKLab
 * definition with the toe correction: for a neutral colour L = cbrt(linear luminance).
 */
export function grayLightness(value: number): number {
  const c = value / 255;
  const linear = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = Math.cbrt(linear);
  const k1 = 0.206;
  const k2 = 0.03;
  const k3 = (1 + k1) / (1 + k2);
  const x = k3 * L - k1;
  return 0.5 * (x + Math.sqrt(x * x + 4 * k2 * k3 * L));
}
