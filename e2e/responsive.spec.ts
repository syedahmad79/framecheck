import { expect, test } from '@playwright/test';
import { png } from './fixtures';
import { box, compare, divider, mode, openSample } from './helpers';

test.describe('phone layout', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('home screen fits without horizontal scrolling', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole('button', { name: /Drop the reference screenshot/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Drop the implementation screenshot/ }),
    ).toBeVisible();
  });

  test('workspace fits, starts with the inspector closed, and opens it as a sheet', async ({
    page,
  }) => {
    await openSample(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const inspector = page.getByRole('complementary', { name: 'Inspector' });
    await expect(inspector).toHaveAttribute('inert', '');
    // The headline number stays visible in the toolbar while the detail is closed.
    await expect(page.getByTestId('result-chip-value')).toBeVisible();
    // Zoom controls float on the stage instead of crowding the toolbar.
    await expect(page.getByRole('group', { name: 'Zoom', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await expect(inspector).not.toHaveAttribute('inert', '');
    await expect(page.getByTestId('diff-percent')).toBeVisible();
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(inspector).toHaveAttribute('inert', '');
  });

  test('touch targets are comfortably sized', async ({ page }) => {
    await openSample(page);
    for (const name of ['Side by side', 'Slider', 'Overlay', 'Differences']) {
      const target = await box(mode(page, name));
      expect(target.height).toBeGreaterThanOrEqual(36);
      expect(target.width).toBeGreaterThanOrEqual(36);
    }
    const zoomIn = await box(page.getByRole('button', { name: 'Zoom in' }));
    expect(Math.min(zoomIn.width, zoomIn.height)).toBeGreaterThanOrEqual(36);
  });

  test('the slider is usable on a phone and does not scroll the page', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Touch injection uses the Chrome DevTools Protocol.');
    await compare(
      page,
      { name: 'a.png', buffer: png(300, 200) },
      { name: 'b.png', buffer: png(300, 200, [{ x: 10, y: 10, width: 50, height: 50 }]) },
    );
    await mode(page, 'Slider').click();
    const cdp = await page.context().newCDPSession(page);
    const stage = await box(page.getByTestId('stage'));
    const handle = await box(divider(page));
    const y = handle.y + handle.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: handle.x + handle.width / 2, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: stage.x + stage.width * 0.8, y: y + 40 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(
      Math.abs(Number(await divider(page).getAttribute('aria-valuenow')) - 80),
    ).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('tablet and laptop layouts', () => {
  test('a tablet keeps the inspector as a closed sheet on load', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await openSample(page);
    await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveAttribute(
      'inert',
      '',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('a laptop shows the inspector as a column beside the stage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openSample(page);
    const stage = await box(page.getByTestId('stage'));
    const inspector = await box(page.getByRole('complementary', { name: 'Inspector' }));
    expect(inspector.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
    expect(inspector.width).toBeGreaterThan(300);
  });
});
