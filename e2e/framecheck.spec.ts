import { expect, test, type Page } from '@playwright/test';
import { png, pngUpload } from './fixtures';

async function compare(
  page: Page,
  reference: { name: string; buffer: Buffer },
  implementation: { name: string; buffer: Buffer },
) {
  await page.goto('/');
  await page
    .getByTestId('input-reference')
    .setInputFiles(pngUpload(reference.name, reference.buffer));
  await page
    .getByTestId('input-implementation')
    .setInputFiles(pngUpload(implementation.name, implementation.buffer));
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

const mode = (page: Page, name: string) => page.getByRole('radio', { name });

test.describe('sample comparison', () => {
  test('opens from the home page and computes a real diff in the worker', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Open the sample comparison' }).click();

    await expect(page.getByRole('heading', { name: 'Sample: billing settings' })).toBeVisible();
    const percent = page.getByTestId('diff-percent');
    await expect(percent).toHaveText(/^\d+\.\d{2}%$/);
    await expect(percent).not.toHaveText('0.00%');
    await expect(page.getByText(/of 1,024,000 compared pixels differ/)).toBeVisible();
  });

  test('switches between all four modes by click and by keyboard', async ({ page }) => {
    await page.goto('/#/sample');
    await expect(mode(page, 'Side by side')).toBeChecked();
    await expect(page.getByText('Reference', { exact: true }).first()).toBeVisible();

    await mode(page, 'Slider').click();
    await expect(page.getByRole('slider', { name: 'Comparison divider' })).toBeVisible();

    await mode(page, 'Overlay').click();
    await expect(page.getByRole('slider', { name: 'Opacity' })).toBeVisible();

    await mode(page, 'Differences').click();
    await expect(page.getByText('Differences over Reference')).toBeVisible();
    await expect(page.getByText('Anti-aliasing (ignored)')).toBeVisible();

    await page.getByTestId('stage').focus();
    await page.keyboard.press('1');
    await expect(mode(page, 'Side by side')).toBeChecked();
    await page.keyboard.press('2');
    await expect(mode(page, 'Slider')).toBeChecked();
  });

  test('moves the before/after divider with the keyboard and by dragging', async ({ page }) => {
    await page.goto('/#/sample');
    await mode(page, 'Slider').click();
    const divider = page.getByRole('slider', { name: 'Comparison divider' });
    await expect(divider).toHaveAttribute('aria-valuenow', '50');

    await divider.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(divider).toHaveAttribute('aria-valuenow', '39');

    const stage = await page.getByTestId('stage').boundingBox();
    const handle = await divider.boundingBox();
    if (!stage || !handle) throw new Error('stage or divider has no layout box');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.75, stage.y + stage.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(divider).toHaveAttribute('aria-valuenow', '75');
  });

  test('zooms, pans and fits, keeping the zoom readout in sync', async ({ page }) => {
    await page.goto('/#/sample');
    const zoom = page.getByTestId('zoom-level');
    const fit = page.getByRole('button', { name: 'Fit' });
    await expect(fit).toHaveAttribute('aria-pressed', 'true');
    const fitted = await zoom.textContent();

    await page.getByRole('button', { name: 'Actual size, 100%' }).click();
    await expect(zoom).toHaveText('100%');
    await expect(fit).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoom).toHaveText('150%');
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    await expect(zoom).toHaveText('75%');

    // Ctrl + wheel zooms at the cursor.
    const stage = page.getByTestId('stage');
    await stage.hover();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await expect(zoom).not.toHaveText('75%');

    await page.keyboard.press('f');
    await expect(zoom).toHaveText(fitted ?? '');
    await expect(fit).toHaveAttribute('aria-pressed', 'true');
  });

  test('threshold changes recompute the diff', async ({ page }) => {
    await page.goto('/#/sample');
    const percent = page.getByTestId('diff-percent');
    await expect(percent).toHaveText(/%$/);
    const atDefault = await percent.textContent();

    await page.getByLabel('Threshold').fill('0');
    await expect(percent).not.toHaveText(atDefault ?? '');
    const strict = Number.parseFloat((await percent.textContent()) ?? '0');
    expect(strict).toBeGreaterThan(Number.parseFloat(atDefault ?? '0'));
  });
});

test.describe('importing screenshots', () => {
  test('compares two uploaded PNGs and reports exact pixel counts', async ({ page }) => {
    await compare(
      page,
      { name: 'design.png', buffer: png(200, 120) },
      { name: 'build.png', buffer: png(200, 120, [{ x: 20, y: 30, width: 10, height: 10 }]) },
    );

    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');
    await expect(page.getByText('100 of 24,000 compared pixels differ.')).toBeVisible();
    await expect(page.getByText('10 × 10 at 20, 30')).toBeVisible();
    await expect(page.getByLabel('Comparison name')).toHaveValue('design vs build');
    await expect(page.getByTestId('mismatch-notice')).toHaveCount(0);

    await page.getByRole('button', { name: 'Zoom to changes' }).click();
    await expect(mode(page, 'Differences')).toBeChecked();
    await expect(page.getByTestId('zoom-level')).toHaveText('800%');
  });

  test('reports identical images as 0% different', async ({ page }) => {
    const buffer = png(64, 64, [{ x: 4, y: 4, width: 8, height: 8 }]);
    await compare(page, { name: 'a.png', buffer }, { name: 'b.png', buffer });
    await expect(page.getByTestId('diff-percent')).toHaveText('0%');
    await expect(page.getByText(/No pixel differs by more than the threshold/)).toBeVisible();
  });

  test('handles mismatched dimensions explicitly, with pad and crop strategies', async ({
    page,
  }) => {
    await compare(
      page,
      { name: 'short.png', buffer: png(200, 120) },
      { name: 'tall.png', buffer: png(200, 150, [{ x: 0, y: 130, width: 200, height: 10 }]) },
    );

    const notice = page.getByTestId('mismatch-notice');
    await expect(notice).toContainText('Sizes differ.');
    await expect(notice).toContainText('0 × +30 px');

    // Pad: the extra 30 rows are outside the overlap and are not counted as differences.
    await expect(page.getByTestId('diff-percent')).toHaveText('0%');
    await expect(page.getByText('Outside overlap').locator('..')).toContainText('6,000');
    await expect(page.getByText('Compared', { exact: true }).locator('..')).toContainText('24,000');

    await notice.getByRole('radio', { name: 'Crop' }).click();
    await expect(page.getByText('Outside overlap')).toHaveCount(0);
    await expect(page.getByText('Comparison canvas').locator('..')).toContainText('200 × 120 px');
    await expect(page.getByTestId('diff-percent')).toHaveText('0%');
  });

  test('rejects a non-image file with an explanation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-reference').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(page.getByRole('alert')).toContainText('“notes.txt” is not a PNG or JPEG image');
    await expect(page.getByRole('button', { name: 'Compare' })).toBeDisabled();
  });

  test('rejects a corrupt file that only claims to be a PNG', async ({ page }) => {
    await page.goto('/');
    await page
      .getByTestId('input-reference')
      .setInputFiles(pngUpload('broken.png', Buffer.from('definitely not png data')));
    await expect(page.getByRole('alert')).toContainText('“broken.png” could not be decoded');
  });
});

test.describe('persistence', () => {
  test('saves a comparison, restores it after reload, and deletes it', async ({ page }) => {
    await compare(
      page,
      { name: 'design.png', buffer: png(200, 120) },
      { name: 'build.png', buffer: png(200, 120, [{ x: 20, y: 30, width: 10, height: 10 }]) },
    );
    await expect(page.getByText('Saved in this browser')).toBeVisible();

    // Change name, mode and threshold; all three should survive a reload.
    const name = page.getByLabel('Comparison name');
    await name.fill('Checkout page');
    await name.press('Enter');
    await mode(page, 'Overlay').click();
    await page.getByLabel('Threshold').fill('0.3');
    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');
    // Autosave is debounced; wait for it to land before reloading.
    await page.waitForTimeout(700);

    await page.reload();
    await expect(page.getByLabel('Comparison name')).toHaveValue('Checkout page');
    await expect(mode(page, 'Overlay')).toBeChecked();
    await expect(page.getByLabel('Threshold')).toHaveValue('0.3');
    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');

    await page.getByRole('link', { name: 'Back to all comparisons' }).click();
    const saved = page.getByRole('link', { name: /Checkout page/ });
    await expect(saved).toBeVisible();

    await page.getByRole('button', { name: 'Delete Checkout page' }).click();
    await page.getByRole('button', { name: 'Confirm deleting Checkout page' }).click();
    await expect(saved).toHaveCount(0);
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
  });

  test('explains when a comparison link no longer exists', async ({ page }) => {
    await page.goto('/#/p/does-not-exist');
    await expect(page.getByRole('alert')).toContainText('could not be opened');
    await page.getByRole('link', { name: 'Back to all comparisons' }).click();
    await expect(page.getByRole('heading', { name: 'Compare two screenshots' })).toBeVisible();
  });
});
