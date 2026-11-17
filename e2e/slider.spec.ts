import { expect, test, type Page } from '@playwright/test';
import { BLUE, png, RED } from './fixtures';
import {
  box,
  compare,
  divider,
  dividerValue,
  dragDividerTo,
  fitButton,
  mode,
  openSample,
  scanRow,
  settleLayout,
  zoomLevel,
} from './helpers';

async function openSlider(page: Page) {
  await openSample(page);
  await mode(page, 'Slider').click();
  await expect(divider(page)).toBeVisible();
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '50');
}

test.describe('before/after slider: dragging', () => {
  test('follows the pointer left to right and right to left across the pane', async ({ page }) => {
    await openSlider(page);
    await dragDividerTo(page, 0.8);
    expect(await dividerValue(page)).toBeCloseTo(80, -0.3);
    await dragDividerTo(page, 0.2);
    expect(await dividerValue(page)).toBeCloseTo(20, -0.3);
    await dragDividerTo(page, 0.65);
    expect(Math.abs((await dividerValue(page)) - 65)).toBeLessThanOrEqual(1);
  });

  test('tracks the pointer continuously, never lagging or jumping', async ({ page }) => {
    await openSlider(page);
    const stage = await box(page.getByTestId('stage'));
    const handle = await box(divider(page));
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
    await page.mouse.down();
    const seen: number[] = [];
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(stage.x + stage.width * (0.5 + i * 0.03), handle.y + 40);
      seen.push(await dividerValue(page));
    }
    await page.mouse.up();
    // Monotonic, with each step matching the 3% pointer step.
    const steps = seen.slice(1).map((value, i) => value - (seen[i] ?? 0));
    for (const step of steps) {
      expect(step).toBeGreaterThanOrEqual(2);
      expect(step).toBeLessThanOrEqual(4);
    }
    expect(Math.abs((seen.at(-1) ?? 0) - 86)).toBeLessThanOrEqual(1);
  });

  test('reaches both extremes and clamps when the pointer goes past the pane', async ({ page }) => {
    await openSlider(page);
    await dragDividerTo(page, -0.5);
    expect(await dividerValue(page)).toBe(0);
    await dragDividerTo(page, 1.6);
    expect(await dividerValue(page)).toBe(100);
    // Never stuck at the end: it can be dragged straight back.
    // The grab area sits inside the pane, so the divider keeps its small offset from the pointer
    // rather than jumping under it: allow for that, but it must follow the drag.
    await dragDividerTo(page, 0.4);
    expect(Math.abs((await dividerValue(page)) - 40)).toBeLessThanOrEqual(4);
    expect(await dividerValue(page)).toBeLessThan(60);
  });

  test('does not pan or change the zoom of the image underneath', async ({ page }) => {
    await openSlider(page);
    const zoomBefore = await zoomLevel(page).textContent();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    await dragDividerTo(page, 0.85);
    await dragDividerTo(page, 0.1);
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(zoomLevel(page)).toHaveText(zoomBefore ?? '');
  });

  test('stays accurate after zooming and panning', async ({ page }) => {
    await openSlider(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const stage = await box(page.getByTestId('stage'));
    // Pan by dragging empty background, away from the divider.
    await page.mouse.move(stage.x + stage.width * 0.15, stage.y + stage.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.05, stage.y + stage.height * 0.4, { steps: 5 });
    await page.mouse.up();
    const zoom = await zoomLevel(page).textContent();

    await dragDividerTo(page, 0.75);
    expect(Math.abs((await dividerValue(page)) - 75)).toBeLessThanOrEqual(1);
    await expect(zoomLevel(page)).toHaveText(zoom ?? '');
  });

  test('stays accurate after the viewport is resized', async ({ page }) => {
    await openSlider(page);
    await page.setViewportSize({ width: 1000, height: 700 });
    await settleLayout(page);
    await dragDividerTo(page, 0.25);
    expect(Math.abs((await dividerValue(page)) - 25)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1500, height: 900 });
    await settleLayout(page);
    await dragDividerTo(page, 0.9);
    expect(Math.abs((await dividerValue(page)) - 90)).toBeLessThanOrEqual(1);
  });

  test('releases cleanly when the pointer is let go outside the window', async ({ page }) => {
    await openSlider(page);
    const stage = await box(page.getByTestId('stage'));
    await dragDividerTo(page, 1.4, { release: false });
    await page.mouse.up();
    expect(await dividerValue(page)).toBe(100);
    // After release, moving the mouse must not move the divider.
    await page.mouse.move(stage.x + stage.width * 0.3, stage.y + 100);
    await page.mouse.move(stage.x + stage.width * 0.2, stage.y + 120);
    expect(await dividerValue(page)).toBe(100);
  });

  test('a click without movement leaves the divider where it is', async ({ page }) => {
    await openSlider(page);
    const handle = await box(divider(page));
    await page.mouse.click(handle.x + handle.width / 2, handle.y + handle.height / 2);
    expect(await dividerValue(page)).toBe(50);
  });
});

test.describe('before/after slider: keyboard', () => {
  test('arrows, Shift, Home and End move the divider without panning the image', async ({
    page,
  }) => {
    await openSlider(page);
    await divider(page).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await dividerValue(page)).toBe(52);
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await dividerValue(page)).toBe(42);
    await page.keyboard.press('End');
    expect(await dividerValue(page)).toBe(100);
    await page.keyboard.press('Home');
    expect(await dividerValue(page)).toBe(0);
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('double-click centres the divider', async ({ page }) => {
    await openSlider(page);
    await dragDividerTo(page, 0.2);
    await divider(page).dblclick();
    expect(await dividerValue(page)).toBe(50);
  });
});

test.describe('before/after slider: touch', () => {
  test.use({ hasTouch: true });

  test('drags with a finger and survives a cancelled touch', async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Real touch injection uses the Chrome DevTools Protocol.',
    );
    await openSlider(page);
    const cdp = await page.context().newCDPSession(page);
    const stage = await box(page.getByTestId('stage'));
    const handle = await box(divider(page));
    const y = handle.y + handle.height / 2;
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
      });

    await touch('touchStart', handle.x + handle.width / 2);
    for (const f of [0.55, 0.65, 0.75]) await touch('touchMove', stage.x + stage.width * f);
    await touch('touchEnd', 0);
    expect(Math.abs((await dividerValue(page)) - 75)).toBeLessThanOrEqual(1);
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');

    // A cancelled gesture keeps the last position and does not stick.
    const next = await box(divider(page));
    await touch('touchStart', next.x + next.width / 2);
    await touch('touchMove', stage.x + stage.width * 0.4);
    await touch('touchCancel', 0);
    const afterCancel = await dividerValue(page);
    expect(Math.abs(afterCancel - 40)).toBeLessThanOrEqual(1);
    await touch('touchStart', stage.x + stage.width * 0.2);
    await touch('touchMove', stage.x + stage.width * 0.1);
    await touch('touchEnd', 0);
    expect(await dividerValue(page)).toBe(afterCancel);
  });
});

test.describe('before/after slider: rendering agrees with the divider', () => {
  const ref = { name: 'ref.png', buffer: png(200, 120, [], RED) };
  const impl = { name: 'impl.png', buffer: png(260, 150, [], BLUE) };

  test('reveals at the divider with different image sizes, without rescaling either image', async ({
    page,
  }) => {
    await compare(page, ref, impl);
    await mode(page, 'Slider').click();
    await expect(divider(page)).toBeVisible();

    const stage = await box(page.getByTestId('stage'));
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    // The 260×150 canvas is centred at 100% (fit never upscales), so row 60 of the canvas lies in both images.
    const rowY = (stage.height - 150) / 2 + 60;
    const canvasLeft = (stage.width - 260) / 2;

    for (const [key, percent] of [
      ['Home', 0],
      ['End', 100],
    ] as const) {
      await divider(page).focus();
      await page.keyboard.press(key);
      expect(await dividerValue(page)).toBe(percent);
    }

    // Divider at 100%: only the reference is drawn. It must be exactly 200 CSS px wide: unscaled.
    const all = await scanRow(page, rowY);
    expect(all.classes.split('r').length - 1).toBe(Math.round(200 * dpr));
    expect(all.classes.indexOf('r')).toBe(Math.round(canvasLeft * dpr));

    // Divider at 60%: reference to the left, implementation to the right, switching exactly at the divider.
    await divider(page).focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight');
    expect(await dividerValue(page)).toBe(60);
    const sixty = await scanRow(page, rowY);
    const firstBlue = sixty.classes.indexOf('b');
    expect(Math.abs(firstBlue - 0.6 * stage.width * dpr)).toBeLessThanOrEqual(2);
    // Implementation is 260 CSS px wide: the blue run ends at its right edge, unscaled.
    const lastBlue = sixty.classes.lastIndexOf('b');
    expect(Math.abs(lastBlue + 1 - (canvasLeft + 260) * dpr)).toBeLessThanOrEqual(1);
  });
});
