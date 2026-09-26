import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Learner detail (D3, Figma 2181:115043) with every state populated.
 *
 * Few dev learners have course activity, and none has a completed course or
 * a failed quiz, so the three endpoints are answered from a fixture in the
 * real response shape (ApiResponse::success / ::paginated). The fixture lives
 * only in this test. layout.spec.ts visits the real route as well.
 */

const LOCALE_KEY = '2b_locale';
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/learner-detail-fixture');
const BASE = '**/api/v1/admin/learners/4242';

const PROFILE = {
  profile: {
    id: 4242, name: 'Fixture Learner', job_title: 'Fixture Analyst', employee_id: 'L-4242',
    email: 'fixture@example.test', department: 'Fixture Department', image_url: null, status: 'active',
    last_active_at: '2026-09-20T10:00:00+03:00', last_active_course: 'Fixture Course A',
  },
  tiles: {
    completed_courses: 1, active_courses: 2, active_course_progress_percent: 88.3,
    last_quiz: { score: 100, max: 105, status: 'passed', submitted_at: '2026-09-19T10:00:00+03:00' },
    earned_qualifications: 1,
  },
};

const course = (n: number, status: 'completed' | 'active', attended: number, scheduled: number) => ({
  course_id: n, course: `Fixture Course ${String.fromCharCode(64 + n)}`, cohort: 'Fixture Cohort', cohort_id: 10 + n,
  qualifications: [{ id: 1, name: 'Fixture Qualification' }], attended, absent: scheduled - attended,
  sessions_scheduled: scheduled, status, progress_percent: scheduled ? Math.round((attended * 100) / scheduled) : null,
  started_on: '2026-01-01', ended_on: '2026-12-31', enrolled_at: '2026-01-01 09:00:00',
});
const COURSES = [course(1, 'active', 4, 5), course(2, 'active', 3, 5), course(3, 'completed', 5, 5), course(4, 'active', 0, 5), course(5, 'active', 1, 5), course(6, 'active', 2, 5)];

const PERFORMANCE = [
  { id: 31, kind: 'quiz', name: 'Fixture Quiz', course: 'Fixture Course A', type: 'pre', score: 108, max_score: 120, grade_label: '108/120', status: 'pass', last_updated: '2026-06-03' },
  { id: 32, kind: 'assignment', name: 'Fixture Assignment', course: 'Fixture Course A', type: 'assignment', score: 70, max_score: 120, grade_label: '70/120', status: 'failed', last_updated: '2026-05-03' },
  { id: 33, kind: 'assignment', name: 'Fixture Draft', course: 'Fixture Course B', type: 'assignment', score: null, max_score: null, grade_label: null, status: 'needs_review', last_updated: '2026-04-01' },
];

function paged<T>(rows: T[], url: string) {
  const q = new URL(url).searchParams;
  const page = Number(q.get('page') ?? '1');
  const per = Number(q.get('per_page') ?? '4');
  return {
    status: 'success', message: '', result: rows.slice((page - 1) * per, page * per),
    meta: { current_page: page, last_page: Math.ceil(rows.length / per), per_page: per, total: rows.length },
  };
}

async function answer(page: Page, calls: string[]): Promise<void> {
  await page.route(`${BASE}/courses**`, (r) => { calls.push('courses:' + new URL(r.request().url()).searchParams.get('page')); return r.fulfill({ json: paged(COURSES, r.request().url()) }); });
  await page.route(`${BASE}/performance**`, (r) => { calls.push('performance:' + new URL(r.request().url()).searchParams.get('page')); return r.fulfill({ json: paged(PERFORMANCE, r.request().url()) }); });
  await page.route(BASE, (r) => r.fulfill({ json: { status: 'success', message: '', result: PROFILE } }));
}

for (const locale of [{ code: 'en', dir: 'ltr' }, { code: 'ar', dir: 'rtl' }] as const) {
  test(`learner detail - ${locale.code}`, async ({ page }, testInfo) => {
    const calls: string[] = [];
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale.code] as const);
    await answer(page, calls);
    await page.goto('/admin/learners/4242');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
    await expect(page.locator('.ld__title')).toHaveText('Fixture Learner');
    await expect(page.locator('.ld__tile dd')).toHaveText(['1', '2', '88.3%', '100/105', '1']);

    const courseStatuses = page.locator('.ld__table--courses nas-status-badge');
    const perfStatuses = page.locator('.ld__table--performance nas-status-badge');
    if (locale.code === 'en') {
      await expect(courseStatuses).toHaveText(['In Progress', 'In Progress', 'Completed', 'Not started']);
      await expect(perfStatuses).toHaveText(['Pass', 'Failed', 'Needs Review']);
      await expect(page.locator('.ld__table--performance tbody tr').nth(0).locator('td').nth(2)).toHaveText('Pre');
    } else {
      await expect(courseStatuses).toHaveText(['قيد التقدم', 'قيد التقدم', 'مكتملة', 'لم تبدأ']);
      await expect(perfStatuses).toHaveText(['ناجح', 'راسب', 'بحاجة إلى مراجعة']);
    }

    // A failed grade is red; an ungraded one shows "---", never a fake 0.
    const grades = page.locator('.ld__table--performance tbody tr td:nth-child(4)');
    await expect(grades.nth(1)).toHaveClass(/ld__failed/);
    await expect(grades.nth(2)).toHaveText('---');

    // Preview goes to the existing pages for each kind of row.
    await expect(page.locator('.ld__table--courses .ld__eye').first()).toHaveAttribute('href', '/admin/courses/1');
    await expect(page.locator('.ld__table--performance .ld__eye').nth(0)).toHaveAttribute('href', '/admin/quizzes/submissions/31');
    await expect(page.locator('.ld__table--performance .ld__eye').nth(1)).toHaveAttribute('href', '/admin/assignments/submissions/32');

    // No page-level horizontal scroll at any width; wide tables scroll in their card.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${testInfo.project.name}-${locale.code}.png`), fullPage: true });

    // The two tables page independently: paging courses does not refetch performance.
    const before = calls.filter((c) => c.startsWith('performance')).length;
    await page.locator('.ld__table-card').first().locator('.nas-pager__btn--next').click();
    await expect(page.locator('.ld__table--courses tbody tr')).toHaveCount(2);
    expect(calls).toContain('courses:2');
    expect(calls.filter((c) => c.startsWith('performance')).length).toBe(before);
  });
}

test('a learner that does not exist shows the not-found state', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  await page.route('**/api/v1/admin/learners/999999**', (r) => r.fulfill({ status: 404, json: { status: 'error', message: 'Not found' } }));
  await page.goto('/admin/learners/999999');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.ld__title')).toHaveText('Learner not found');
  await expect(page.getByRole('link', { name: 'Back to learners' })).toHaveAttribute('href', '/admin/learners');
});
