import { expect, Page, test } from '@playwright/test';

/**
 * The permission matrix in the Dashboard (D-073): a role that may only view a
 * section sees no create / edit / delete controls there, and cannot open its
 * create or edit pages by URL; give it the action and the control appears.
 *
 * Only /me is mocked (the signed-in admin's permissions); every other call is
 * the real API, so the pages render with real data. The server enforces the
 * same permissions - AdminActionPermissionTest covers that side.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const SECTIONS = [
  'dashboard', 'inbox', 'courses', 'assignments', 'quizzes', 'evaluations', 'learners', 'resources',
  'qualifications', 'certificates', 'categories', 'users', 'roles', 'platform-config',
];

async function signInWith(page: Page, permissions: string[]): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  const viewKeys = permissions.filter(p => p.startsWith('view-'));
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: { status: 'success', message: '', result: {
    id: 99001, name: 'Viewer', email: 'viewer@local.test', roles: ['viewer'], view_keys: viewKeys,
    permissions, is_super_admin: false, course_scope: 'all', role_chip: null, created_at: null,
  } } }));
}

const viewOnly = SECTIONS.map(s => `view-${s}`);

/** Page, and the label of a control a view-only role must not get there. */
const WRITE_CONTROLS: ReadonlyArray<[string, RegExp]> = [
  ['/admin/dashboard', /^Add Course$/],
  ['/admin/courses', /^New Course$/],
  ['/admin/categories', /^New Category$/],
  ['/admin/quizzes', /^Create Quiz$/],
  ['/admin/quizzes', /^View All$/],
  ['/admin/evaluations', /^Create Template$/],
  ['/admin/blogs', /^New Blog$/],
  ['/admin/qualifications', /^New Qualification$/],
  ['/admin/roles', /^Add Role$/],
  ['/admin/users', /^Add User$/],
  ['/admin/settings', /^Save Changes$/],
  ['/admin/messages', /^New Message$/],
];

test('a view-only role sees no create, edit or delete controls', async ({ page }) => {
  test.setTimeout(240_000);
  await signInWith(page, viewOnly);

  for (const [url, label] of WRITE_CONTROLS) {
    await page.goto(url);
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
    // Let the page's data and permission-dependent controls render.
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: label }).or(page.getByRole('link', { name: label })), `${url}: ${label}`)
      .toHaveCount(0);
  }
});

test('a view-only role is turned away from create and edit pages', async ({ page }) => {
  await signInWith(page, viewOnly);

  for (const url of ['/admin/quizzes/new', '/admin/assignments/new', '/admin/evaluations/new', '/admin/blogs/add', '/admin/roles/new']) {
    await page.goto(url);
    await expect(page, url).not.toHaveURL(new RegExp(url.replace(/\//g, '\\/') + '$'));
  }
});

test('the row menu offers only the actions the role holds', async ({ page }) => {
  await signInWith(page, viewOnly);
  await page.goto('/admin/courses');
  const more = page.locator('.cl-more').first();
  await expect(more).toBeVisible({ timeout: 20_000 });
  await more.click();
  await expect(page.getByRole('menuitem', { name: /View details/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Edit/i })).toHaveCount(0);
});

test('granting the action brings the control back', async ({ page }) => {
  await signInWith(page, [...viewOnly, 'create-courses', 'create-categories', 'create-quizzes', 'edit-quizzes']);

  await page.goto('/admin/courses');
  await expect(page.getByRole('button', { name: /^New Course$/ })).toBeVisible();
  await page.goto('/admin/categories');
  await expect(page.getByRole('button', { name: /^New Category$/ })).toBeVisible();
  await page.goto('/admin/quizzes');
  await expect(page.getByRole('link', { name: /^Create Quiz$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^View All$/ })).toBeVisible();
});
