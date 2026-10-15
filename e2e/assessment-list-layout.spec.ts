import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Assignments / Quizzes list (the shared assessment-list), mocked API:
 * - NEW2B-6327: an item for many cohorts shows two cohort pills and "+N";
 *   every cohort is in the cell's title and screen-reader text.
 * - NEW2B-6325: the View All list shows each name only, wrapping, rows never
 *   overlapping.
 * - Long names wrap to two lines instead of pushing the table sideways.
 * At 375 / 768 / 1440.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/assessment-list-layout');
const ok = (result: unknown) => ({ status: 'success', message: '', result });
const page1 = (data: unknown[]) => ({ status: 'success', message: '', result: data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length } });
const LONG = 'Assignment 3 for course python 5 sessions gjdvsd hjvsdhj jhvsdjhcf jhvdwehj hjvaf ehjv Assignment 3 for course python 5 sessions gjdvsd hjvsdhj jhvsdjhcf';
const COHORTS = ['cohort 2', 'cohort 3', 'Course 4', 'COHORT 5', 'cohort 6'];

test('cohort pills, wrapped names and a clean View All list', async ({ page }, info) => {
  await page.route('**/api/v1/admin/assignments/summary', r => r.fulfill({ json: ok({ assignments_count: 2, courses_count: 1 }) }));
  const created = [
    { id: 3, title: LONG, title_ar: null, course_id: 1, course_title: 'Course python 5 sessions', cohort_scope: 'specific',
      cohorts: COHORTS.map((title, i) => ({ id: i + 1, title })), questions_count: 6, total_score: 128, pass_score: 60, status: 'active', type: 'pre', due_date: null, created_at: null },
    { id: 4, title: 'ASSIG 1', title_ar: null, course_id: 1, course_title: 'Course python 5 sessions', cohort_scope: 'all', cohorts: [],
      questions_count: 1, total_score: 100, pass_score: 50, status: 'active', type: 'post', due_date: null, created_at: null },
  ];
  // The Created table asks for the five newest; View All pages the same index ten at a time (D-113).
  await page.route('**/api/v1/admin/assignments?**', r => {
    const viewAll = new URL(r.request().url()).searchParams.get('per_page') === '10';
    return r.fulfill({ json: page1(viewAll ? [
      { ...created[0], course_title: 'Course python 5 sessions with a long course name too' },
      created[1],
      { ...created[1], id: 5, title: 'Final Project Intermediate Excel Course', course_title: 'Intermediate Excel Course' },
    ] : created) });
  });
  await page.route('**/api/v1/admin/assignments/submissions?**', r => r.fulfill({ json: page1([]) }));
  await page.route('**/api/v1/admin/assignments/submissions/filter-options', r => r.fulfill({ json: ok({ learners: [], instructors: [], items: [] }) }));
  await page.route('**/api/v1/admin/assignments/list**', r => r.fulfill({ json: ok([
    { id: 3, title: LONG, course_title: 'Course python 5 sessions with a long course name too' },
    { id: 4, title: 'ASSIG 1', course_title: 'Course python 5 sessions' },
    { id: 5, title: 'Final Project Intermediate Excel Course', course_title: 'Intermediate Excel Course' },
  ]) }));

  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await page.goto('/admin/assignments');
  const first = page.locator('.ql-table tbody tr').first();
  await expect(first).toContainText('Assignment 3', { timeout: 45_000 });

  // NEW2B-6327: two pills, "+3", the whole list for the reader.
  const pills = first.locator('.ql-pills');
  await expect(pills.locator('.ql-pill--specific')).toHaveCount(2);
  await expect(pills.locator('.ql-pill--more')).toHaveText('+3');
  await expect(pills).toHaveAttribute('title', COHORTS.join(', '));
  await expect(pills.locator('.cl-sr-only')).toHaveText(COHORTS.join(', '));

  // A long name wraps to at most two lines.
  const title = first.locator('.ql-title');
  const lineHeight = await title.evaluate(e => parseFloat(getComputedStyle(e).lineHeight) || 17);
  const box = (await title.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(lineHeight * 2 + 2);
  await expect(title).toHaveAttribute('title', LONG);

  mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: resolve(ARTIFACTS, `list-${info.project.name}.png`), fullPage: true });

  // NEW2B-6325: names only, no overlapping rows.
  await page.locator('.ql-outline').first().click();
  const rows = page.locator('.ql-modal-row');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('.ql-modal-pager')).toContainText('1–3 of 3');
  await expect(page.locator('.ql-modal-row__course')).toHaveCount(0);
  await expect(rows.nth(0)).not.toContainText('Course python 5 sessions with');
  const boxes = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ top: r.top, bottom: r.bottom })));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
  await page.screenshot({ path: resolve(ARTIFACTS, `view-all-${info.project.name}.png` ) });
});
