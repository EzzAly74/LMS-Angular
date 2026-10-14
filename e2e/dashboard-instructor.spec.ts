import { expect, Page, test } from '@playwright/test';

/**
 * NEW2B-5960: an account limited to its own courses (D-074) sees three cards,
 * spread across the full row, with the figures the API sends for its courses.
 * /me and the dashboard summary are answered here.
 */
const DASHBOARD = {
  statistics: {
    active_learners: 10, active_learners_online: 6, active_learners_offline: 4, active_courses: 1,
    awaiting_publish: 0, courses: 1, users: 10, unanswered_questions: 0, user_assignments: 0,
    instructors: null, average_completion_percent: 40,
  },
  top_courses: [], enrollment_trend: [], trend_range: 'month', course_scope: 'assigned',
};

async function signInAs(page: Page, locale: 'en' | 'ar', scope: 'assigned' | 'all'): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: { status: 'success', message: '', result: {
    id: 99002, name: 'Mona Adel', email: 'mona@local.test', roles: ['instructor'], view_keys: ['view-dashboard', 'view-courses'],
    permissions: ['view-dashboard', 'view-courses'], is_super_admin: false, course_scope: scope, role_chip: null, created_at: null,
  } } }));
  await page.route('**/api/v1/dashboard**', r => r.fulfill({ json: { status: 'success', message: '', result: {
    ...DASHBOARD, statistics: { ...DASHBOARD.statistics, instructors: scope === 'all' ? 3 : null }, course_scope: scope,
  } } }));
}

for (const locale of ['en', 'ar'] as const) {
  test(`an instructor sees three full-width cards about their courses (${locale})`, async ({ page }, info) => {
    await signInAs(page, locale, 'assigned');
    await page.goto('/admin/dashboard');
    const cards = page.locator('.kpi-row nas-stat-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(2)).toContainText('40%');
    await expect(page.locator('.kpi-row')).not.toContainText(/\d+%\s*(vs|مقارنة)/);

    // The three cards fill the row: the outer edges meet the row's edges.
    const row = (await page.locator('.kpi-row').boundingBox())!;
    const boxes = await Promise.all([0, 1, 2].map(i => cards.nth(i).boundingBox()));
    const left = Math.min(...boxes.map(b => b!.x));
    const right = Math.max(...boxes.map(b => b!.x + b!.width));
    expect(Math.abs(left - row.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(right - (row.x + row.width))).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `e2e-artifacts/dashboard-instructor-${locale}-${info.project.name}.png` });
  });
}

test('an account with every course keeps the Instructors card', async ({ page }) => {
  await signInAs(page, 'en', 'all');
  await page.goto('/admin/dashboard');
  await expect(page.locator('.kpi-row nas-stat-card')).toHaveCount(4);
});
