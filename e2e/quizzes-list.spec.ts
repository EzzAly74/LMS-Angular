import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Quizzes landing (Figma 1983:42584) and its Quiz Type modal (1981:41345),
 * D-065: Pre / Mid / Post type column + filter, All / Passed / Failed, score
 * coloured by pass. Mocked API in the real resource shapes.
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
  await page.route('**/api/v1/admin/quizzes/summary', r => r.fulfill({ json: ok({ quizzes_count: 1, courses_count: 1 }) }));
  await page.route('**/api/v1/admin/quizzes?**', r => r.fulfill({ json: page1([{
    id: 3, title: 'Knowledge Check Quiz', title_ar: null, course_id: 1, course_title: 'Workplace Safety Essentials', cohort_scope: 'all', cohorts: [],
    questions_count: 6, total_score: 100, pass_score: 60, status: 'active', type: 'pre', due_date: '2026-05-31', created_at: null,
  }]) }));
  await page.route('**/api/v1/admin/quizzes/submissions?**', r => {
    lists.push(r.request());
    return r.fulfill({ json: page1([row(1, 'Layla Hassan', 'pre', 92, true), row(2, 'Omar Al-Farsi', 'post', 40, false), row(3, 'Fatima Al-Rashidi', 'mid', null, null, 'pending')]) });
  });
  return lists;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('type column + modal, passed / failed filter, pass colours', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const lists = await mock(page);
    await page.goto('/admin/quizzes');

    await expect(page.getByText('All learner quiz attempts across all courses')).toBeVisible();
    const table = page.locator('.ql-table').nth(1);
    await expect(table.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
    await expect(table.getByRole('row').nth(1)).toContainText('Pre');
    await expect(table.locator('.ql-score--high')).toHaveText(/92%/);
    await expect(table.locator('.ql-score--low')).toHaveText(/40%/);
    await expect(table.getByText('Pending')).toBeVisible();

    // Passed / Failed.
    await page.getByLabel('Passed').check();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.get('result')).toBe('passed');
    await page.getByLabel('Failed').check();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.get('result')).toBe('failed');
    await page.getByLabel('Failed').uncheck();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.has('result')).toBe(false);

    // Quiz Type modal (1981:41345): View results disabled until a choice.
    await page.getByRole('button', { name: /^Type/ }).click();
    const d = page.getByRole('dialog', { name: 'Quiz Type' });
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'View results' })).toBeDisabled();
    await d.getByLabel('Pre-course').check();
    await d.getByLabel('Post-course').check();
    await d.getByRole('button', { name: 'View results' }).click();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.getAll('types[]')).toEqual(['pre', 'post']);
    await expect(page.getByRole('button', { name: /^Type/ }).locator('.ql-pill-btn__count')).toHaveText('2');

    // All clears it.
    await page.getByRole('button', { name: 'All', exact: true }).first().click();
    await expect.poll(() => new URL(lists.at(-1)!.url()).searchParams.getAll('types[]')).toEqual([]);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`quizzes page fits and reads ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await mock(page);
    await page.goto('/admin/quizzes');
    await expect(page.locator('.ql-table').nth(1).getByRole('row')).toHaveCount(4);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const text = await page.locator('body').innerText();
    expect(text.match(/\b(quizzes|common)\.[a-z_.]+/g) ?? []).toEqual([]);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });
    await page.getByRole('button', { name: locale === 'en' ? /^Type/ : /^النوع/ }).click();
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-type.png`) });
    expect(errors).toEqual([]);
  });
}
