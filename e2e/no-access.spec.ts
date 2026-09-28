import { expect, test } from '@playwright/test';

/**
 * DB-24: an admin whose roles grant no `view-*` permission used to freeze the
 * tab in an endless login <-> dashboard redirect. They now land on
 * /admin/no-access and can sign out. Desktop project only (behaviour test).
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const me = (viewKeys: string[]) => ({
  status: 'success', message: '',
  result: { id: 1, name: 'No Access', email: 'none@local.test', roles: [], view_keys: viewKeys, is_super_admin: false, role_chip: null, created_at: null },
});

test('an admin without any view permission lands on the no-access page and can sign out', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: me([]) }));
  let loggedOut = false;
  await page.route('**/api/v1/auth/admin/logout', r => { loggedOut = true; return r.fulfill({ json: { status: 'success', message: '' } }); });

  await page.goto('/admin/courses');

  await expect(page).toHaveURL(/\/admin\/no-access$/);
  await expect(page.getByRole('heading', { level: 1, name: 'No access yet' })).toBeVisible();
  // The page is responsive, i.e. not stuck in a redirect loop.
  expect(await page.evaluate(() => 1 + 1)).toBe(2);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(loggedOut).toBe(true);
});

test('an admin with a view permission is still redirected to it, not to no-access', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: me(['view-qualifications']) }));
  await page.route('**/api/v1/**', r => r.request().url().includes('/auth/admin/me') ? r.fallback() : r.fulfill({ json: { status: 'success', message: '', result: [] } }));

  await page.goto('/admin/courses');

  await expect(page).toHaveURL(/\/admin\/qualifications/);
});
