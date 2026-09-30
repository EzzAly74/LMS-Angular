import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Certificates (Figma 376:10149): the Issued Certificates table on the shared
 * list (D-070) - debounced, trimmed search; pager with Show All (the API caps
 * per_page at 200); loading, empty, no-results and error states; the row
 * download - at every width in EN and AR. Mocked API in the real shapes
 * (the rows sit in result.data).
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/certificates');
const LIST = '**/api/v1/admin/certificates?**';
const TOTAL = 26;

const cert = (i: number) => ({
  user_id: 100 + i, course_id: 8, type: 'exam', employee_id: `AHL-0${i}`,
  learner_name: i % 2 ? `Hesham Adly ${i}` : `هشام عدلي ${i}`, course_title: 'Management Course', issued_at: '2026-09-29 10:00:00',
});

const page_ = (perPage: number, page: number, total = TOTAL, search = '') => {
  const rows = search ? [] : Array.from({ length: Math.max(0, Math.min(perPage, total - (page - 1) * perPage)) }, (_, i) => cert((page - 1) * perPage + i + 1));
  const t = search ? 0 : total;
  return { status: 'success', message: '', result: { data: rows, current_page: page, last_page: Math.max(1, Math.ceil(t / perPage)), per_page: perPage, total: t, from: 1, to: rows.length } };
};

async function mock(page: Page, locale: 'en' | 'ar'): Promise<URL[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route('**/api/v1/admin/certificates/template/overview', r => r.fulfill({ json: { status: 'success', message: '', result: {
    template: { id: 1, name: 'Course certificate', has_file: true, mime_type: 'image/png', original_filename: 't.png' },
    stats: { total_issued: TOTAL, last_issued_at: '2026-09-29 10:00:00' }, fields: ['Learner name', 'Course title'],
  } } }));
  const calls: URL[] = [];
  await page.route(LIST, r => {
    const u = new URL(r.request().url());
    calls.push(u);
    return r.fulfill({ json: page_(Number(u.searchParams.get('per_page')), Number(u.searchParams.get('page')), TOTAL, u.searchParams.get('search') ?? '') });
  });
  return calls;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('search, pager, Show All and download', async ({ page }) => {
    const calls = await mock(page, 'en');
    let downloads = 0;
    await page.route('**/api/v1/admin/certificates/*/*/download', r => { downloads++; return r.fulfill({ body: 'jpg', headers: { 'content-type': 'image/jpeg' } }); });
    await page.goto('/admin/certificates');

    const rows = page.locator('.cert-table__row');
    await expect(rows).toHaveCount(20);
    await expect(page.locator('.nas-pager__info')).toContainText(`of ${TOTAL}`);
    expect(calls.at(-1)!.searchParams.get('per_page')).toBe('20');

    await page.locator('.nas-pager__btn--next').click();
    await expect(rows).toHaveCount(6);
    expect(calls.at(-1)!.searchParams.get('page')).toBe('2');

    await page.locator('.nas-pager__all').click();
    await expect(rows).toHaveCount(TOTAL);
    expect(calls.at(-1)!.searchParams.get('per_page')).toBe('200');

    const dl = page.waitForEvent('download');
    await rows.first().getByRole('button', { name: /Hesham Adly 1$/ }).click();
    await dl;
    expect(downloads).toBe(1);

    // Debounced and trimmed; a search goes back to page 1 and says when nothing matches.
    await page.getByLabel('Search certificates...').fill('  zzz ');
    await expect.poll(() => calls.at(-1)!.searchParams.get('search')).toBe('zzz');
    expect(calls.at(-1)!.searchParams.get('page')).toBe('1');
    await expect(page.locator('nas-list-state')).toContainText('No certificates found.');
  });

  test('loading shows the skeleton; a failed load offers Try again', async ({ page }) => {
    await mock(page, 'en');
    let mode: 'hang' | 'fail' | 'ok' = 'hang';
    await page.route(LIST, r => mode === 'hang' ? new Promise(() => undefined) : mode === 'fail'
      ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fallback());
    await page.goto('/admin/certificates');
    await expect(page.locator('tr[nasSkeletonRow]')).toHaveCount(6);
    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, 'desktop-1440-loading.png') });

    mode = 'fail';
    await page.getByLabel('Search certificates...').fill('x');
    await expect(page.locator('nas-list-state [role=alert]')).toBeVisible();
    mode = 'ok';
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.cert-table__row')).toHaveCount(0);
    await expect(page.locator('nas-list-state')).toContainText('No certificates found.');
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`certificates fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await mock(page, locale);
    mkdirSync(ARTIFACTS, { recursive: true });

    await page.goto('/admin/certificates');
    await expect(page.locator('.cert-table__row')).toHaveCount(20);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('.nlt__filter')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const text = await page.locator('body').innerText();
    expect(text.match(/\b(certificates|common|quizzes)\.[a-z_][a-z_.]*/g) ?? []).toEqual([]);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
