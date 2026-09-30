import { expect, Page, Request, test } from '@playwright/test';

/**
 * Qualifications page (D5; Figma 2066:100159 list, 2066:100876 modal,
 * 1983:44634 import menu, 2066:99852 export menu).
 *
 * Every API call is answered here, so a run never writes to the dev database;
 * the request the page sends is asserted exactly - that is the contract.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';
const LIST = '**/api/v1/admin/qualification-skills?**';

const row = (id: number, name: string, extra: Partial<Record<string, number | null>> = {}) => ({
  id, name, courses_count: 2, enrolled_count: 28, job_titles_count: 3, learners_count: 32,
  certified_count: 28, completion_percent: 90, created_at: '2026-09-26 10:00:00', ...extra,
});

const ROWS = [
  row(1, 'Excel'),
  row(2, 'Microsoft Office', { courses_count: 1, job_titles_count: 2, learners_count: 8, certified_count: 3, completion_percent: 41 }),
  row(3, 'Email Etiquette', { courses_count: 4, learners_count: 0, certified_count: 0, completion_percent: null }),
];

const ASSIGNEES = {
  job_titles: [{ id: 7, name: 'Operations Manager', employees: 18 }, { id: 8, name: 'Customer Support Specialist', employees: 12 }],
  learners: [{ id: 41, name: 'Amal Al-Khateeb', employee_id: 'EMP41' }, { id: 42, name: 'Omar Al-Farsi', employee_id: 'EMP42' }],
};

async function setup(page: Page, rows = ROWS): Promise<string[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  const listCalls: string[] = [];
  await page.route(LIST, r => {
    listCalls.push(r.request().url());
    return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length } } });
  });
  await page.route('**/api/v1/admin/qualification-skills/assignees**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: ASSIGNEES } }));
  await page.goto('/admin/qualifications');
  await expect(page.locator('tbody tr')).toHaveCount(rows.length || 1);
  return listCalls;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: /Qualification/ });

test('the list shows the Figma columns and every figure the API returns', async ({ page }) => {
  await setup(page);

  await expect(page.locator('thead th')).toHaveText(
    ['Qualification', 'Linked Courses', 'Enrolled', 'Certified', 'Completion', 'Job titles', 'Learners', 'Actions']);
  const first = page.locator('tbody tr').nth(0);
  await expect(first).toContainText('Excel');
  await expect(first).toContainText('2 Courses');
  await expect(first).toContainText('28/32');
  await expect(first).toContainText('3 Titles');
  await expect(first).toContainText('32 Learners');
  await expect(first.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');

  const second = page.locator('tbody tr').nth(1);
  await expect(second).toContainText('1 Course');
  await expect(second.locator('.ql__fill')).toHaveClass(/ql__fill--low/);

  // Nobody needs the third: a dash, not a 0% bar.
  const third = page.locator('tbody tr').nth(2);
  await expect(third.getByRole('progressbar')).toHaveCount(0);
  await expect(third).toContainText('0 Learners');
});

test('New Qualification sends names, job titles and learners in one request', async ({ page }) => {
  const listCalls = await setup(page);
  const posts: Request[] = [];
  await page.route('**/api/v1/admin/qualification-skills', r => {
    if (r.request().method() !== 'POST') return r.fallback();
    posts.push(r.request());
    return r.fulfill({ status: 201, json: { status: 'success', message: '', result: { id: 9 } } });
  });

  await page.getByRole('button', { name: 'New Qualification' }).click();
  const d = dialog(page);
  await expect(d.getByRole('heading', { name: 'New Qualification' })).toBeVisible();
  const submit = d.getByRole('button', { name: 'New Qualification' });
  await expect(submit).toBeDisabled();

  await d.getByLabel('Qualification Name (English)').fill('Forklift');
  await d.getByLabel('Qualification Name (Arabic)').fill('رافعة');
  await expect(submit).toBeEnabled();

  await expect(d.getByText('Operations Manager')).toBeVisible();
  await d.getByRole('checkbox', { name: /Operations Manager/ }).check();
  await d.getByRole('button', { name: 'Learners', exact: true }).click();
  await expect(d.getByRole('button', { name: 'Learners', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await d.getByRole('checkbox', { name: /Omar Al-Farsi/ }).check();
  await expect(d.getByText('2 selected')).toBeVisible();

  const before = listCalls.length;
  await submit.click();
  await expect(d).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(posts[0].postDataJSON()).toEqual({
    name: { en: 'Forklift', ar: 'رافعة' },
    job_title_ids: [7],
    learner_ids: [42],
  });
  await expect.poll(() => listCalls.length).toBeGreaterThan(before);
});

test('Edit opens the modal filled in and saves exactly what is ticked', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/admin/qualification-skills/1', r => {
    if (r.request().method() === 'GET') {
      return r.fulfill({ json: { status: 'success', message: '', result: {
        id: 1, name: { en: 'Excel', ar: 'إكسل' },
        job_titles: [{ id: 7, name: 'Operations Manager', employees: 18 }],
        learners: [{ id: 41, name: 'Amal Al-Khateeb', employee_id: 'EMP41' }],
        learners_total: 1, learners_editable: true,
      } } });
    }
    return r.fallback();
  });
  const puts: Request[] = [];
  await page.route('**/api/v1/admin/qualification-skills/1', r => {
    if (r.request().method() !== 'PUT') return r.fallback();
    puts.push(r.request());
    return r.fulfill({ json: { status: 'success', message: '', result: { id: 1 } } });
  });

  await page.getByRole('button', { name: 'Actions for Excel' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const d = dialog(page);
  await expect(d.getByRole('heading', { name: 'Edit Qualification' })).toBeVisible();
  await expect(d.getByLabel('Qualification Name (English)')).toHaveValue('Excel');
  await expect(d.getByText('2 selected')).toBeVisible();
  // The ticked ones come first.
  await expect(d.locator('.qd__row').nth(0)).toContainText('Operations Manager');
  await expect(d.getByRole('checkbox', { name: /Amal Al-Khateeb/ })).toBeChecked();

  await d.getByRole('checkbox', { name: /Amal Al-Khateeb/ }).uncheck();
  await d.getByRole('button', { name: 'Save Changes' }).click();
  await expect(d).toBeHidden();
  expect(puts[0].postDataJSON()).toEqual({ name: { en: 'Excel', ar: 'إكسل' }, job_title_ids: [7], learner_ids: [] });
});

test('a name in use is shown next to its field and the modal stays open', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/admin/qualification-skills', r =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 422, json: { status: 'error', message: 'invalid', errors: { 'name.en': ['Another qualification already has this name.'] } } })
      : r.fallback());

  await page.getByRole('button', { name: 'New Qualification' }).click();
  const d = dialog(page);
  await d.getByLabel('Qualification Name (English)').fill('Excel');
  await d.getByLabel('Qualification Name (Arabic)').fill('جديد');
  await d.getByRole('button', { name: 'New Qualification' }).click();

  const en = d.getByLabel('Qualification Name (English)');
  await expect(en).toHaveAttribute('aria-invalid', 'true');
  await expect(d.getByText('Another qualification already has this name.')).toBeVisible();
  await expect(d).toBeVisible();
});

test('the Import menu matches Figma, closes on Escape, and a rejected file lists every problem', async ({ page }) => {
  await setup(page);
  const templates: string[] = [];
  await page.route('**/api/v1/admin/qualification-skills/import-template**', r => {
    templates.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'name_en' });
  });
  await page.route('**/api/v1/admin/qualification-skills/import', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { created: 0, errors: [
      { row: 3, column: 'name_ar', message: 'This cell is required.' },
      { row: 4, column: 'job_titles', message: 'No job title is called "Ghost".' },
    ] } } }));

  const trigger = page.getByRole('button', { name: 'Import', exact: true });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('group', { name: 'Import' });
  await expect(panel.getByRole('button')).toHaveText(['', 'Download empty template', 'Import Excel (.xlsx)', 'Import CSV (.csv)']);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download empty template' }).click();
  expect((await download).suggestedFilename()).toBe('qualifications-template.xlsx');

  await trigger.click();
  const chooser = page.waitForEvent('filechooser');
  await panel.getByRole('button', { name: 'Import CSV (.csv)' }).click();
  const fc = await chooser;
  expect(await fc.element().getAttribute('accept')).toContain('.csv');
  await fc.setFiles({ name: 'q.csv', mimeType: 'text/csv', buffer: Buffer.from('name_en,name_ar\n') });

  const report = page.getByRole('dialog', { name: 'Import not completed' });
  await expect(report.locator('tbody tr')).toHaveCount(2);
  await expect(report.locator('tbody tr').first()).toContainText('3');
  await expect(report.locator('tbody tr').first()).toContainText('name_ar');
});

test('Export downloads the list as searched', async ({ page }) => {
  const listCalls = await setup(page);
  const exports: string[] = [];
  await page.route('**/api/v1/admin/qualification-skills/export?**', r => {
    exports.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'text/csv', body: 'name_en\n' });
  });

  const before = listCalls.length;
  await page.getByRole('searchbox').fill('excel');
  await expect.poll(() => listCalls.length).toBeGreaterThan(before);
  expect(new URL(listCalls.at(-1) ?? '').searchParams.get('search')).toBe('excel');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('group', { name: 'Export' }).getByRole('button', { name: 'Export CSV (.csv)' }).click();
  expect((await download).suggestedFilename()).toBe('qualifications.csv');
  const q = new URL(exports[0]).searchParams;
  expect(q.get('format')).toBe('csv');
  expect(q.get('search')).toBe('excel');
});

test('Delete asks first, then removes the row through the API', async ({ page }) => {
  const listCalls = await setup(page);
  const deletes: string[] = [];
  await page.route('**/api/v1/admin/qualification-skills/2', r => {
    if (r.request().method() !== 'DELETE') return r.fallback();
    deletes.push(r.request().url());
    return r.fulfill({ json: { status: 'success', message: '', result: null } });
  });

  await page.getByRole('button', { name: 'Actions for Microsoft Office' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete Qualification' });
  await expect(confirm).toContainText('Microsoft Office');
  expect(deletes).toHaveLength(0);

  const before = listCalls.length;
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(confirm).toBeHidden();
  expect(deletes).toHaveLength(1);
  await expect.poll(() => listCalls.length).toBeGreaterThan(before);
});

test('an empty list and a failed load each say so', async ({ page }) => {
  await setup(page, []);
  await expect(page.locator('tbody')).toContainText('No qualifications yet');

  await page.unroute(LIST);
  await page.route(LIST, r => r.fulfill({ status: 500, json: { status: 'error', message: '' } }));
  await page.getByRole('searchbox').fill('x');
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
