import { expect, type Locator, type Page } from '@playwright/test';
import { pngUpload } from './fixtures';

export interface Upload {
  name: string;
  buffer: Buffer;
}

export async function compare(page: Page, reference: Upload, implementation: Upload) {
  await page.goto('/');
  await page
    .getByTestId('input-reference')
    .setInputFiles(pngUpload(reference.name, reference.buffer));
  await page
    .getByTestId('input-implementation')
    .setInputFiles(pngUpload(implementation.name, implementation.buffer));
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

export async function openSample(page: Page) {
  await page.goto('/#/sample');
  await expect(page.getByTestId('diff-percent')).toHaveText(/%$/);
}

export const mode = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
export const divider = (page: Page) => page.getByRole('slider', { name: 'Comparison divider' });
export const zoomLevel = (page: Page) => page.getByTestId('zoom-level');
export const fitButton = (page: Page) => page.getByRole('button', { name: 'Fit to screen' });

export async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error('element has no layout box');
  return result;
}

/** The divider's value as a number. */
export async function dividerValue(page: Page): Promise<number> {
  return Number(await divider(page).getAttribute('aria-valuenow'));
}

/** Drag the divider with the mouse from where it is to a horizontal position, as a fraction of the stage. */
export async function dragDividerTo(
  page: Page,
  fraction: number,
  options: { release?: boolean } = {},
) {
  const stage = await box(page.getByTestId('stage'));
  const handle = await box(divider(page));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * fraction, handle.y + handle.height / 2, {
    steps: 10,
  });
  if (options.release !== false) await page.mouse.up();
}

export interface RowScan {
  /** Per device pixel along the row: 'r' reddish, 'b' bluish, '.' anything else. */
  readonly classes: string;
  readonly width: number;
}

/** Classify every pixel of one row of the stage canvas as red, blue or neither. */
export async function scanRow(page: Page, cssY: number): Promise<RowScan> {
  return page.evaluate(async (y) => {
    // The painter draws on the next animation frame; wait for it before reading pixels.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid=stage] canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) throw new Error('no stage canvas');
    const row = Math.round(y * (window.devicePixelRatio || 1));
    const { data } = ctx.getImageData(0, row, canvas.width, 1);
    let classes = '';
    for (let i = 0; i < data.length; i += 4) {
      const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
      classes += r > 150 && b < 100 && g < 100 ? 'r' : b > 150 && r < 100 && g < 100 ? 'b' : '.';
    }
    return { classes, width: canvas.width };
  }, cssY);
}

/** Wait until the stage has stopped changing size, e.g. after a viewport resize reflows the layout. */
export async function settleLayout(page: Page) {
  let last = '';
  await expect
    .poll(async () => {
      const current = JSON.stringify(await box(page.getByTestId('stage')));
      const stable = current === last;
      last = current;
      return stable;
    })
    .toBe(true);
}

/** Wait for every finite CSS animation and transition on the page to finish or be cancelled. */
export async function animationsDone(page: Page) {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}
