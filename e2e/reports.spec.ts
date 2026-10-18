import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Reports (backend D-112) against the Figma frames: the report list
 * (2201:81876), a report with rows (2201:82041) and with none (2265:128244),
 * on a mocked API in the real response shapes, at every width and language.
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/reports');

const filter = (key: string, label: string, type: string, source: string | null = null, extra: Record<string, unknown> = {}) =>
  ({ key, label, type, source, required: false, depends_on: null, options: [], range_labels: null, ...extra });

const report = (key: string, name: string, description: string, filters: unknown[], extra: Record<string, unknown> = {}) =>
  ({ key, name, description, page_description: description, row_unit: '', columns: [], filters, last_exported_at: '2026-05-08T09:00:00Z', ...extra });

const CATALOG = [
  report('attendance', 'Attendance Report', 'Session attendance per course, cohort, and learner', []),
  report('evaluation-summary', 'Evaluation Scores – Summary', 'Average evaluation results per course, group and instructor', [
    filter('template_id', 'Evaluation template', 'select', 'templates', { required: true }),
  ]),
  report('evaluation-responses', 'Evaluation Scores – Response Detail', 'One row per submitted evaluation form', [
    filter('template_id', 'Evaluation template', 'select', 'templates', { required: true }),
  ]),
  report('external-training', 'External Training Report', 'Approved & pending external training claims & hours', [
    filter('training', 'Training date', 'date_range', null, { range_labels: { from: 'Start Date', to: 'End Date' } }),
    filter('qualification_ids', 'Qualification', 'multi', 'qualifications'),
    filter('providers', 'Provider', 'multi', 'providers'),
    filter('employee_ids', 'Learner', 'multi', 'employees'),
    filter('org_units', 'Department / Job Title', 'multi', 'org_units'),
    filter('statuses', 'Status', 'status', null, { options: [{ id: 'pending', label: 'Pending' }, { id: 'approved', label: 'Accepted' }, { id: 'rejected', label: 'Rejected' }] }),
  ], { page_description: 'Approved and pending external training claims, filtered by learner, hours, and qualification' }),
];

const col = (key: string, label: string, type = 'text', strong = false, tones: unknown[] = []) => ({ key, label, type, strong, tones });
const EXTERNAL_COLUMNS = [
  col('learner', 'Learner', 'text', true), col('provider', 'Provider'), col('training_title', 'Title'),
  col('hours_claimed', 'Hours', 'number', true), col('linked_qualification', 'Qualification'),
  col('claim_status', 'Status', 'status', false, [{ label: 'Accepted', tone: 'success' }, { label: 'Pending', tone: 'warning' }, { label: 'Rejected', tone: 'danger' }]),
  col('submission_date', 'Submitted', 'date'), col('approved_on', 'Approved', 'date'),
];
const EXTERNAL_ROWS = [
  { learner: 'Ahmed Hassan', provider: 'Coursera', training_title: 'Advanced Excel for Finance', hours_claimed: 24, linked_qualification: 'Service Excellence', claim_status: 'Accepted', submission_date: '2026-05-12', approved_on: '2026-05-15' },
  { learner: 'Sara Youssef', provider: 'LinkedIn Learning', training_title: 'PM Fundamentals', hours_claimed: 16, linked_qualification: null, claim_status: 'Pending', submission_date: '2026-05-18', approved_on: null },
  { learner: 'Mohamed Ali', provider: 'Udemy', training_title: 'Cybersecurity Basics', hours_claimed: 10, linked_qualification: 'IT Compliance', claim_status: 'Rejected', submission_date: '2026-05-10', approved_on: null },
];

interface Calls { pages: Request[]; exports: Request[]; exportAll: Request[] }

async function mockReports(page: Page, opts: { empty?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { pages: [], exports: [], exportAll: [] };
  const ok = (result: unknown) => ({ json: { status: 'success', message: '', result } });
  const file = (name: string) => ({
    status: 200, contentType: 'application/octet-stream', body: 'x',
    headers: { 'Content-Disposition': `attachment; filename=${name}`, 'Access-Control-Expose-Headers': 'Content-Disposition' },
  });
  await page.route(/\/api\/v1\/admin\/reports(\?.*)?$/, r => r.fulfill(ok(CATALOG)));
  await page.route('**/api/v1/admin/reports/options/**', r => {
    const source = new URL(r.request().url()).pathname.split('/').pop();
    const result = source === 'templates' ? [{ id: 5, label: 'Course Feedback' }, { id: 6, label: 'Trainer Feedback' }]
      : source === 'qualifications' ? [{ id: 31, label: 'Service Excellence' }, { id: 32, label: 'IT Compliance' }]
      : [{ id: 'Coursera', label: 'Coursera' }];
    return r.fulfill(ok(result));
  });
  await page.route('**/api/v1/admin/reports/export-all?**', r => { calls.exportAll.push(r.request()); return r.fulfill(file('NAS-reports-2026-10-18-120000.zip')); });
  await page.route('**/api/v1/admin/reports/*/export?**', r => { calls.exports.push(r.request()); return r.fulfill(file('NAS-external-training-2026-10-18-120000.csv')); });
  await page.route(/\/api\/v1\/admin\/reports\/(attendance|evaluation-summary|evaluation-responses|external-training)\?.*/, r => {
    calls.pages.push(r.request());
    const url = new URL(r.request().url());
    const key = url.pathname.split('/').pop();
    const evaluation = key?.startsWith('evaluation');
    const columns = evaluation ? [col('course_name', 'Course', 'text', true), col('respondents', 'Respondents', 'number', true)] : EXTERNAL_COLUMNS;
    const rows = opts.empty ? [] : evaluation ? [{ course_name: 'Selling Skills', respondents: 21 }] : EXTERNAL_ROWS;
    const filters = evaluation ? { template_id: Number(url.searchParams.get('template_id') ?? 5) } : {};
    return r.fulfill(ok({ columns, rows, filters, total: rows.length, current_page: 1, per_page: 25, last_page: 1 }));
  });
  return calls;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('report list: one card per report, card exports and Export All', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const calls = await mockReports(page);
    await page.goto('/admin/reports');

    // The two evaluation reports are one "Evaluation Scores" card (Figma 2201:82006).
    await expect(page.locator('.rl-card')).toHaveCount(3);
    await expect(page.locator('.rl-card__title')).toHaveText(['Attendance Report', 'Evaluation Scores', 'External Training Report']);
    await expect(page.locator('.rl-card').nth(1).locator('.rl-card__desc')).toHaveText('All evaluated courses');
    await expect(page.locator('.rl-card').first().locator('.rl-card__meta')).toContainText('Last generated:');
    await expect(page.locator('.rl-card').first().getByRole('button')).toHaveText(['Export CSV', 'Export Excel']);

    const download = page.waitForEvent('download');
    await page.locator('.rl-card').nth(2).getByRole('button', { name: 'Export External Training Report as CSV' }).click();
    await download;
    expect(new URL(calls.exports.at(-1)!.url()).searchParams.get('format')).toBe('csv');

    const all = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export All' }).click();
    expect((await all).suggestedFilename()).toBe('NAS-reports-2026-10-18-120000.zip');
    expect(new URL(calls.exportAll.at(-1)!.url()).searchParams.get('format')).toBe('xlsx');

    await page.getByRole('link', { name: 'Open External Training Report' }).click();
    await expect(page).toHaveURL(/\/admin\/reports\/external-training$/);
  });

  test('a report: filters inline as drawn, preview columns and badges, export with the filters', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const calls = await mockReports(page);
    await page.goto('/admin/reports/external-training');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('External Training Report');
    await expect(page.locator('.cl-subtitle')).toHaveText('Approved and pending external training claims, filtered by learner, hours, and qualification');
    await expect(page.locator('.rv__crumbs')).toContainText('Reports');
    await expect(page.locator('.rv-field__label')).toHaveText(['Start Date', 'End Date', 'Qualification', 'Provider', 'Learner', 'Department / Job Title', 'Status']);
    await expect(page.locator('.rv-filters__count')).toHaveText('0 active');
    await expect(page.locator('.rv-preview__title')).toHaveText('Preview: External Training Report');
    await expect(page.locator('.rv-table thead th')).toHaveText(['Learner', 'Provider', 'Title', 'Hours', 'Qualification', 'Status', 'Submitted', 'Approved']);
    await expect(page.locator('.rv-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.rv-badge')).toHaveClass([/rv-badge--success/, /rv-badge--warning/, /rv-badge--danger/]);
    await expect(page.locator('.rv-table tbody tr').nth(1).locator('td').nth(4)).toHaveText('—');
    // The preview asks for the preview columns.
    expect(new URL(calls.pages.at(-1)!.url()).searchParams.get('preview')).toBe('1');

    await page.locator('.rv-field').nth(2).locator('.p-multiselect').click();
    await page.getByRole('option', { name: 'Service Excellence' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => new URL(calls.pages.at(-1)!.url()).searchParams.getAll('qualification_ids[]')).toEqual(['31']);
    await expect(page.locator('.rv-filters__count')).toHaveText('1 active');

    await page.getByRole('button', { name: 'Export' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toBe('NAS-external-training-2026-10-18-120000.csv');
    const exp = new URL(calls.exports.at(-1)!.url()).searchParams;
    expect([exp.get('format'), exp.getAll('qualification_ids[]')]).toEqual(['csv', ['31']]);
  });

  test('no rows: the Figma empty state replaces the table', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    await mockReports(page, { empty: true });
    await page.goto('/admin/reports/external-training');

    const empty = page.locator('.rv-preview nas-list-state');
    await expect(empty.locator('.nls-empty__title')).toHaveText('No Results');
    await expect(empty.locator('img')).toHaveAttribute('src', 'assets/icons/figma/empty-state.svg');
    await expect(page.locator('.rv-table')).toHaveCount(0);
  });

  test('evaluation: the most answered template by default, Summary and Response Detail tabs', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const calls = await mockReports(page);
    await page.goto('/admin/reports/evaluation-summary');

    await expect(page.locator('.rv-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.rv-field .p-dropdown-label')).toHaveText('Course Feedback');
    // The template is the report's scope, not a counted filter.
    await expect(page.locator('.rv-filters__count')).toHaveText('0 active');
    await page.getByRole('tab', { name: 'Response Detail' }).click();
    await expect(page).toHaveURL(/\/admin\/reports\/evaluation-responses$/);
    await expect.poll(() => new URL(calls.pages.at(-1)!.url()).pathname.endsWith('evaluation-responses')).toBe(true);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`report list, report and empty report fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    mkdirSync(ARTIFACTS, { recursive: true });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    await mockReports(page);
    await page.goto('/admin/reports');
    await expect(page.locator('.rl-card')).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-list.png`), fullPage: true });

    await page.goto('/admin/reports/external-training');
    await expect(page.locator('.rv-table tbody tr')).toHaveCount(3);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-report.png`), fullPage: true });

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockReports(page, { empty: true });
    await page.goto('/admin/reports/external-training');
    await expect(page.locator('.rv-preview .nls-empty')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-empty.png`), fullPage: true });

    const text = await page.locator('body').innerText();
    expect(text.match(/\b(reports|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    expect(errors).toEqual([]);
  });
}
