// Measures how the app behaves with large screenshots, against a production preview server.
// Usage: npm run build && npm run preview -- --port 4317 &   then   node scripts/measure-large.ts
// Reports worker compare time and the longest main-thread frame gap while comparing.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const BASE_URL = process.env.FRAMECHECK_URL ?? 'http://localhost:4317';
const SIZES: readonly (readonly [width: number, height: number])[] = [
  [1920, 1080],
  [4000, 3000],
  [6000, 6000],
];

/** The page-side frame timer keeps its state on `window`. */
type TimedWindow = Window & { __maxGap: number };

/** A UI-like image: flat background, a grid of blocks, optional shift to create differences. */
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

const browser = await chromium.launch();
try {
  for (const [width, height] of SIZES) {
    const page = await browser.newPage();
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
    const compare = page.getByRole('button', { name: 'Compare' });
    await compare.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('button[disabled]'), null, {
      timeout: 60_000,
    });

    await page.evaluate(() => {
      const timed = window as unknown as TimedWindow;
      timed.__maxGap = 0;
      let last = performance.now();
      const tick = (now: number) => {
        timed.__maxGap = Math.max(timed.__maxGap, now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const started = Date.now();
    await compare.click();
    await page.getByTestId('diff-percent').waitFor({ timeout: 120_000 });
    const wall = Date.now() - started;
    const compareTime = await page
      .getByText('Compare time')
      .locator('..')
      .locator('dd')
      .textContent();
    const percent = await page.getByTestId('diff-percent').textContent();
    const maxGap = await page.evaluate(() =>
      Math.round((window as unknown as TimedWindow).__maxGap),
    );

    // Second measurement: a threshold change reuses decoded pixels in the worker.
    await page.evaluate(() => {
      (window as unknown as TimedWindow).__maxGap = 0;
    });
    await page.getByLabel('Threshold').fill('0.2');
    await page.getByText('Updating…').waitFor({ state: 'hidden', timeout: 120_000 });
    const recompute = await page
      .getByText('Compare time')
      .locator('..')
      .locator('dd')
      .textContent();
    const maxGapRecompute = await page.evaluate(() =>
      Math.round((window as unknown as TimedWindow).__maxGap),
    );

    console.log(
      `${width}x${height} (${((width * height) / 1e6).toFixed(1)} MP): diff ${percent}, ` +
        `first result after ${wall} ms (compare ${compareTime}, longest frame gap ${maxGap} ms); ` +
        `threshold change: compare ${recompute}, longest frame gap ${maxGapRecompute} ms`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
