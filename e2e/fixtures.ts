import { PNG } from 'pngjs';

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Build a small PNG in memory: white, with optional black blocks. */
export function png(width: number, height: number, blocks: Block[] = []): Buffer {
  const image = new PNG({ width, height });
  image.data.fill(255);
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

export function pngUpload(name: string, buffer: Buffer) {
  return { name, mimeType: 'image/png', buffer };
}
