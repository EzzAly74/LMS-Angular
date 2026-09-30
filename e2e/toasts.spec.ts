import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The one toast outlet (D-072), driven through real flows on the
 * Qualifications page (delete succeeds / the API fails): the severity's
 * design, default title and message, the reading-end corner in each
 * language, duplicates suppressed, Dismiss, auto-dismiss, and a fit on
 * every width. Mocked API in the real shapes.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/toasts');
const LIST = '**/api/v1/admin/qualification-skills?**';
const row = (id: number, name: string) => ({
  id, name, courses_count: 1, enrolled_count: 3, job_titles_count: 1, learners_count: 4,
  certified_count: 2, completion_percent: 60, created_at: '2026-09-26 10:00:00',
});

async function open(page: Page, locale: 'en' | 'ar', deleteStatus: number): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route(LIST, r => r.fulfill({ json: { status: 'success', message: '', result: [row(1, 'Excel'), row(2, 'Microsoft Office')], meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 } } }));
  await page.route('**/api/v1/admin/qualification-skills/2', r => r.request().method() !== 'DELETE' ? r.fallback()
    : r.fulfill({ status: deleteStatus, json: deleteStatus === 200 ? { status: 'success', message: '', result: null } : { status: 'error', message: 'x' } }));
  await page.goto('/admin/qualifications');
  await expect(page.locator('.ql__row')).toHaveCount(2);
}

async function deleteSecond(page: Page): Promise<void> {
  await page.locator('.cl-more').nth(1).click();
  await page.getByRole('menuitem').nth(1).click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: /Delete|حذف/ }).last().click();
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('a success toast: design, title, corner, dismiss', async ({ page }) => {
    // The suite runs with reduced motion; this test checks the full motion.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, 'en', 200);
    await deleteSecond(page);

    const toast = page.locator('.nt');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveClass(/nt--success/);
    await expect(toast.locator('.nt__title')).toHaveText('Done');
    await expect(toast.locator('.nt__detail')).toHaveText('The qualification was deleted.');
    await expect(page.getByRole('alert').filter({ hasText: 'The qualification was deleted.' })).toBeVisible();

    // Top, on the reading end, clear of the 64 px top bar.
    const box = (await toast.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(width - (box.x + box.width)).toBeLessThan(40);
    expect(box.y).toBeGreaterThanOrEqual(64);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.waitForTimeout(450); // the enter animation
    await page.screenshot({ path: resolve(ARTIFACTS, 'desktop-1440-en-success.png'), clip: { x: width - 460, y: 0, width: 460, height: 220 } });

    // The countdown line runs, and pauses while the pointer is on the toast.
    const line = toast.locator('.nt__progress');
    await expect(line).toBeVisible();
    const state = () => line.evaluate(el => el.getAnimations()[0]?.playState ?? 'none');
    expect(await state()).toBe('running');
    await toast.hover();
    await expect.poll(state).toBe('paused');
    await page.mouse.move(10, 500);
    await expect.poll(state).toBe('running');

    await toast.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(toast).toHaveCount(0);
  });

  test('with reduced motion there is no countdown line', async ({ page }) => {
    await open(page, 'en', 200);
    await deleteSecond(page);
    await expect(page.locator('.nt')).toHaveCount(1);
    await expect(page.locator('.nt__progress')).toBeHidden();
  });

  test('an API failure: one error toast, not repeated, and it leaves by itself', async ({ page }) => {
    await open(page, 'en', 500);
    await deleteSecond(page);

    const toast = page.locator('.nt');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveClass(/nt--error/);
    await expect(toast.locator('.nt__title')).toHaveText('Something went wrong');
    await expect(toast.locator('.nt__detail')).toHaveText('An unexpected error occurred. Please try again.');
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(ARTIFACTS, 'desktop-1440-en-error.png'), clip: { x: 980, y: 0, width: 460, height: 220 } });

    // The same failure again while it is on screen does not stack a copy.
    // (The confirm stays open after a failure; Delete again.)
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(300);
    await expect(toast).toHaveCount(1);

    // Errors stay 7 s, then go.
    await expect(toast).toHaveCount(0, { timeout: 9000 });
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`toasts fit and sit on the reading end (${locale})`, async ({ page }, info) => {
    await open(page, locale, 200);
    await deleteSecond(page);
    const toast = page.locator('.nt');
    await expect(toast).toHaveCount(1);
    await page.waitForTimeout(450);

    const box = (await toast.boundingBox())!;
    const width = page.viewportSize()!.width;
    // Inside the screen with at least the 16 px gutter.
    expect(box.x).toBeGreaterThanOrEqual(15);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 15);
    if (width > 560) {
      // English: the right-hand corner; Arabic: the left-hand one.
      if (locale === 'en') expect(width - (box.x + box.width)).toBeLessThan(40);
      else expect(box.x).toBeLessThan(40);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(toast.locator('.nt__title')).not.toHaveText(/toast\./);
    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`) });
  });
}
