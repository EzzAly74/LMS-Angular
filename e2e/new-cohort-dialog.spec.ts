import { expect, Page, Request, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * D2 step 8 - New Cohort with its schedule (Figma 2393:123167 / 2393:122292),
 * against a mocked API in the real response shapes. Desktop project only.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function openDialog(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await mockCourse(page);
  await page.goto('/admin/courses/10?tab=cohort');
  await page.getByRole('button', { name: 'Add Cohort' }).first().click();
  await expect(page.getByRole('dialog', { name: 'New Cohort' })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'New Cohort' });

test('fields, template download, file pick and remove, then Add Cohort posts the schedule', async ({ page }) => {
  await openDialog(page);
  let template = 0;
  await page.route('**/api/v1/courses/10/sections/schedule-template', r => { template++; return r.fulfill({ status: 200, contentType: XLSX, body: 'PK' }); });
  const posts: Request[] = [];
  await page.route('**/api/v1/courses/10/sections/scheduled', r => {
    posts.push(r.request());
    return r.fulfill({ status: 201, json: { status: 'success', message: '', result: { id: 99, name: 'Cohort D' } } });
  });

  const d = dialog(page);
  const add = d.getByRole('button', { name: 'Add Cohort' });
  await expect(d.getByLabel('Cohort Name (English)')).toHaveAttribute('placeholder', 'e.g. Cohort D');
  await expect(d.getByLabel('Capacity', { exact: true })).toHaveValue('30');
  await expect(add).toBeDisabled();

  await d.getByRole('button', { name: 'Increase capacity' }).click();
  await expect(d.getByLabel('Capacity', { exact: true })).toHaveValue('31');

  // No "Open for enrolment early" switch: a new cohort is always open (human, 2026-10-07).
  await expect(d.getByRole('switch')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Download Schedule Template' }).click();
  expect((await download).suggestedFilename()).toBe('cohort-schedule-template.xlsx');
  expect(template).toBe(1);

  await d.getByLabel('Cohort Name (English)').fill('Cohort D');
  await d.getByLabel('Cohort Name (Arabic)').fill('الدفعة د');
  await expect(add).toBeDisabled(); // no schedule yet

  // A wrong type is refused on the spot.
  await d.locator('#nc-file').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await expect(d.getByRole('alert')).toHaveText('Choose an XLS or XLSX file.');

  await d.locator('#nc-file').setInputFiles({ name: 'schedule.xlsx', mimeType: XLSX, buffer: Buffer.from('PK\x03\x04 rest') });
  await expect(d.getByText('schedule.xlsx')).toBeVisible();
  await expect(d.locator('.nc__file-badge')).toHaveText('XLSX');
  await d.getByRole('button', { name: 'Remove schedule.xlsx' }).click();
  await expect(d.getByRole('button', { name: 'Select file' })).toBeVisible();

  await d.locator('#nc-file').setInputFiles({ name: 'schedule.xlsx', mimeType: XLSX, buffer: Buffer.from('PK\x03\x04 rest') });
  await expect(add).toBeEnabled();
  await add.click();

  await expect(d).toBeHidden();
  expect(posts).toHaveLength(1);
  const body = posts[0].postData() ?? '';
  expect(body).toContain('name="name[en]"\r\n\r\nCohort D');
  expect(body).toContain('name="name[ar]"\r\n\r\nالدفعة د');
  expect(body).toContain('name="capacity"\r\n\r\n31');
  expect(body).not.toContain('name="open_for_enrollment"');
  expect(body).toContain('filename="schedule.xlsx"');
});

test('a rejected schedule lists every problem and keeps the dialog open', async ({ page }) => {
  await openDialog(page);
  await page.route('**/api/v1/courses/10/sections/scheduled', r => r.fulfill({ status: 422, json: {
    status: 'error', message: 'Nothing was imported.', errors: { schedule: ['Nothing was imported.'] },
    report: { errors: [
      { row: 3, column: 'date', message: 'Use a date like 2026-10-05.' },
      { row: 5, column: 'start_time', message: 'This session overlaps the one on row 2.' },
    ] },
  } }));

  const d = dialog(page);
  await d.getByLabel('Cohort Name (English)').fill('Cohort D');
  await d.getByLabel('Cohort Name (Arabic)').fill('الدفعة د');
  await d.locator('#nc-file').setInputFiles({ name: 'schedule.xlsx', mimeType: XLSX, buffer: Buffer.from('PK\x03\x04') });
  await d.getByRole('button', { name: 'Add Cohort' }).click();

  await expect(page.getByText('Use a date like 2026-10-05.')).toBeVisible();
  await expect(page.getByText('This session overlaps the one on row 2.')).toBeVisible();
  await expect(d).toBeVisible();
});

// ── Edit Cohort: the same dialog (Edit must match New Cohort) ──────────────

async function openEdit(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await mockCourse(page);
  await page.goto('/admin/courses/10?tab=cohort');
  await page.getByRole('button', { name: 'Actions for Cohort A' }).click();
  await page.getByRole('menuitem', { name: 'Edit Cohort' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Cohort' })).toBeVisible();
}

test('edit fills the cohort in, downloads its schedule, and saves names and capacity without a file', async ({ page }) => {
  await openEdit(page);
  let template = 0;
  await page.route('**/api/v1/courses/10/sections/21/schedule-template', r => { template++; return r.fulfill({ status: 200, contentType: XLSX, body: 'PK' }); });
  const posts: Request[] = [];
  await page.route('**/api/v1/courses/10/sections/21/scheduled', r => {
    posts.push(r.request());
    return r.fulfill({ json: { status: 'success', message: '', result: { section: { id: 21 }, sessions_added: 0, sessions_updated: 0 } } });
  });

  const d = page.getByRole('dialog', { name: 'Edit Cohort' });
  const save = d.getByRole('button', { name: 'Save Changes' });
  await expect(d.getByLabel('Cohort Name (English)')).toHaveValue('Cohort A');
  await expect(d.getByLabel('Cohort Name (Arabic)')).toHaveValue('الدفعة أ');
  await expect(d.getByLabel('Capacity', { exact: true })).toHaveValue('30');
  await expect(d.getByText('Step 2 · Upload new sessions (optional)')).toBeVisible();
  await expect(d.locator('.nc__rules')).toContainText('Sessions already held cannot be changed.');
  await expect(save).toBeDisabled(); // nothing changed yet
  await expect(d.getByRole('switch')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Download Current Schedule' }).click();
  expect((await download).suggestedFilename()).toBe('cohort-schedule.xlsx');
  expect(template).toBe(1);

  // Not below the 8 learners already enrolled.
  await d.getByLabel('Capacity', { exact: true }).fill('5');
  await d.getByLabel('Capacity', { exact: true }).blur();
  await expect(d.locator('#nc-capacity-err')).toHaveText('Capacity cannot be less than the 8 learners already enrolled.');
  await expect(save).toBeDisabled();

  await d.getByLabel('Capacity', { exact: true }).fill('40');
  await d.getByLabel('Cohort Name (English)').fill('Cohort A (evening)');
  await expect(save).toBeEnabled();
  await save.click();

  await expect(d).toBeHidden();
  expect(posts).toHaveLength(1);
  const body = posts[0].postData() ?? '';
  expect(body).toContain('name="name[en]"\r\n\r\nCohort A (evening)');
  expect(body).toContain('name="capacity"\r\n\r\n40');
  expect(body).not.toContain('name="schedule"');
  expect(body).not.toContain('name="open_for_enrollment"');
  await expect(page.getByText('Cohort updated')).toBeVisible();
});

test('edit with a sheet sends it and reports the sessions added; a refused sheet lists its problems', async ({ page }) => {
  await openEdit(page);
  let reject = true;
  await page.route('**/api/v1/courses/10/sections/21/scheduled', r => reject
    ? r.fulfill({ status: 422, json: {
        status: 'error', message: 'Nothing was imported.', errors: { schedule: ['Nothing was imported.'] },
        report: { errors: [{ row: 3, column: 'date', message: 'A new session must start in the future. Sessions already held cannot be added or changed.' }] } } })
    : r.fulfill({ json: { status: 'success', message: '', result: { section: { id: 21 }, sessions_added: 2, sessions_updated: 0 } } }));

  const d = page.getByRole('dialog', { name: 'Edit Cohort' });
  await d.locator('#nc-file').setInputFiles({ name: 'schedule.xlsx', mimeType: XLSX, buffer: Buffer.from('PK\x03\x04') });
  const save = d.getByRole('button', { name: 'Save Changes' });
  await expect(save).toBeEnabled(); // a file alone is a change
  await save.click();
  await expect(page.getByText('A new session must start in the future.', { exact: false })).toBeVisible();
  await expect(d).toBeVisible();

  await page.locator('.p-dialog-header-close').last().click(); // closes the report
  await expect(page.getByText('A new session must start in the future.', { exact: false })).toBeHidden();
  reject = false;
  await save.click();
  await expect(d).toBeHidden();
  await expect(page.getByText('Cohort updated · 2 sessions added, 0 updated')).toBeVisible();
});
