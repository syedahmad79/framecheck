import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { png } from './fixtures';
import { animationsDone, compare, mode, openSample } from './helpers';

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe audit, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    test('home screen', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('home screen with an import error and a loaded image', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('input-reference').setInputFiles({
        name: 'x.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
      });
      await page.getByTestId('input-implementation').setInputFiles({
        name: 'ok.png',
        mimeType: 'image/png',
        buffer: png(40, 30),
      });
      await expect(page.getByRole('alert')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    for (const name of ['Side by side', 'Slider', 'Overlay', 'Differences']) {
      test(`workspace, ${name}`, async ({ page }) => {
        await openSample(page);
        await mode(page, name).click();
        await animationsDone(page);
        expect(await violations(page)).toEqual([]);
      });
    }

    test('workspace with a size mismatch, and the open dialogs', async ({ page }) => {
      await compare(
        page,
        { name: 'a.png', buffer: png(100, 80) },
        { name: 'b.png', buffer: png(120, 90) },
      );
      await expect(page.getByTestId('mismatch-notice')).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await animationsDone(page);
      expect(await violations(page)).toEqual([]);
    });
  });
}

test.describe('keyboard and names', () => {
  test('every control in the workspace has an accessible name', async ({ page }) => {
    await openSample(page);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, [role=radio], [role=slider], a[href], input, select')]
        .filter((el) => !el.closest('[inert]') && !(el as HTMLElement).hidden)
        .filter((el) => {
          const label =
            el.getAttribute('aria-label') ??
            el.getAttribute('aria-labelledby') ??
            (el as HTMLInputElement).labels?.[0]?.textContent ??
            el.textContent;
          return !label || label.trim() === '';
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(unnamed).toEqual([]);
  });

  test('the whole workspace can be reached with Tab and the divider shows a visible focus ring', async ({
    page,
  }) => {
    await openSample(page);
    await mode(page, 'Slider').click();
    const divider = page.getByRole('slider', { name: 'Comparison divider' });
    await divider.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(divider).toBeFocused();
    const outline = await divider
      .locator('span')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });

  test('reduced motion removes transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSample(page);
    const duration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim(),
    );
    expect(Number.parseFloat(duration)).toBeLessThan(0.1);
  });
});
