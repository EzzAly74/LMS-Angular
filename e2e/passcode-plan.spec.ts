import { expect, Page, test } from '@playwright/test';

/**
 * Generate Passcode opens the cohort's PLANNED session (D-105). After the
 * cohort is picked the modal says which session starts and how it fits the
 * schedule, and the button says what will happen; a cohort whose sessions
 * are all over cannot start; a changed schedule (409) shows the new plan.
 * /me and the passcode API are answered here.
 */
const ok = (result: unknown) => ({ status: 'success', message: '', result });
const IDLE = { available: true, state: 'idle', passcode_length: 5, rotates: false, reset_seconds: 30, session: null, passcode: null };
const LIVE = {
  ...IDLE, state: 'live',
  session: { id: 41, number: 4, title: null, date: '2026-10-14', time_from: '10:00', time_to: '11:30', course_id: 7, course_title: 'Fire Safety', cohort_id: 9, cohort_name: 'October' },
  passcode: { code: '48213', issued_at: '2026-10-14T10:00:00+03:00', expires_at: '2099-01-01T00:00:00+03:00', expired: false },
};
const SESSION = { id: 41, number: 4, title: null, date: '2026-10-16', time_from: '10:00', time_to: '11:30' };

async function setup(page: Page, locale: 'en' | 'ar', plan: unknown, onStart?: (body: Record<string, unknown>) => { status: number; json: unknown }): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: ok({
    id: 99003, name: 'Mona Adel', email: 'mona@local.test', roles: ['instructor'], view_keys: ['view-dashboard'],
    permissions: ['view-dashboard'], is_super_admin: false, course_scope: 'assigned', role_chip: null, created_at: null,
  }) }));
  await page.route('**/api/v1/dashboard?**', r => r.fulfill({ json: ok({
    statistics: { active_learners: 0, active_learners_online: 0, active_learners_offline: 0, active_courses: 0, awaiting_publish: 0,
      courses: 0, users: 0, unanswered_questions: 0, user_assignments: 0, instructors: null, average_completion_percent: 0 },
    top_courses: [], enrollment_trend: [], trend_range: 'month', course_scope: 'assigned',
  }) }));
  await page.route('**/api/v1/dashboard/passcode/courses', r => r.fulfill({ json: ok([
    { id: 7, title: 'Fire Safety', cohorts: [{ id: 9, name: 'October', start_date: '2026-10-01', end_date: '2026-10-30' }] },
  ]) }));
  await page.route('**/api/v1/dashboard/passcode/plan?**', r => r.fulfill({ json: ok(plan) }));
  await page.route('**/api/v1/dashboard/passcode', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: ok(IDLE) });
    const res = onStart?.(r.request().postDataJSON()) ?? { status: 200, json: ok(LIVE) };
    return r.fulfill({ status: res.status, json: res.json });
  });
  await page.goto('/admin/dashboard');
  await page.locator('.passcode__generate').click();
  // A lone course and cohort: pick the course, the cohort follows.
  await page.locator('.passcode-modal__pick p-dropdown').first().click();
  await page.locator('.passcode-dd-panel li').first().click();
}

const TEXT = {
  en: { moved: /Session 4 is planned for .* Starting it now moves it to today/, button: 'Run Session 4 today', none: /Every planned session/ },
  ar: { moved: /الجلسة 4 مخططة يوم ١٦/, button: 'شغّل الجلسة 4 اليوم', none: /انتهت كل الجلسات/ },
} as const;

for (const locale of ['en', 'ar'] as const) {
  test(`a day without a session offers the next planned one, and sends it (${locale})`, async ({ page }, info) => {
    let sent: Record<string, unknown> | null = null;
    await setup(page, locale, { case: 'moved', session: SESSION }, body => { sent = body; return { status: 200, json: ok(LIVE) }; });

    const notice = page.locator('.passcode-modal__plan-text');
    await expect(notice).toHaveText(TEXT[locale].moved);
    await expect(notice).toHaveClass(/--warn/);
    const button = page.locator('.passcode-modal__done');
    await expect(button).toHaveText(TEXT[locale].button);
    await page.screenshot({ path: `e2e-artifacts/passcode-plan-moved-${locale}-${info.project.name}.png` });

    await button.click();
    await expect(page.locator('.passcode-modal__digit')).toHaveCount(5);
    expect(sent).toMatchObject({ course_id: 7, cohort_id: 9, session_id: 41 });
  });

  test(`a cohort whose sessions are all over cannot start (${locale})`, async ({ page }) => {
    await setup(page, locale, { case: 'none', session: null });
    await expect(page.locator('.passcode-modal__plan-text')).toHaveText(TEXT[locale].none);
    await expect(page.locator('.passcode-modal__done')).toBeDisabled();
  });
}

test('a changed schedule shows the new plan instead of starting', async ({ page }) => {
  await setup(page, 'en', { case: 'early', session: { ...SESSION, date: '2026-10-14', time_from: '14:00', time_to: '15:30' } },
    () => ({ status: 409, json: { status: 'error', message: 'The schedule changed.', errors: { plan: { case: 'on_time', session: { ...SESSION, id: 42, number: 5, date: '2026-10-14' } } } } }));
  await expect(page.locator('.passcode-modal__done')).toHaveText('Start Session 4 early');
  await page.locator('.passcode-modal__done').click();
  await expect(page.locator('.passcode-modal__plan-text')).toContainText('Session 5 is on now');
  await expect(page.locator('.passcode-modal__done')).toHaveText('Generate Passcode');
  await expect(page.locator('.passcode-modal__digit')).toHaveCount(0);
});
