// Captures the bundled sample comparison from scripts/sample/fixture.html.
// The two PNGs are real browser screenshots of the same page, with and without
// a set of deliberate regressions. Run with `npm run sample:generate`.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const fixture = pathToFileURL(fileURLToPath(new URL('./sample/fixture.html', import.meta.url)));
const outputDir = fileURLToPath(new URL('../public/sample/', import.meta.url));

const variants = [
  { file: 'reference.png', query: '' },
  { file: 'implementation.png', query: '?variant=implementation' },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  for (const { file, query } of variants) {
    await page.goto(fixture.href + query);
    await page.screenshot({ path: outputDir + file });
    console.log(`wrote public/sample/${file}`);
  }
} finally {
  await browser.close();
}
