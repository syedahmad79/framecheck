import { expect, test } from '@playwright/test';
import { png } from './fixtures';
import { compare, mode } from './helpers';

const designs = {
  reference: { name: 'design.png', buffer: png(200, 120) },
  implementation: {
    name: 'build.png',
    buffer: png(200, 120, [{ x: 20, y: 30, width: 10, height: 10 }]),
  },
};

test.describe('persistence', () => {
  test('saves a comparison, restores it after reload, and deletes it', async ({ page }) => {
    await compare(page, designs.reference, designs.implementation);
    await expect(page.getByText('Saved on this device')).toBeVisible();

    const name = page.getByLabel('Comparison name');
    await name.fill('Checkout page');
    await name.press('Enter');
    await mode(page, 'Overlay').click();
    await page.getByLabel('Threshold').fill('0.3');
    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');
    // Autosave is debounced; wait for it to land before reloading.
    await page.waitForTimeout(800);

    await page.reload();
    await expect(page.getByLabel('Comparison name')).toHaveValue('Checkout page');
    await expect(mode(page, 'Overlay')).toBeChecked();
    await expect(page.getByLabel('Threshold')).toHaveValue('0.3');
    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');

    await page.getByRole('link', { name: 'Framecheck, new comparison' }).click();
    const saved = page.getByRole('link', { name: /Checkout page/ });
    await expect(saved).toBeVisible();

    await page.getByRole('button', { name: 'Delete Checkout page' }).click();
    await page.getByRole('button', { name: 'Confirm deleting Checkout page' }).click();
    await expect(saved).toHaveCount(0);
    await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
  });

  test('keeps the slider position across a reload', async ({ page }) => {
    await compare(page, designs.reference, designs.implementation);
    await mode(page, 'Slider').click();
    const divider = page.getByRole('slider', { name: 'Comparison divider' });
    await divider.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(divider).toHaveAttribute('aria-valuenow', '70');
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Comparison divider' })).toHaveAttribute(
      'aria-valuenow',
      '70',
    );
  });

  test('the history dialog lists saved comparisons and opens one', async ({ page }) => {
    await compare(page, designs.reference, designs.implementation);
    await expect(page.getByText('Saved on this device')).toBeVisible();
    await page.getByRole('button', { name: 'History' }).click();
    const dialog = page.getByRole('dialog', { name: 'Saved comparisons' });
    await expect(dialog.getByRole('link', { name: /design vs build/ })).toBeVisible();
    await dialog.getByRole('link', { name: 'New comparison' }).click();
    await expect(page.getByRole('heading', { name: /Compare what you designed/ })).toBeVisible();
    await page.getByRole('link', { name: /design vs build/ }).click();
    await expect(page.getByTestId('diff-percent')).toHaveText('0.42%');
  });

  test('explains when a comparison link no longer exists', async ({ page }) => {
    await page.goto('/#/p/does-not-exist');
    await expect(page.getByRole('alert')).toContainText('could not be opened');
    await page.getByRole('link', { name: 'Back to all comparisons' }).click();
    await expect(page.getByRole('heading', { name: /Compare what you designed/ })).toBeVisible();
  });
});
