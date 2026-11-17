import { expect, test, type Page } from '@playwright/test';
import { png, pngUpload } from './fixtures';
import { compare, mode } from './helpers';

/** The value beside a statistic's label in the inspector. */
const statValue = (page: Page, label: RegExp | string) =>
  page
    .locator('dt', { hasText: typeof label === 'string' ? new RegExp(`^${label}`) : label })
    .locator('xpath=following-sibling::dd');

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
    await expect(
      page.getByText(/No compared pixel differs by more than the threshold/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom to changes' })).toHaveCount(0);
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
    await expect(notice).toContainText('The sizes differ');
    await expect(notice).toContainText('0 × +30 px');

    // Pad: the extra 30 rows are outside the overlap, so they are not compared and not counted.
    await expect(page.getByTestId('diff-percent')).toHaveText('0%');
    await expect(statValue(page, 'Not compared')).toHaveText('6,000');
    await expect(statValue(page, 'Compared')).toHaveText('24,000');

    await notice.getByRole('radio', { name: 'Crop' }).click();
    await expect(page.locator('dt', { hasText: /^Not compared/ })).toHaveCount(0);
    await expect(notice).toContainText('Canvas 200 × 120 px');
    await expect(page.getByTestId('diff-percent')).toHaveText('0%');
  });

  test('each alignment anchor changes what is compared', async ({ page }) => {
    // A 40×40 black square in a 100×100 white image, against a 40×40 all-black image.
    await compare(
      page,
      { name: 'big.png', buffer: png(100, 100, [{ x: 30, y: 30, width: 40, height: 40 }]) },
      { name: 'small.png', buffer: png(40, 40, [{ x: 0, y: 0, width: 40, height: 40 }]) },
    );
    const percent = page.getByTestId('diff-percent');
    const notice = page.getByTestId('mismatch-notice');
    await notice.getByRole('radio', { name: 'Centre', exact: true }).click();
    // Centred, the black square lines up exactly: nothing differs in the 40×40 overlap.
    await expect(percent).toHaveText('0%');
    await notice.getByRole('radio', { name: 'Top left', exact: true }).click();
    // Top left, the overlap is the top-left 40×40 of the big image: 30×30 white area differs...
    await expect(percent).not.toHaveText('0%');
  });

  test('rejects a non-image file with an explanation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-reference').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(page.getByRole('alert')).toContainText('“notes.txt” is not a PNG or JPEG image');
    await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeDisabled();
  });

  test('rejects a corrupt file that only claims to be a PNG, and recovers when replaced', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByTestId('input-reference')
      .setInputFiles(pngUpload('broken.png', Buffer.from('definitely not png data')));
    await expect(page.getByRole('alert')).toContainText('“broken.png” could not be decoded');

    await page.getByTestId('input-reference').setInputFiles(pngUpload('good.png', png(20, 20)));
    await expect(page.getByTestId('slot-reference').getByText('good.png')).toBeVisible();
    await expect(page.getByTestId('slot-reference').getByRole('alert')).toHaveCount(0);
  });

  test('swaps the two images', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-reference').setInputFiles(pngUpload('first.png', png(20, 20)));
    await page
      .getByTestId('input-implementation')
      .setInputFiles(pngUpload('second.png', png(30, 30)));
    await expect(page.getByTestId('slot-implementation').getByText('second.png')).toBeVisible();
    await page.getByRole('button', { name: 'Swap reference and implementation' }).click();
    await expect(page.getByTestId('slot-reference').getByText('second.png')).toBeVisible();
    await expect(page.getByTestId('slot-implementation').getByText('first.png')).toBeVisible();
  });
});
