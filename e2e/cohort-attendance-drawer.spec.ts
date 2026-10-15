import { expect, Page, test } from '@playwright/test';
import { mockCourse, ok } from './fixtures/course-detail-mocks';

/**
 * Cohort "Attendance Record" drawer (human, 2026-10-15): an upcoming session
 * is "Upcoming" (not absent), a live one counts who is present so far, the
 * row pills open and close the names, and a failed load says so with Retry
 * instead of "no records". Mocked API in the real response shape.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const session = (id: number, index: number, date: string, status: string, attended: number, absent: { id: number; name: string }[]) => ({
  id, index, title: `Session ${index}`, date, time_from: '10:00:00', time_to: '12:00:00', location: null, status,
  attended_count: attended, absent_count: absent.length, total: 1, full_attendance: status === 'held' && attended === 1, absent_learners: absent,
});

const ROLLUP = {
  cohort: { id: 22, name: 'Cohort B', start_date: null, end_date: null },
  course: { id: 10, title: 'Course' },
  totals: { sessions: 4, learners: 1, attended: 2, absent: 1, upcoming: 1 },
  sessions: [
    session(1, 1, '2026-10-12', 'held', 1, []),
    session(2, 2, '2026-10-13', 'held', 0, [{ id: 7, name: 'Ezz El-Din Ali' }]),
    session(3, 3, '2026-10-15', 'live', 1, []),
    session(4, 4, '2026-10-30', 'upcoming', 0, []),
  ],
  learners: [{ id: 7, name: 'Ezz El-Din Ali', machine_code: 'E7', department: null, total_sessions: 4, attended_count: 2, absent_count: 1, upcoming_count: 1,
    absent_sessions: [{ id: 2, index: 2, title: 'Session 2', date: '2026-10-13' }] }],
};

async function openDrawer(page: Page, respond: () => object | null): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await mockCourse(page);
  await page.route('**/api/v1/courses/10/cohorts/22/attendance', r => {
    const body = respond();
    return body ? r.fulfill({ json: ok(body) }) : r.fulfill({ status: 403, json: { status: 'error', message: 'Forbidden' } });
  });
  await page.goto('/admin/courses/10?tab=cohort');
  await page.getByRole('button', { name: 'Actions for Cohort B' }).click();
  await page.getByRole('menuitem', { name: 'View Attendance' }).click();
}

test('upcoming is not absent, live counts present, and a row opens and closes its names', async ({ page }) => {
  await openDrawer(page, () => ROLLUP);
  const rows = page.locator('.cad-row');
  await expect(rows).toHaveCount(4);

  await expect(rows.nth(3).locator('.cad-pill')).toHaveText(['Upcoming']);
  await expect(rows.nth(2).locator('.cad-pill')).toContainText(['Live']);
  await expect(rows.nth(2).locator('.cad-pill--bad')).toHaveCount(0);

  // Session 2: the absence pill opens the names, a second click closes them.
  const head = rows.nth(1).locator('.cad-row__head');
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(rows.nth(1).locator('.cad-panel__list li')).toHaveText(['Ezz El-Din Ali']);
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(rows.nth(1).locator('.cad-row__panel')).toHaveCount(0);

  // Absence filter: only the held session with an absentee.
  await page.getByRole('checkbox', { name: /Absence/ }).check();
  await expect(rows).toHaveCount(1);
});

test('a failed load says so and retries', async ({ page }) => {
  let fail = true;
  await openDrawer(page, () => (fail ? null : ROLLUP));
  await expect(page.locator('.cad-empty--error')).toContainText('The attendance could not be loaded.');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.cad-row')).toHaveCount(4);
});
