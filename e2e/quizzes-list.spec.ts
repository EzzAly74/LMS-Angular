import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Quizzes landing (Figma 1983:42584), D-065: the Pre / Mid / Post type column,
 * score coloured by pass, and the Dashboard's one filter pattern (D-070): the
 * All Courses Filter button and modal with Course, Instructor, Learner, Type
 * and Result. Mocked API in the real resource shapes.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/quizzes-list');
const ok = (result: unknown) => ({ status: 'success', message: '', result });
const page1 = (data: unknown[]) => ({ status: 'success', message: '', result: data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length } });

const row = (id: number, name: string, type: 'pre' | 'mid' | 'post' | null, pct: number | null, passed: boolean | null, status: 'graded' | 'pending' = 'graded') => ({
  id, quiz: { id: 3, title: 'Knowledge Check Quiz', course_id: 1, type }, quiz_title: 'Knowledge Check Quiz', quiz_type: type,
  course_title: 'Workplace Safety Essentials', instructor_name: 'Nora Al-Fahad', cohort_titles: [], learner_cohort: null,
  user: { id: id + 100, name, machine_code: null, department_name: null },
  total_score: pct === null ? null : pct / 5, max_score: 20, score_percent: pct, passed, attempts: 1, status,
  submitted_at: '2026-05-16 10:00:00', reviewed_at: null, created_at: '2026-05-16 10:00:00',
});

async function mock(page: Page): Promise<Request[]> {
  const lists: Request[] = [];
  await page.route('**/api/v1/admin/quizzes/instructors', r => r.fulfill({ json: ok([{ id: 7, name: 'Nora Al-Fahad' }, { id: 8, name: 'Karim Mansour' }]) }));
  await page.route('**/api/v1/admin/quizzes/summary', r => r.fulfill({ json: ok({ quizzes_count: 1, courses_count: 1 }) }));
  await page.route('**/api/v1/admin/quizzes?**', r => r.fulfill({ json: page1([{
    id: 3, title: 'Knowledge Check Quiz', title_ar: null, course_id: 1, course_title: 'Workplace Safety Essentials', cohort_scope: 'all', cohorts: [],
    questions_count: 6, total_score: 100, pass_score: 60, status: 'active', type: 'pre', due_date: '2026-05-31', created_at: null,
  }]) }));
  await page.route('**/api/v1/admin/quizzes/submissions?**', r => {
    lists.push(r.request());
    return r.fulfill({ json: page1([row(1, 'Layla Hassan', 'pre', 92, true), row(2, 'Omar Al-Farsi', 'post', 40, false), row(3, 'Fatima Al-Rashidi', 'mid', null, null, 'pending')]) });
  });
  await page.route('**/api/v1/admin/quizzes/submissions/filter-options', r => r.fulfill({ json: ok({
    learners: [{ id: 101, name: 'Layla Hassan' }, { id: 102, name: 'Omar Al-Farsi' }],
    instructors: [{ id: 7, name: 'Nora Al-Fahad' }],
    items: [],
  }) }));
  await page.route(/\/api\/v1\/courses\?/, r => r.fulfill({ json: page1([{ id: 1, title: 'Workplace Safety Essentials' }]) }));
  return lists;
}

/**
 * Close an open multi-select list and nothing else (the Filter modal stays).
 * PrimeNG ignores a close that lands while the list is still animating open,
 * which a test (unlike a person) can do; wait for it to settle first.
 */
async function closeList(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.fd-ms-panel');
    return !!el && el.getAnimations({ subtree: true }).length === 0;
  });
  await page.locator('.fd-ms-panel .p-multiselect-filter').press('Escape');
  await expect(page.locator('.fd-ms-panel')).toHaveCount(0);
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('type column + modal, passed / failed filter, pass colours', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const lists = await mock(page);
    await page.goto('/admin/quizzes');

    await expect(page.getByText('All learner quiz attempts across all courses')).toBeVisible();
    const table = page.locator('.ql-table--attempts');
    await expect(table.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
    await expect(table.getByRole('row').nth(1)).toContainText('Pre');
    await expect(table.locator('.ql-score.cl-pass')).toHaveText(/92%/);
    await expect(table.locator('.ql-score.cl-fail')).toHaveText(/40%/);
    await expect(table.getByText('Pending')).toBeVisible();

    // No empty band above the page head (the page host is not a flex column).
    const head = await page.locator('.cl-head').boundingBox();
    expect(head!.y).toBeLessThan(140);
    // The frame's chips and Passed / Failed checks are gone: one Filter button, as on All Courses.
    await expect(page.locator('.ql-chip')).toHaveCount(0);
    await expect(page.getByLabel('Passed')).toHaveCount(0);

    // The lists load when the modal first opens; wait for them before opening one.
    const lookups = Promise.all([
      page.waitForResponse('**/api/v1/admin/quizzes/instructors'),
      page.waitForResponse('**/api/v1/admin/quizzes/submissions/filter-options'),
    ]);
    await page.getByRole('button', { name: 'Filter' }).click();
    await lookups;
    const d = page.getByRole('dialog', { name: 'Filter' });
    await expect(d.locator('.fd__label')).toHaveText(['Courses', 'Instructors', 'Learners', 'Type', 'Result']);
    await expect(d.getByRole('button', { name: 'Filter' })).toBeDisabled();

    // Instructors come from the kind's own instructors endpoint (not empty).
    await d.locator('.p-multiselect').nth(1).click();
    await expect(page.locator('.fd-ms-panel li.p-multiselect-item')).toHaveText(['Nora Al-Fahad', 'Karim Mansour']);
    await closeList(page);

    // Type: several at once.
    await d.locator('.p-multiselect').nth(3).click();
    await page.getByRole('option', { name: 'Pre-course' }).click();
    await page.getByRole('option', { name: 'Post-course' }).click();
    await closeList(page);
    // Result: one of Passed / Failed.
    await d.locator('.p-dropdown').first().click();
    await page.getByRole('option', { name: 'Passed' }).click();
    // Learner: the list comes from the filter options, across all courses.
    await d.locator('.p-multiselect').nth(2).click();
    await page.getByRole('option', { name: 'Omar Al-Farsi' }).click();
    await closeList(page);

    await d.getByRole('button', { name: 'Filter' }).click();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.getAll('types[]')).toEqual(['pre', 'post']);
    const url = new URL(lists.at(-1)!.url());
    expect(url.searchParams.get('result')).toBe('passed');
    expect(url.searchParams.getAll('learner_ids[]')).toEqual(['102']);
    await expect(page.locator('.nlt__badge')).toHaveText('3');

    // Clear empties every field at once.
    await page.locator('.nlt__filter').click();
    await page.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.has('result')).toBe(false);
    expect(new URL(lists.at(-1)!.url()).searchParams.getAll('types[]')).toEqual([]);
    await expect(page.locator('.nlt__badge')).toHaveCount(0);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`quizzes page fits and reads ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await mock(page);
    await page.goto('/admin/quizzes');
    await expect(page.locator('.ql-table--attempts').getByRole('row')).toHaveCount(4);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const text = await page.locator('body').innerText();
    expect(text.match(/\b(quizzes|common)\.[a-z_.]+/g) ?? []).toEqual([]);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });
    await page.locator('.nlt__filter').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-filter.png`) });
    expect(errors).toEqual([]);
  });
}
