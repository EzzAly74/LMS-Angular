import { expect, test } from '@playwright/test';

/**
 * AUTH-01: a transient failure of GET /auth/admin/me during startup must not
 * log the admin out. Found when one harness run was bounced to /auth/login
 * mid-suite: bootstrapSession() cleared the session on ANY error.
 *
 * Runs once (desktop project), since this is behaviour rather than layout.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const ME = '**/api/v1/auth/admin/me';
const TOKEN_KEY = '2b_token';

test('a single failed /me is retried and the admin stays signed in', async ({ page }) => {
  let calls = 0;
  await page.route(ME, (route) => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 503, body: '' }) : route.continue();
  });

  await page.goto('/admin/job-titles');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/admin\/job-titles/);
  expect(calls).toBe(2);
});

test('when /me keeps failing, the login page shows but the stored token survives', async ({ page }) => {
  let calls = 0;
  await page.route(ME, (route) => {
    calls++;
    return route.fulfill({ status: 503, body: '' });
  });

  await page.goto('/admin/job-titles');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/auth\/login/);
  // One try and two retries, then it gives up - no redirect loop.
  expect(calls).toBe(3);
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).not.toBeNull();
});

test('a rejected token (401) still ends the session', async ({ page }) => {
  let calls = 0;
  await page.route(ME, (route) => {
    calls++;
    return route.fulfill({ status: 401, json: { status: 'error', message: 'Unauthenticated.' } });
  });

  await page.goto('/admin/job-titles');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/auth\/login/);
  expect(calls).toBe(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();
});
