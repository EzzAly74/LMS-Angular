import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Job Titles index (D1b, Figma 2078:102691) and its Filter modal (2463:138054)
 * against a mocked API in the real response shapes. The layout at every width
 * and language is checked here too, because the dev database's cards and the
 * open modal are not what layout.spec.ts sees.
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/job-title-list');

const card = (id: number, name: string, compliance: number) => ({
  id, name, employees_count: 140, learners_count: 124, qualifications_count: 2, compliance_percent: compliance,
});

async function mockIndex(page: Page): Promise<{ lists: Request[]; learnerSearches: string[] }> {
  const lists: Request[] = [];
  const learnerSearches: string[] = [];
  await page.route('**/api/v1/admin/job-titles?**', (r) => {
    lists.push(r.request());
    const filtered = new URL(r.request().url()).searchParams.has('learner_id');
    const rows = filtered ? [card(2, 'Sales Representative', 81)] : [card(1, 'HR Specialist', 91), card(2, 'Sales Representative', 81), card(3, 'Product Designer', 21)];
    return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: 1, last_page: 1, per_page: 12, total: rows.length } } });
  });
  await page.route('**/api/v1/admin/job-titles/learner-options**', (r) => {
    learnerSearches.push(new URL(r.request().url()).searchParams.get('search') ?? '');
    return r.fulfill({ json: { status: 'success', message: '', result: [{ id: 7, name: 'Ava Chen', employee_id: 'AC-2048' }, { id: 8, name: 'Liam Patel', employee_id: null }] } });
  });
  await page.route('**/api/v1/qualification-skills/active', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: [{ id: 21, name: 'Safety' }, { id: 22, name: 'First Aid' }] } }));
  return { lists, learnerSearches };
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('search, filter by qualification and learner, clear; no per-card assign', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const { lists, learnerSearches } = await mockIndex(page);
    await page.goto('/admin/job-titles');

    await expect(page.locator('.jt-card')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Assign Qualification/i })).toHaveCount(0);
    await expect(page.getByLabel('Search job titles')).toHaveAttribute('placeholder', 'Search by learner or job title...');

    await page.getByLabel('Search job titles').fill('ava');
    await expect.poll(() => lists.at(-1)?.url() ?? '').toContain('search=ava');
    await page.getByLabel('Search job titles').fill('');
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.has('search')).toBe(false);

    await page.getByRole('button', { name: 'Filter' }).click();
    const d = page.getByRole('dialog');
    await expect(d.getByRole('button', { name: 'Filter' })).toBeDisabled();

    // Qualification: several choices (Figma annotation "multi select + search").
    await d.locator('.p-multiselect').click();
    await page.getByRole('option', { name: 'Safety' }).click();
    await page.getByRole('option', { name: 'First Aid' }).click();
    // Escape closes the list only; the modal and its choices stay.
    await page.keyboard.press('Escape');
    await expect(page.locator('.p-multiselect-panel')).toHaveCount(0);
    await expect(d).toBeVisible();

    // Learner: searched on the server.
    await d.locator('.p-dropdown').click();
    await page.locator('.p-dropdown-filter').fill('ava');
    await expect.poll(() => learnerSearches.at(-1)).toBe('ava');
    await page.getByRole('option', { name: 'Ava Chen (AC-2048)' }).click();

    await d.getByRole('button', { name: 'Filter' }).click();
    await expect(d).toBeHidden();
    const params = new URL(lists.at(-1)!.url()).searchParams;
    expect(params.getAll('qualification_ids[]').sort()).toEqual(['21', '22']);
    expect(params.get('learner_id')).toBe('7');
    await expect(page.locator('.nlt__badge')).toHaveText('2');
    await expect(page.locator('.jt-card')).toHaveCount(1);

    // Reopening shows what is applied; Clear removes every filter at once.
    await page.getByRole('button', { name: /Filter/ }).first().click();
    await expect(page.getByRole('dialog').getByText('Ava Chen (AC-2048)')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
    const cleared = new URL(lists.at(-1)!.url()).searchParams;
    expect(cleared.has('learner_id')).toBe(false);
    expect(cleared.has('qualification_ids[]')).toBe(false);
    await expect(page.locator('.nlt__badge')).toHaveCount(0);

    // With no list open, Escape closes the modal as usual.
    await page.locator('.nlt__filter').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('a failed load offers a retry', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    await mockIndex(page);
    let fail = true;
    await page.route('**/api/v1/admin/job-titles?**', (r) =>
      fail ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fallback());
    await page.goto('/admin/job-titles');
    await expect(page.locator('nas-list-state [role=alert]')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.jt-card')).toHaveCount(3);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`index and filter modal fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await mockIndex(page);
    await page.goto('/admin/job-titles');
    await expect(page.locator('.jt-card')).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    const width = page.viewportSize()?.width ?? 0;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // The Filter button sits at the search's inline end (Figma); on a phone
    // the search takes its own full row above it instead.
    const [search, filter] = await Promise.all([page.locator('.nlt__search').boundingBox(), page.locator('.nlt__filter').boundingBox()]);
    if (width < 480) {
      expect(filter!.y).toBeGreaterThan(search!.y + search!.height - 1);
      expect(search!.width).toBeGreaterThan(200);
    } else {
      expect(Math.abs(search!.y - filter!.y)).toBeLessThanOrEqual(1);
      if (locale === 'en') expect(filter!.x).toBeGreaterThan(search!.x);
      else expect(filter!.x).toBeLessThan(search!.x);
    }
    // Compliance tones as drawn: 91% high, 81% mid, 21% low.
    await expect(page.locator('.jt-compliance__value')).toHaveClass([/--high/, /--mid/, /--low/]);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });

    await page.locator('.nlt__filter').click();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-filter.png`) });

    const text = await page.locator('body').innerText();
    expect(text.match(/\b(job_titles|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    expect(errors).toEqual([]);
  });
}
