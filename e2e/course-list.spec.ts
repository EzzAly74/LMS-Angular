import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * All Courses (Figma 2393:123975) and its Filter modal (2430:135164, with the
 * multi-select list 2430:134497) against a mocked API in the real response
 * shapes (CourseResource).
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/course-list');

interface Row {
  id: number; title: string; type: string; category: string; instructor: string;
  cohorts: number; users: number; completion: number; score: number | null; status: string; updated: string;
}

const ROWS: Row[] = [
  { id: 1, title: 'Workplace Safety Essentials', type: 'hybrid', category: 'Safety', instructor: 'Nora Al-Fahad', cohorts: 3, users: 58, completion: 72, score: 4.3, status: 'active', updated: '2026-05-10' },
  { id: 2, title: 'Leadership Fundamentals', type: 'online', category: 'Management', instructor: 'Karim Mansour', cohorts: 2, users: 22, completion: 55, score: 4.7, status: 'active', updated: '2026-05-08' },
  { id: 3, title: 'New Employee Onboarding', type: 'hybrid', category: 'HR', instructor: 'Sara Al-Mansouri', cohorts: 1, users: 15, completion: 90, score: 4.8, status: 'active', updated: '2026-05-05' },
  { id: 4, title: 'GDPR & Data Privacy', type: 'online', category: 'Compliance', instructor: 'Ahmed Al-Rashidi', cohorts: 2, users: 12, completion: 41, score: 3.9, status: 'active', updated: '2026-04-30' },
  { id: 5, title: 'Fire Safety Training', type: 'offline', category: 'Safety', instructor: 'Nora Al-Fahad', cohorts: 3, users: 18, completion: 33, score: 2.1, status: 'active', updated: '2026-04-28' },
  { id: 6, title: 'Excel for Operations', type: 'online', category: 'IT & Digital', instructor: 'Mohammed Khalid', cohorts: 1, users: 0, completion: 0, score: null, status: 'upcoming', updated: '2026-05-14' },
  { id: 7, title: 'Project Management Basics', type: 'online', category: 'Management', instructor: 'Karim Mansour', cohorts: 0, users: 0, completion: 0, score: null, status: 'inactive', updated: '2026-05-12' },
  { id: 8, title: 'ISO 45001 Overview', type: 'external_link', category: 'Safety', instructor: 'Nora Al-Fahad', cohorts: 1, users: 24, completion: 91, score: 4.5, status: 'inactive', updated: '2026-03-01' },
];

const raw = (r: Row) => ({
  id: r.id, title: { en: r.title, ar: r.title }, course_type: r.type, type: r.type, status: r.status, active: r.status === 'active',
  category: { id: r.id * 10, name: r.category }, instructors: [{ id: r.id * 100, name: r.instructor }],
  cohorts_count: r.cohorts, users_count: r.users, completion_percent: r.completion, evaluation_score: r.score,
  created_at: r.updated, updated_at: r.updated,
});

async function mockList(page: Page, total = 109): Promise<{ lists: Request[] }> {
  const lists: Request[] = [];
  await page.route(/\/api\/v1\/courses(\?.*)?$/, (r) => {
    const url = new URL(r.request().url());
    const perPage = Number(url.searchParams.get('per_page') ?? 15);
    // The Course field's own search asks for 20 at a time.
    if (perPage === 20) {
      const term = (url.searchParams.get('search') ?? '').toLowerCase();
      const rows = ROWS.filter(x => x.title.toLowerCase().includes(term)).map(raw);
      return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: 1, last_page: 1, per_page: 20, total: rows.length } } });
    }
    lists.push(r.request());
    const filtered = url.searchParams.has('statuses[]') || url.searchParams.has('ids[]');
    const rows = (filtered ? ROWS.slice(5, 7) : ROWS).map(raw);
    const count = filtered ? rows.length : total;
    return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: Number(url.searchParams.get('page') ?? 1), last_page: Math.ceil(count / perPage), per_page: perPage, total: count, from: 1, to: Math.min(perPage, count) } } });
  });
  await page.route('**/api/v1/categories/active', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: [{ id: 11, name: 'Tech' }, { id: 12, name: 'Marketing' }, { id: 13, name: 'Call Center' }, { id: 14, name: 'Video editing' }, { id: 15, name: 'Safety' }] } }));
  await page.route('**/api/v1/instructors/all', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: [{ id: 101, name: 'Nora Al-Fahad' }, { id: 102, name: 'Karim Mansour' }] } }));
  return { lists };
}

const setLocale = (page: Page, locale: 'en' | 'ar') =>
  page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('rows read as drawn; no status tabs', async ({ page }) => {
    await setLocale(page, 'en');
    await mockList(page);
    await page.goto('/admin/courses');

    const rows = page.locator('.cl-row');
    await expect(rows).toHaveCount(8);
    await expect(page.locator('nas-pill-tabs')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Last Status' })).toBeVisible();

    const first = rows.first();
    await expect(first.locator('.cc-course__title')).toHaveText('Workplace Safety Essentials');
    await expect(first.locator('.cc-course__date')).toHaveText('Updated 10 May 2026');
    await expect(first.locator('.cc-progress__value')).toHaveText('72%');
    await expect(first.locator('.cc-progress__track')).toHaveAttribute('aria-valuenow', '72');
    await expect(first.locator('.cc-score')).toHaveText('4.3');

    // Completion colours: 72 blue, 90 green, 41 red; failing score in red; no score is a dash.
    await expect(rows.nth(0).locator('.cc-progress__fill')).toHaveClass(/--mid/);
    await expect(rows.nth(2).locator('.cc-progress__fill')).toHaveClass(/--full/);
    await expect(rows.nth(3).locator('.cc-progress__fill')).toHaveClass(/--low/);
    await expect(rows.nth(4).locator('.cc-score')).toHaveClass(/cc-score--fail/);
    await expect(rows.nth(5).locator('.cc-score')).toHaveText('—');

    // External link is orange, Up Coming orange, Inactive red.
    await expect(rows.nth(7).locator('.nas-badge').first()).toHaveAttribute('data-tone', 'warning');
    await expect(rows.nth(5).locator('.nas-badge').last()).toHaveAttribute('data-tone', 'warning');
    await expect(rows.nth(6).locator('.nas-badge').last()).toHaveAttribute('data-tone', 'danger');

    await expect(page.locator('nas-pager')).toContainText('1–15 of 109');

    // The row menu opens without navigating; the title link navigates.
    await first.getByRole('button', { name: 'Actions for Workplace Safety Essentials' }).click();
    await expect(page.getByRole('menuitem', { name: /View Details/i })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/courses$/);
  });

  test('search, multi filters, show all, clear', async ({ page }) => {
    await setLocale(page, 'en');
    const { lists } = await mockList(page);
    await page.goto('/admin/courses');
    await expect(page.locator('.cl-row')).toHaveCount(8);

    await page.getByLabel('Search courses').fill('safety');
    await expect.poll(() => lists.at(-1)?.url() ?? '').toContain('search=safety');
    await page.getByLabel('Search courses').fill('');
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.has('search')).toBe(false);

    await page.getByRole('button', { name: 'Filter' }).click();
    const d = page.getByRole('dialog');
    await expect(d.getByRole('button', { name: 'Filter' })).toBeDisabled();
    await expect(d.locator('.fd__label')).toHaveText(['Course', 'Category', 'Instructor', 'Evaluation', 'Status']);

    // Course: searched on the server, several at once; the panel counts and clears.
    await d.locator('.p-multiselect').nth(0).click();
    const panel = page.locator('.fd-ms-panel');
    await expect(panel.locator('.fd-ms-summary')).toContainText('0 selected');
    await expect(panel.locator('.p-multiselect-filter')).toHaveAttribute('placeholder', 'Search courses...');
    await panel.locator('.p-multiselect-filter').fill('excel');
    await expect(page.getByRole('option', { name: 'Excel for Operations' })).toBeVisible();
    await page.getByRole('option', { name: 'Excel for Operations' }).click();
    await expect(panel.locator('.fd-ms-summary')).toContainText('1 selected');
    await panel.getByRole('button', { name: 'Clear search' }).click();
    await page.getByRole('option', { name: 'Project Management Basics' }).click();
    await expect(panel.locator('.fd-ms-summary')).toContainText('2 selected');
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();

    // Category (local list), Evaluation and Status.
    await d.locator('.p-multiselect').nth(1).click();
    await page.getByRole('option', { name: 'Tech' }).click();
    await page.getByRole('option', { name: 'Marketing' }).click();
    await page.keyboard.press('Escape');
    await d.locator('.p-multiselect').nth(3).click();
    await page.getByRole('option', { name: 'Not evaluated yet' }).click();
    await page.keyboard.press('Escape');
    await d.locator('.p-multiselect').nth(4).click();
    await page.getByRole('option', { name: 'Up Coming' }).click();
    await page.getByRole('option', { name: 'Inactive' }).click();
    await page.keyboard.press('Escape');

    await d.getByRole('button', { name: 'Filter' }).click();
    await expect(d).toBeHidden();
    const p = new URL(lists.at(-1)!.url()).searchParams;
    expect(p.getAll('ids[]').sort()).toEqual(['6', '7']);
    expect(p.getAll('category_ids[]').sort()).toEqual(['11', '12']);
    expect(p.getAll('evaluation[]')).toEqual(['none']);
    expect(p.getAll('statuses[]').sort()).toEqual(['inactive', 'upcoming']);
    expect(p.get('page')).toBe('1');
    await expect(page.locator('.nlt__badge')).toHaveText('4');
    await expect(page.locator('.cl-row')).toHaveCount(2);

    // Reopened, the chosen courses keep their names.
    await page.locator('.nlt__filter').click();
    await expect(d.locator('.p-multiselect').nth(0)).toContainText('2 selected');
    await d.getByRole('button', { name: 'Clear' }).click();
    const cleared = new URL(lists.at(-1)!.url()).searchParams;
    for (const k of ['ids[]', 'category_ids[]', 'evaluation[]', 'statuses[]']) expect(cleared.has(k)).toBe(false);
    await expect(page.locator('.nlt__badge')).toHaveCount(0);

    // Show All: one page of up to 200.
    await page.getByRole('button', { name: 'Show All' }).click();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.get('per_page')).toBe('200');
  });

  test('a failed load offers a retry', async ({ page }) => {
    await setLocale(page, 'en');
    await mockList(page);
    let fail = true;
    await page.route(/\/api\/v1\/courses\?/, (r) => (fail ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fallback()));
    await page.goto('/admin/courses');
    await expect(page.locator('nas-list-state [role=alert]')).toContainText('The courses could not be loaded.');
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.cl-row')).toHaveCount(8);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`list, filter modal and open list fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setLocale(page, locale);
    await mockList(page);
    await page.goto('/admin/courses');
    await expect(page.locator('.cl-row')).toHaveCount(8);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    const width = page.viewportSize()?.width ?? 0;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (width >= 1440) {
      // Figma: 36 px toolbar, header row 45 px, pager buttons 44 px.
      expect((await page.locator('.nlt__search').boundingBox())!.height).toBe(36);
      expect((await page.locator('.nlt__filter').boundingBox())!.width).toBeGreaterThanOrEqual(124);
      expect(Math.round((await page.locator('.cc-table thead tr').boundingBox())!.height)).toBe(45);
      expect((await page.locator('.cl-primary').boundingBox())!.height).toBe(44);
    }

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });

    await page.locator('.nlt__filter').click();
    const dialog = page.getByRole('dialog');
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (width >= 768) {
      // Status spans both columns.
      const [course, status] = await Promise.all([dialog.locator('.fd__field').nth(0).boundingBox(), dialog.locator('.fd__field').nth(4).boundingBox()]);
      expect(status!.width).toBeGreaterThan(course!.width * 1.8);
    }
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-filter.png`) });

    await dialog.locator('.p-multiselect').nth(1).click();
    await expect(page.locator('.fd-ms-panel .p-multiselect-item')).toHaveCount(5);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-filter-list.png`) });

    const text = await page.locator('body').innerText();
    expect(text.match(/\b(courses_list|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    expect(errors).toEqual([]);
  });
}
