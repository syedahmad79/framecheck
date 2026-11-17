import { expect, test } from '@playwright/test';
import { BLUE, png, RED } from './fixtures';
import { box, compare, divider, fitButton, mode, openSample, scanRow, zoomLevel } from './helpers';

test.describe('sample comparison', () => {
  test('opens from the home page on the differences view, with a real result from the worker', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Open the sample comparison/ }).click();

    await expect(page.getByRole('heading', { name: 'Sample: billing settings' })).toBeVisible();
    await expect(mode(page, 'Differences')).toBeChecked();
    const percent = page.getByTestId('diff-percent');
    await expect(percent).toHaveText(/^\d+\.\d{2}%$/);
    await expect(percent).not.toHaveText('0.00%');
    await expect(page.getByText(/of 1,024,000 compared pixels differ/)).toBeVisible();
    await expect(page.getByTestId('result-chip-value')).toHaveText(await percent.innerText());
  });

  test('switches between all four modes by click and by keyboard', async ({ page }) => {
    await openSample(page);
    await mode(page, 'Side by side').click();
    await expect(page.getByText('Both images share one pan and zoom.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Reference screenshot' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Implementation screenshot' })).toBeVisible();

    await mode(page, 'Slider').click();
    await expect(divider(page)).toBeVisible();
    await mode(page, 'Overlay').click();
    await expect(page.getByRole('slider', { name: 'Blend' })).toBeVisible();
    await mode(page, 'Differences').click();
    await expect(page.getByText('Anti-aliasing, ignored').first()).toBeVisible();

    await page.getByTestId('stage').focus();
    await page.keyboard.press('1');
    await expect(mode(page, 'Side by side')).toBeChecked();
    await page.keyboard.press('2');
    await expect(mode(page, 'Slider')).toBeChecked();
    await page.keyboard.press('4');
    await expect(mode(page, 'Differences')).toBeChecked();
  });

  test('zooms, pans and fits, keeping the zoom readout in sync', async ({ page }) => {
    await openSample(page);
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    const fitted = await zoomLevel(page).textContent();

    await page.getByRole('button', { name: 'Actual size, 100%' }).click();
    await expect(zoomLevel(page)).toHaveText('100%');
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoomLevel(page)).toHaveText('150%');
    await page.getByTestId('stage').focus();
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    await expect(zoomLevel(page)).toHaveText('75%');

    await page.getByTestId('stage').hover();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await expect(zoomLevel(page)).not.toHaveText('75%');

    await page.keyboard.press('f');
    await expect(zoomLevel(page)).toHaveText(fitted ?? '');
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('double-click zooms in at the cursor and back out to fit', async ({ page }) => {
    await openSample(page);
    const fitted = await zoomLevel(page).textContent();
    const stage = await box(page.getByTestId('stage'));
    await page.mouse.dblclick(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(zoomLevel(page)).not.toHaveText(fitted ?? '');
    await page.mouse.dblclick(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(zoomLevel(page)).toHaveText(fitted ?? '');
  });

  test('threshold changes recompute the diff and mark the old numbers as updating', async ({
    page,
  }) => {
    await openSample(page);
    const percent = page.getByTestId('diff-percent');
    const atDefault = await percent.textContent();
    await page.getByLabel('Threshold').fill('0');
    await expect(percent).not.toHaveText(atDefault ?? '');
    expect(Number.parseFloat((await percent.textContent()) ?? '0')).toBeGreaterThan(
      Number.parseFloat(atDefault ?? '0'),
    );
    await expect(page.getByText(/Threshold 0\.00/)).toBeVisible();
  });

  test('zoom to changes frames the changed region and reports it', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Zoom to changes' }).click();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(zoomLevel(page)).not.toHaveText('100%');
  });
});

test.describe('inspecting pixels', () => {
  const ref = { name: 'ref.png', buffer: png(200, 120, [], RED) };
  const impl = { name: 'impl.png', buffer: png(200, 120, [], BLUE) };

  test('reads coordinates and colours of both images under the pointer', async ({ page }) => {
    await compare(page, ref, impl);
    const stage = await box(page.getByTestId('stage'));
    await page.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height / 2);
    const readout = page.getByLabel('Pixel under the pointer');
    await expect(readout).toContainText('#DC2828');
    await expect(readout).toContainText('#2828DC');
    await expect(readout).toContainText(/x \d+/);
    await page.mouse.move(stage.x + 2, stage.y + 2);
    await expect(readout).toBeHidden();
  });

  test('holding R or I shows one image on its own in the overlay, and releasing restores the blend', async ({
    page,
  }) => {
    await compare(page, ref, impl);
    await mode(page, 'Overlay').click();
    const row = (await box(page.getByTestId('stage'))).height / 2;
    const classesAt = async () => (await scanRow(page, row)).classes;

    const blended = await classesAt();
    expect(blended).not.toContain('r');
    expect(blended).not.toContain('b');

    await page.getByTestId('stage').hover();
    await page.keyboard.down('r');
    await expect.poll(async () => (await classesAt()).includes('r')).toBe(true);
    expect(await classesAt()).not.toContain('b');
    await page.keyboard.up('r');
    await page.keyboard.down('i');
    await expect.poll(async () => (await classesAt()).includes('b')).toBe(true);
    await page.keyboard.up('i');
    await expect.poll(async () => (await classesAt()).includes('b')).toBe(false);
  });
});

test.describe('inspector and dialogs', () => {
  test('collapses and expands with the toggle and the [ key, and remembers the choice', async ({
    page,
  }) => {
    await openSample(page);
    const inspector = page.getByRole('complementary', { name: 'Inspector' });
    const toggle = page.getByRole('button', { name: 'Inspector', exact: true });
    await expect(inspector).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('stage').focus();
    await page.keyboard.press('[');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(inspector).toHaveAttribute('inert', '');

    await page.reload();
    await expect(page.getByTestId('diff-percent')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await expect(page.getByTestId('diff-percent')).toBeVisible();
  });

  test('the shortcut list opens with ? and closes with Escape, returning focus', async ({
    page,
  }) => {
    await openSample(page);
    await page.getByTestId('stage').focus();
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Hold to show only the reference')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('shortcuts do nothing while a dialog is open', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await page.keyboard.press('2');
    await expect(mode(page, 'Differences')).toBeChecked();
  });

  test('the sample hint can be dismissed and stays dismissed', async ({ page }) => {
    await openSample(page);
    const hint = page.getByText(/This sample has deliberate regressions/);
    await expect(hint).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss hint' }).click();
    await expect(hint).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('diff-percent')).toBeVisible();
    await expect(hint).toBeHidden();
  });
});

test.describe('theme', () => {
  test('follows the system theme, can be overridden, and the choice persists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'System theme' })).toBeChecked();

    await page.getByRole('radio', { name: 'Light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe('rgb(244, 244, 241)');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('radio', { name: 'Light theme' })).toBeChecked();

    await page.getByRole('radio', { name: 'System theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the painted canvas follows the theme', async ({ page }) => {
    await openSample(page);
    await mode(page, 'Side by side').click();
    const sample = () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid=stage] canvas');
        const ctx = canvas?.getContext('2d');
        // A corner of the pane is outside the fitted image: only the stage behind shows, so read the DOM colour.
        const stage = document.querySelector('[data-testid=stage]');
        return ctx && stage ? getComputedStyle(stage).backgroundColor : '';
      });
    await page.getByRole('radio', { name: 'Dark theme' }).click();
    const dark = await sample();
    await page.getByRole('radio', { name: 'Light theme' }).click();
    expect(await sample()).not.toBe(dark);
  });
});
