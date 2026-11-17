import { PNG } from 'pngjs';

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Rgb = readonly [number, number, number];

/** Build a small PNG in memory: a solid background with optional black blocks. */
export function png(
  width: number,
  height: number,
  blocks: Block[] = [],
  background: Rgb = [255, 255, 255],
): Buffer {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = background[0];
    image.data[i + 1] = background[1];
    image.data[i + 2] = background[2];
    image.data[i + 3] = 255;
  }
  for (const block of blocks) {
    for (let y = block.y; y < block.y + block.height; y++) {
      for (let x = block.x; x < block.x + block.width; x++) {
        const offset = (y * width + x) * 4;
        image.data[offset] = 0;
        image.data[offset + 1] = 0;
        image.data[offset + 2] = 0;
      }
    }
  }
  return PNG.sync.write(image);
}

export const RED: Rgb = [220, 40, 40];
export const BLUE: Rgb = [40, 40, 220];

export function pngUpload(name: string, buffer: Buffer) {
  return { name, mimeType: 'image/png', buffer };
}
