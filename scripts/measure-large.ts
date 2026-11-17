// Measures how the app behaves with large screenshots, against a production preview server.
// Usage: npm run build && npm run preview -- --port 4317 &   then   node scripts/measure-large.ts
// Reports the worker's compare time, the first-result latency, and the main-thread frame times
// while the comparison runs and while panning and zooming the result.
import { chromium, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const BASE_URL = process.env.FRAMECHECK_URL ?? 'http://localhost:4317';
const SIZES: readonly (readonly [width: number, height: number])[] = [
  [1920, 1080],
  [4000, 3000],
  [6000, 6000],
];

/** The page-side frame timer keeps its state on `window`. */
type TimedWindow = Window & { __frames: number[]; __stop?: () => void };

/** A UI-like image: flat background, a grid of blocks, optionally shifted to create differences. */
function makePng(width: number, height: number, shift: number): Buffer {
  const image = new PNG({ width, height });
  const data = image.data;
  data.fill(245);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inBlock = (x + shift) % 240 < 180 && y % 160 < 110;
      if (!inBlock) continue;
      const offset = (y * width + x) * 4;
      data[offset] = 37;
      data[offset + 1] = 99;
      data[offset + 2] = 235;
    }
  }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return PNG.sync.write(image, { deflateLevel: 1 });
}

async function startFrameTimer(page: Page) {
  await page.evaluate(() => {
    const timed = window as unknown as TimedWindow;
    timed.__frames = [];
    let last = performance.now();
    let running = true;
    timed.__stop = () => {
      running = false;
    };
    const tick = (now: number) => {
      timed.__frames.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

interface FrameStats {
  frames: number;
  median: number;
  p95: number;
  max: number;
}

async function stopFrameTimer(page: Page): Promise<FrameStats> {
  const frames = await page.evaluate(() => {
    const timed = window as unknown as TimedWindow;
    timed.__stop?.();
    return timed.__frames.slice(1);
  });
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return { frames: frames.length, median: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0 };
}

const fmt = (s: FrameStats) =>
  `${s.frames} frames, median ${s.median.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms, worst ${s.max.toFixed(1)} ms`;

const browser = await chromium.launch();
try {
  for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE_URL);
    await page.getByTestId('input-reference').setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: makePng(width, height, 0),
    });
    await page.getByTestId('input-implementation').setInputFiles({
      name: 'implementation.png',
      mimeType: 'image/png',
      buffer: makePng(width, height, 3),
    });
    const compare = page.getByRole('button', { name: 'Compare', exact: true });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          (b) => b.textContent === 'Compare' && !b.disabled,
        ),
      null,
      { timeout: 60_000 },
    );

    await startFrameTimer(page);
    const started = Date.now();
    await compare.click();
    await page.getByTestId('diff-percent').waitFor({ timeout: 120_000 });
    const firstResult = Date.now() - started;
    const loading = await stopFrameTimer(page);
    const percent = await page.getByTestId('diff-percent').textContent();
    const compareText = await page.getByText(/Compared in [\d.]+ ms/).textContent();

    // Threshold change: the worker reuses the decoded pixels it already holds.
    await startFrameTimer(page);
    await page.getByLabel('Threshold').fill('0.2');
    await page.getByText('Updating…').first().waitFor({ state: 'hidden', timeout: 120_000 });
    const recompute = await page.getByText(/Compared in [\d.]+ ms/).textContent();
    const afterThreshold = await stopFrameTimer(page);

    // Panning and zooming the differences view of the full-size image.
    await page.getByRole('radio', { name: 'Differences', exact: true }).click();
    const stage = await page.getByTestId('stage').boundingBox();
    if (!stage) throw new Error('no stage');
    const cx = stage.x + stage.width / 2;
    const cy = stage.y + stage.height / 2;
    await page.getByRole('button', { name: 'Actual size, 100%' }).click();
    await page.waitForTimeout(600);
    await startFrameTimer(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 120; i++) await page.mouse.move(cx - i * 3, cy - i * 2);
    await page.mouse.up();
    const pan = await stopFrameTimer(page);

    await page.keyboard.down('Control');
    await startFrameTimer(page);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, i < 20 ? -60 : 60);
      await page.waitForTimeout(8);
    }
    await page.keyboard.up('Control');
    const zoom = await stopFrameTimer(page);

    console.log(`${width}×${height} (${((width * height) / 1e6).toFixed(1)} MP), diff ${percent}`);
    console.log(`  first result ${firstResult} ms after Compare; ${compareText}`);
    console.log(`  frames while comparing:    ${fmt(loading)}`);
    console.log(`  threshold change:          ${recompute}; ${fmt(afterThreshold)}`);
    console.log(`  panning the diff at 100%:  ${fmt(pan)}`);
    console.log(`  Ctrl+wheel zoom:           ${fmt(zoom)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
