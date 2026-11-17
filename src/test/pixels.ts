import type { RgbaImage } from '@/domain/types';

export type Rgba = readonly [number, number, number, number];

export const WHITE: Rgba = [255, 255, 255, 255];
export const BLACK: Rgba = [0, 0, 0, 255];
export const RED: Rgba = [255, 0, 0, 255];

export function solidImage(width: number, height: number, color: Rgba = WHITE): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(color, i);
  return { width, height, data };
}

export function withPixels(
  image: RgbaImage,
  pixels: readonly (readonly [x: number, y: number])[],
  color: Rgba,
): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (const [x, y] of pixels) data.set(color, (y * image.width + x) * 4);
  return { ...image, data };
}

export function withRect(
  image: RgbaImage,
  rect: { x: number; y: number; width: number; height: number },
  color: Rgba,
): RgbaImage {
  const pixels: [number, number][] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) pixels.push([x, y]);
  }
  return withPixels(image, pixels, color);
}

export function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.subarray(offset, offset + 4));
}
