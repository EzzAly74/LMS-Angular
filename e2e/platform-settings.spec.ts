import { expect, Page, test } from '@playwright/test';

/**
 * Platform Config number fields (NEW2B-6055, NEW2B-6059): the form refuses
 * values outside the server's limits, says why under the field, and sends
 * nothing until they are fixed. The server applies the same limits
 * (UpdateSettingsRequest). Every API call is answered here.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const SETTINGS = [
  ['default_cohort_size', '30', 'number'],
  ['academy_default_close_offset_days', '0', 'number'],
  ['course_attendance_enabled', '1', 'boolean'],
  ['passcode_reset_seconds', '30', 'number'],
  ['certificate_award_basis', 'attendance', 'text'],
  ['min_passing_attendance', '70', 'number'],
  ['min_passing_score', '30', 'number'],
].map(([key, value, type], i) => ({ id: i + 1, key, value, type, module: 'platform', label: key }));

async function setup(page: Page, locale: 'en' | 'ar' = 'en'): Promise<unknown[]> {
  await page.addInitScript(l => window.localStorage.setItem('2b_locale', l), locale);
  const puts: unknown[] = [];
  // An account allowed to edit Platform Config (Save is gated, D-073).
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: { status: 'success', message: '', result: {
    id: 99002, name: 'Config editor', email: 'config@local.test', roles: ['config'], view_keys: ['view-platform-config'],
    permissions: ['view-platform-config', 'edit-platform-config'], is_super_admin: false, course_scope: 'all',
    role_chip: null, created_at: null,
  } } }));
  await page.route('**/api/v1/admin/settings', r => {
    if (r.request().method() === 'PUT') {
      puts.push(r.request().postDataJSON());
      return r.fulfill({ json: { status: 'success', message: '', result: SETTINGS } });
    }
    return r.fulfill({ json: { status: 'success', message: '', result: SETTINGS } });
  });
  await page.goto('/admin/settings');
  await expect(page.locator('#default_cohort_size')).toHaveValue('30');
  return puts;
}

test('out-of-range numbers are explained under the field and nothing is saved', async ({ page }) => {
  const puts = await setup(page);

  await page.locator('#default_cohort_size').fill('0');
  await page.locator('#academy_close_offset_days').fill('-3');
  await page.locator('#min_passing_attendance').fill('120');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.locator('#default_cohort_size-error')).toHaveText('Enter a whole number from 1 to 1000.');
  await expect(page.locator('#academy_close_offset_days-error')).toHaveText('Enter a whole number from 0 to 365.');
  await expect(page.locator('#min_passing_attendance-error')).toHaveText('Enter a whole number from 0 to 100.');
  await expect(page.locator('#default_cohort_size')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#default_cohort_size')).toHaveAttribute('aria-describedby', 'default_cohort_size-error');
  await expect(page.locator('#default_cohort_size')).toBeFocused();
  expect(puts).toHaveLength(0);
});

test('an empty field asks for a value', async ({ page }) => {
  await setup(page);
  await page.locator('#default_cohort_size').fill('');
  await page.locator('#default_cohort_size').blur();
  await expect(page.locator('#default_cohort_size-error')).toHaveText('Enter a value.');
});

test('the steppers stay inside the limits', async ({ page }) => {
  await setup(page);
  await page.locator('#default_cohort_size').fill('1');
  await page.locator('#default_cohort_size').locator('xpath=..').locator('.ps-number__step').nth(1).click();
  await expect(page.locator('#default_cohort_size')).toHaveValue('1');
  await expect(page.locator('#default_cohort_size-error')).toHaveCount(0);
});

test('valid values save', async ({ page }) => {
  const puts = await setup(page);
  await page.locator('#default_cohort_size').fill('25');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect.poll(() => puts.length).toBe(1);
  expect((puts[0] as { settings: Record<string, string> }).settings['default_cohort_size']).toBe('25');
});

test('Arabic: the field error is translated', async ({ page }) => {
  await setup(page, 'ar');
  await page.locator('#default_cohort_size').fill('0');
  await page.locator('#default_cohort_size').blur();
  await expect(page.locator('#default_cohort_size-error')).toHaveText('أدخل عددًا صحيحًا من 1 إلى 1000.');
});
