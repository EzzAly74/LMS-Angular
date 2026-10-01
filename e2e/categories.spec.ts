import { expect, Page, test } from '@playwright/test';

/**
 * Categories dialog. Every API call is answered here, so a run never writes
 * to the dev database; the request the page sends is the contract.
 * - NEW2B-6104: each language is filled from its own field and sent exactly
 *   as typed, never copied into the other language.
 * - NEW2B-5903: a new category has no Active checkbox (it is always active).
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const ROWS = [
  { id: 5, name: 'Finance', name_en: 'Finance', name_ar: 'المالية', active: true, courses_count: 2 },
];

async function setup(page: Page): Promise<FormData[]> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  const writes: FormData[] = [];
  await page.route('**/api/v1/categories**', async r => {
    const req = r.request();
    if (req.method() === 'GET') {
      return r.fulfill({ json: { status: 'success', message: '', result: ROWS, meta: { current_page: 1, last_page: 1, per_page: 15, total: ROWS.length } } });
    }
    const body = req.postDataBuffer();
    const fd = await new Response(body, { headers: { 'content-type': req.headers()['content-type'] } }).formData();
    writes.push(fd);
    return r.fulfill({ json: { status: 'success', message: '', result: ROWS[0] } });
  });
  await page.goto('/admin/categories');
  await expect(page.getByText('Finance')).toBeVisible();
  return writes;
}

test('a new category needs both names, sends each as typed and has no Active checkbox', async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole('button', { name: 'New Category' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);

  const add = dialog.getByRole('button', { name: 'Add Category' });
  await dialog.getByLabel('Name (English)').fill('Marketing');
  await expect(add).toBeDisabled();

  await dialog.getByLabel('Name (Arabic)').fill('التسويق');
  await add.click();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].get('name[en]')).toBe('Marketing');
  expect(writes[0].get('name[ar]')).toBe('التسويق');
});

test('editing fills each language from its own field', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Actions for Finance' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name (English)')).toHaveValue('Finance');
  await expect(dialog.getByLabel('Name (Arabic)')).toHaveValue('المالية');
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
});
