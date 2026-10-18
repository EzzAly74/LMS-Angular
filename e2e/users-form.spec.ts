import { expect, Page, Request, test } from '@playwright/test';

/**
 * Users > Add / Edit user form (NEW2B-6160, 6161, 6163, 6165, 6166, 6167).
 *
 * Every API call is answered here, so a run never writes to the dev database.
 * Layout runs at every width in EN and AR; behaviour is checked at each too,
 * since the form is the same dialog everywhere.
 */
const LOCALE_KEY = '2b_locale';

const ROLES = [
  { key: 'admin', label: 'Admin', color: 'teal', count: 1, course_scope: 'all', assignable: true },
  { key: 'instructor', label: 'Instructor', color: 'green', count: 1, course_scope: 'assigned', assignable: true },
  { key: 'reports-viewer', label: 'Reports Viewer', color: 'blue', count: 0, course_scope: 'all', assignable: true },
];

const INSTRUCTOR = {
  id: 7, source: 'admin', composite_id: 'admin:7', name: 'Mona Adel Hassan', name_en: 'Mona Adel Hassan', name_ar: 'منى عادل حسن',
  title_en: null, title_ar: null, brief_en: null, brief_ar: null, brief: null, email: 'mona@academy.test',
  phone: null, machine_code: null, department_name: null, image: '/assets/images/logo.svg',
  role: 'Instructor', role_key: 'instructor', role_machine: 'instructor', role_color: 'green', status: 'active',
  last_active_at: null, compliance_pct: null, has_compliance: false, enrolled_courses_count: 0, courses_earned: 0,
  last_certification_at: null, job_title: null, avatar_initial: 'M', created_at: null, instructor_id: 3,
  course_scope: 'assigned', is_super_admin: false,
};

async function setup(page: Page, locale: 'en' | 'ar'): Promise<Request[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale] as const);
  const writes: Request[] = [];
  await page.route('**/api/v1/admin/users/summary**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { total_users: 1, instructors: 1, admins: 0, inactive: 0 } } }));
  await page.route('**/api/v1/admin/users/filter-options**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { roles: ROLES } } }));
  await page.route('**/api/v1/admin/users?**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: [INSTRUCTOR], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } } }));
  await page.route('**/api/v1/admin/users/admin/7', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { status: 'success', message: '', result: INSTRUCTOR } });
    writes.push(r.request());
    return r.fulfill({ json: { status: 'success', message: '', result: { ...INSTRUCTOR, image: null } } });
  });
  await page.goto('/admin/users');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  return writes;
}

async function openEdit(page: Page): Promise<void> {
  await page.locator('tbody tr').first().locator('.ul-icon-btn').click();
  await page.locator('.ul-row-menu button').nth(1).click();
  await expect(page.locator('.ul-form-dialog')).toBeVisible();
}

for (const locale of ['en', 'ar'] as const) {
  test(`edit shows the instructor role, names follow the rules, Remove photo is sent (${locale})`, async ({ page }, info) => {
    const writes = await setup(page, locale);
    await openEdit(page);
    const dialog = page.locator('.ul-form-dialog');

    // NEW2B-6163: the instructor's role is selected.
    await expect(dialog.locator('p-dropdown .p-dropdown-label')).toHaveText(/Instructor/);

    // NEW2B-6161: one name, or a name part under three letters, is refused with a message.
    const nameEn = dialog.locator('input[name="name_en"]');
    await nameEn.fill('Mona');
    await expect(dialog.locator('#ul-name-en-error')).not.toBeEmpty();
    await expect(nameEn).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.locator('.af-btn--primary')).toBeDisabled();
    await nameEn.fill('Mo Adel');
    await expect(dialog.locator('#ul-name-en-error')).not.toBeEmpty();
    await nameEn.fill('Mona Adel');
    await expect(dialog.locator('#ul-name-en-error')).toBeEmpty();

    await page.screenshot({ path: `e2e-artifacts/users-form-${locale}-${info.project.name}.png`, fullPage: true });

    // NEW2B-6160: Remove, then Save, asks the server to remove the photo.
    await dialog.locator('.photo-upload__clear').click();
    await dialog.locator('.af-btn--primary').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].postDataJSON()).toMatchObject({ name_en: 'Mona Adel', remove_image: true });

    // No sideways scroll at this width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test(`a wrong type or too-large photo is refused with the reason (${locale})`, async ({ page }) => {
    await setup(page, locale);
    await page.locator('.ul-add-btn').click();
    const dialog = page.locator('.ul-form-dialog');
    const input = dialog.locator('input[type="file"]');
    const error = dialog.locator('.ul-form__hint--error').last();

    // NEW2B-6166: SVG is refused (D-044) with the accepted types named.
    await input.setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    await expect(error).toContainText(/PNG/);
    await expect(dialog.locator('.photo-upload__preview')).toHaveCount(0);

    // NEW2B-6167: over 3 MB is refused with the limit named.
    await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(3 * 1024 * 1024 + 1) });
    await expect(error).toContainText(/3/);

    // NEW2B-6165: a GIF is taken.
    const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
    await input.setInputFiles({ name: 'me.gif', mimeType: 'image/gif', buffer: gif });
    await expect(error).toBeEmpty();
    await expect(dialog.locator('.photo-upload__preview')).toHaveCount(1);
  });
}
