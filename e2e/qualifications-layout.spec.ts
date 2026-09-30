import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Qualifications (Figma 2066:100159) on the shared list (D-070), at every
 * width in EN and AR: no page overflow, no raw i18n keys, the pager and its
 * Show All (the admin API caps per_page at 100), and the loading skeleton.
 * Mocked API in the real shape.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/qualifications');
const LIST = '**/api/v1/admin/qualification-skills?**';

const row = (id: number) => ({
  id, name: id % 2 ? `Excel level ${id}` : `مهارات التواصل ${id}`, courses_count: id % 3, enrolled_count: 28,
  job_titles_count: 3, learners_count: 32, certified_count: 28,
  completion_percent: id % 4 === 0 ? null : (id * 17) % 100, created_at: '2026-09-26 10:00:00',
});

async function mock(page: Page, locale: 'en' | 'ar'): Promise<URL[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  const calls: URL[] = [];
  await page.route(LIST, r => {
    const url = new URL(r.request().url());
    calls.push(url);
    const perPage = Number(url.searchParams.get('per_page'));
    const rows = Array.from({ length: Math.min(perPage, 32) }, (_, i) => row(i + 1));
    return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: 1, last_page: Math.ceil(32 / perPage), per_page: perPage, total: 32 } } });
  });
  return calls;
}

for (const locale of ['en', 'ar'] as const) {
  test(`qualifications fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const calls = await mock(page, locale);
    mkdirSync(ARTIFACTS, { recursive: true });

    await page.goto('/admin/qualifications');
    await expect(page.locator('.ql__row')).toHaveCount(15);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect((await page.locator('.cl-head').boundingBox())!.y).toBeLessThan(140);
    // Search only: the frame has no filters.
    await expect(page.locator('.nlt__filter')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const text = await page.locator('body').innerText();
    expect(text.match(/\b(qualifications|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });

    await page.locator('.cl-more').first().click();
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-menu.png`) });
    await page.keyboard.press('Escape');

    await page.locator('.nas-pager__all').click();
    await expect.poll(() => calls.at(-1)?.searchParams.get('per_page')).toBe('100');
    await expect(page.locator('.ql__row')).toHaveCount(32);
    expect(errors).toEqual([]);
  });
}

test('loading shows the table skeleton', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'one width is enough');
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', 'en'] as const);
  await page.route(LIST, () => new Promise(() => undefined)); // never answers
  await page.goto('/admin/qualifications');
  await expect(page.locator('tr[nasSkeletonRow]')).toHaveCount(6);
  await expect(page.locator('nas-table-card .ntc')).toHaveAttribute('aria-busy', 'true');
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: resolve(ARTIFACTS, 'desktop-1440-loading.png') });
});
