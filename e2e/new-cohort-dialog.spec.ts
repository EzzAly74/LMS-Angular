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
