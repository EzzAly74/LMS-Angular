import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Reports (backend D-112): the report list and one report, against a mocked
 * API in the real response shapes, with the layout checked at every width
 * and language.
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/reports');

const col = (key: string, label: string, group: string, groupLabel: string, type = 'text', available = true) =>
  ({ key, label, group, group_label: groupLabel, type, available });

const ATTENDANCE_COLUMNS = [
  col('employee_id', 'Employee ID', 'employee', 'Employee'),
  col('full_name_ar', 'Full Name (AR)', 'employee', 'Employee'),
  col('department', 'Department', 'employee', 'Employee'),
  col('course_name', 'Course Name', 'course', 'Course'),
  col('required_sessions', 'Required Sessions', 'sessions', 'Sessions', 'number'),
  col('sessions_attended', 'Sessions Attended', 'sessions', 'Sessions', 'number'),
  col('line_manager', 'Line Manager', 'employee', 'Employee', 'text', false),
  col('group_start_date', 'Group Start Date', 'course', 'Course', 'date'),
  col('attendance_pct_sessions', 'Attendance % (Sessions)', 'calculated', 'Calculated', 'percent'),
  col('attendance_status', 'Attendance Status', 'calculated', 'Calculated'),
];

const filter = (key: string, label: string, type: string, source: string | null = null, extra: Record<string, unknown> = {}) =>
  ({ key, label, type, source, required: false, depends_on: null, options: [], ...extra });

const CATALOG = [
  {
    key: 'attendance', name: 'Attendance Report', description: 'Session attendance per course, cohort, and learner',
    row_unit: 'One learner × one course × one group', columns: ATTENDANCE_COLUMNS, last_exported_at: '2026-10-01T09:00:00Z',
    filters: [
      filter('departments', 'Department', 'multi', 'departments'),
      filter('course_ids', 'Course', 'multi', 'courses'),
      filter('cohort_ids', 'Group / Cohort', 'multi', 'cohorts', { depends_on: 'course_ids' }),
      filter('period', 'Date range', 'date_range'),
      filter('attendance_below', 'Attendance below (%)', 'number'),
    ],
  },
  {
    key: 'evaluation-summary', name: 'Evaluation Scores – Summary', description: 'Average evaluation results per course, group and instructor',
    row_unit: 'One course × one group × one instructor', last_exported_at: null,
    columns: [col('course_name', 'Course Name', 'course', 'Course'), col('respondents', 'Respondents', 'response', 'Response', 'number')],
    filters: [filter('template_id', 'Evaluation template', 'select', 'templates', { required: true }), filter('course_ids', 'Course', 'multi', 'courses')],
  },
];

const ROWS = [
  { employee_id: '1732', full_name_ar: 'أحمد حسن', department: 'الموارد البشرية', course_name: 'Selling Skills', required_sessions: 4, sessions_attended: 2, line_manager: null, group_start_date: '2025-12-15', attendance_pct_sessions: 50, attendance_status: 'Partial' },
  { employee_id: '21A3', full_name_ar: 'منى عادل', department: 'المبيعات', course_name: 'Structured Interviewing for Hiring Managers and Team Leads', required_sessions: 4, sessions_attended: 0, line_manager: null, group_start_date: '2025-12-15', attendance_pct_sessions: 0, attendance_status: 'No Show' },
];

interface Calls { pages: Request[]; options: string[]; exports: Request[] }

async function mockReports(page: Page, opts: { exportStatus?: number } = {}): Promise<Calls> {
  const calls: Calls = { pages: [], options: [], exports: [] };
  const ok = (result: unknown) => ({ json: { status: 'success', message: '', result } });
  await page.route(/\/api\/v1\/admin\/reports(\?.*)?$/, r => r.fulfill(ok(CATALOG)));
  await page.route('**/api/v1/admin/reports/options/**', r => {
    const url = new URL(r.request().url());
    calls.options.push(url.pathname.split('/').pop() + (url.search ? url.search : ''));
    const source = url.pathname.split('/').pop();
    const result = source === 'templates' ? [{ id: 5, label: 'Course Feedback' }, { id: 6, label: 'Trainer Feedback' }]
      : source === 'courses' ? [{ id: 11, label: 'Selling Skills' }, { id: 12, label: 'Structured Interviewing' }]
      : [{ id: 'الموارد البشرية', label: 'Human Resources' }];
    return r.fulfill(ok(result));
  });
  await page.route('**/api/v1/admin/reports/*/export?**', r => {
    calls.exports.push(r.request());
    if (opts.exportStatus === 422) {
      return r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ status: 'error', message: 'This export would hold 12,000 rows; the limit is 10,000. Narrow the filters and try again.' }) });
    }
    return r.fulfill({ status: 200, contentType: 'text/csv', headers: { 'Content-Disposition': 'attachment; filename=NAS-attendance-2026-10-18-120000.csv', 'Access-Control-Expose-Headers': 'Content-Disposition' }, body: '﻿Report Name,Attendance Report\n' });
  });
  await page.route(/\/api\/v1\/admin\/reports\/(attendance|evaluation-summary)\?.*/, r => {
    calls.pages.push(r.request());
    const key = new URL(r.request().url()).pathname.split('/').pop();
    const def = CATALOG.find(c => c.key === key)!;
    const rows = key === 'attendance' ? ROWS : [{ course_name: 'Selling Skills', respondents: 21 }];
    return r.fulfill(ok({ columns: def.columns, rows, total: rows.length, current_page: 1, per_page: 25, last_page: 1 }));
  });
  return calls;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('the list opens a report; columns, the not-captured notice, filters, search and export', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const calls = await mockReports(page);
    await page.goto('/admin/reports');

    await expect(page.locator('.rl-card')).toHaveCount(2);
    await expect(page.locator('.rl-card').first()).toContainText('1 not captured yet');
    // A report that needs a template first offers no quick export.
    await expect(page.locator('.rl-card').nth(1).locator('nas-action-menu')).toHaveCount(0);

    await page.getByRole('link', { name: 'Attendance Report' }).first().click();
    await expect(page).toHaveURL(/\/admin\/reports\/attendance$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Attendance Report');
    await expect(page.locator('.rv__groups th')).toHaveText(['Employee', 'Course', 'Sessions', 'Employee', 'Course', 'Calculated']);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody tr').first().locator('td').nth(8)).toHaveText('50%');
    await expect(page.locator('.rv__notice')).toContainText('Line Manager');
    await expect(page.locator('thead th.rv__missing')).toContainText('Not captured yet');

    await page.getByLabel('Search this report').fill('1732');
    await expect.poll(() => new URL(calls.pages.at(-1)!.url()).searchParams.get('search')).toBe('1732');

    await page.getByRole('button', { name: 'Filter' }).click();
    const d = page.getByRole('dialog');
    await d.locator('.p-multiselect').nth(1).click();
    await page.getByRole('option', { name: 'Selling Skills' }).click();
    await page.keyboard.press('Escape');
    await d.getByLabel('Attendance below (%)').fill('75');
    await d.getByLabel('Attendance below (%)').blur();
    await d.getByRole('button', { name: 'Filter' }).click();
    const params = new URL(calls.pages.at(-1)!.url()).searchParams;
    expect(params.getAll('course_ids[]')).toEqual(['11']);
    expect(params.get('attendance_below')).toBe('75');
    expect(params.get('search')).toBe('1732');
    await expect(page.locator('.nlt__badge')).toHaveText('2');

    // The export carries the same filters and search.
    await page.getByRole('button', { name: /Export/ }).click();
    const download = page.waitForEvent('download');
    await page.locator('.nas-am__item', { hasText: 'CSV (.csv)' }).click();
    expect((await download).suggestedFilename()).toBe('NAS-attendance-2026-10-18-120000.csv');
    const exp = new URL(calls.exports.at(-1)!.url()).searchParams;
    expect([exp.get('format'), exp.getAll('course_ids[]')[0], exp.get('attendance_below'), exp.get('search')]).toEqual(['csv', '11', '75', '1732']);
  });

  test('a refused export shows the server reason', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    await mockReports(page, { exportStatus: 422 });
    await page.goto('/admin/reports/attendance');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: /Export/ }).click();
    await page.locator('.nas-am__item', { hasText: 'Excel (.xlsx)' }).click();
    await expect(page.getByText(/the limit is 10,000/)).toBeVisible();
  });

  test('an evaluation report starts on the most answered template and shows it as its scope', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const calls = await mockReports(page);
    await page.goto('/admin/reports/evaluation-summary');

    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(new URL(calls.pages.at(-1)!.url()).searchParams.get('template_id')).toBe('5');
    await expect(page.locator('.rv__scope')).toHaveText('Evaluation template: Course Feedback');
    // The template is the scope, not a counted filter.
    await expect(page.locator('.nlt__badge')).toHaveCount(0);
  });

  test('a failed load offers a retry', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    await mockReports(page);
    let fail = true;
    await page.route(/\/api\/v1\/admin\/reports\/attendance\?.*/, r => (fail ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fallback()));
    await page.goto('/admin/reports/attendance');
    await expect(page.locator('nas-list-state [role=alert]')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`report list, report and filter modal fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await mockReports(page);
    mkdirSync(ARTIFACTS, { recursive: true });
    const width = page.viewportSize()?.width ?? 0;
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    await page.goto('/admin/reports');
    await expect(page.locator('.rl-card')).toHaveCount(2);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-list.png`), fullPage: true });

    await page.goto('/admin/reports/attendance');
    await expect(page.locator('tbody tr')).toHaveCount(2);
    // The wide table scrolls inside its card; the page itself never does.
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-report.png`), fullPage: true });

    await page.locator('.nlt__filter').click();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-filter.png`) });

    const text = await page.locator('body').innerText();
    expect(text.match(/\b(reports|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    expect(errors).toEqual([]);
  });
}
