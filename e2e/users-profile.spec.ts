import { expect, Page, Request, test } from '@playwright/test';

/**
 * Users > User Profile drawer (Figma 715:57123, NEW2B-5947) and the LinkedIn
 * Profile field on Add / Edit user (Figma 1532:63886).
 *
 * Every API call is answered here, so a run never writes to the dev database.
 */
const LOCALE_KEY = '2b_locale';

const ROLES = [
  { key: 'admin', label: 'Admin', color: 'teal', count: 1, course_scope: 'all', assignable: true },
  { key: 'instructor', label: 'Instructor', color: 'green', count: 1, course_scope: 'assigned', assignable: true },
];

const BASE_ROW = {
  source: 'admin', title_en: null, title_ar: null, brief_ar: null, phone: null, machine_code: null,
  department_name: null, image: null, status: 'active', last_active_at: '2026-05-17T10:00:00Z', compliance_pct: null,
  has_compliance: false, enrolled_courses_count: 0, created_at: null, is_super_admin: false,
};

const INSTRUCTOR = {
  ...BASE_ROW, id: 7, composite_id: 'admin:7', name: 'Mona Adel Hassan', name_en: 'Mona Adel Hassan', name_ar: 'منى عادل حسن',
  email: 'mona@academy.test', role: 'Instructor', role_key: 'instructor', role_machine: 'instructor', role_color: 'green',
  avatar_initial: 'M', instructor_id: 3, course_scope: 'assigned',
  brief: 'Certified learning and development specialist.', brief_en: 'Certified learning and development specialist.',
  linkedin_url: 'https://www.linkedin.com/in/mona-adel',
};
const COURSES = [
  { id: 11, title: 'Fire Safety Essentials for Industrial Sites and Warehouses' },
  { id: 12, title: 'First Aid' },
  { id: 13, title: 'Leadership Basics' },
  { id: 14, title: 'Excel for Analysts' },
  { id: 15, title: 'Time Management' },
];

const ADMIN = {
  ...BASE_ROW, id: 8, composite_id: 'admin:8', name: 'Omar Khaled Saad', name_en: 'Omar Khaled Saad', name_ar: 'عمر خالد سعد',
  email: 'omar@academy.test', role: 'Admin', role_key: 'admin', role_machine: 'admin', role_color: 'teal',
  avatar_initial: 'O', instructor_id: null, course_scope: 'all', brief: null, brief_en: null, linkedin_url: null,
};

async function setup(page: Page, locale: 'en' | 'ar'): Promise<Request[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale] as const);
  const writes: Request[] = [];
  await page.route('**/api/v1/admin/users/summary**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { total_users: 2, instructors: 1, admins: 1, inactive: 0 } } }));
  await page.route('**/api/v1/admin/users/filter-options**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { roles: ROLES } } }));
  await page.route('**/api/v1/admin/users?**', r =>
    r.fulfill({ json: { status: 'success', message: '', result: [INSTRUCTOR, ADMIN], meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 } } }));
  await page.route('**/api/v1/admin/users/admin/7', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { status: 'success', message: '', result: { ...INSTRUCTOR, courses: COURSES } } });
    writes.push(r.request());
    return r.fulfill({ json: { status: 'success', message: '', result: INSTRUCTOR } });
  });
  await page.route('**/api/v1/admin/users/admin/8', r =>
    r.fulfill({ json: { status: 'success', message: '', result: { ...ADMIN, courses: [] } } }));
  await page.goto('/admin/users');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  return writes;
}

async function openProfile(page: Page, row: number): Promise<void> {
  await page.locator('tbody tr').nth(row).locator('.ul-icon-btn').click();
  await page.locator('.ul-row-menu button').first().click();
  await expect(page.locator('.ul-drawer')).toBeVisible();
}

for (const locale of ['en', 'ar'] as const) {
  test(`an instructor's profile shows LinkedIn, assigned courses and About (${locale})`, async ({ page }, info) => {
    await setup(page, locale);
    await openProfile(page, 0);
    const drawer = page.locator('.ul-drawer');

    const linkedin = drawer.locator('a[href="https://www.linkedin.com/in/mona-adel"]');
    await expect(linkedin).toHaveAttribute('target', '_blank');
    await expect(linkedin).toHaveAttribute('rel', /noopener/);

    // Three courses, then "+2 more" opens the rest; each goes to the course.
    const courses = drawer.locator('.ul-drawer__course');
    await expect(courses).toHaveCount(3);
    await expect(courses.first()).toHaveAttribute('href', '/admin/courses/11');
    const more = drawer.locator('.ul-drawer__more');
    await expect(more).toContainText('2');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: `e2e-artifacts/users-profile-${locale}-${info.project.name}.png` });
    await more.click();
    await expect(courses).toHaveCount(5);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    await expect(drawer).toContainText('Certified learning and development specialist.');

    // A long course title stays on one line inside the drawer.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test(`an account that teaches nothing has no instructor rows (${locale})`, async ({ page }) => {
    await setup(page, locale);
    await openProfile(page, 1);
    const drawer = page.locator('.ul-drawer');
    await expect(drawer.locator('.ul-drawer__row')).toHaveCount(4);
    await expect(drawer.locator('.ul-drawer__courses, .ul-drawer__link')).toHaveCount(0);
  });

  test(`editing an instructor sends the LinkedIn profile (${locale})`, async ({ page }, info) => {
    const writes = await setup(page, locale);
    await page.locator('tbody tr').first().locator('.ul-icon-btn').click();
    await page.locator('.ul-row-menu button').nth(1).click();
    const dialog = page.locator('.ul-form-dialog');
    // Type only once the open animation has settled, as a person would.
    await expect(dialog).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    const field = dialog.locator('#ul-linkedin');
    await expect(field).toHaveValue('https://www.linkedin.com/in/mona-adel');
    await expect(dialog.locator('label[for="ul-linkedin"]')).toBeVisible();
    await expect(field).toHaveCSS('height', '37px');

    await field.fill('https://www.linkedin.com/in/mona-adel-hassan');
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `e2e-artifacts/users-linkedin-${locale}-${info.project.name}.png` });
    await dialog.locator('.ul-btn--primary').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].postDataJSON()).toMatchObject({ linkedin_url: 'https://www.linkedin.com/in/mona-adel-hassan' });
  });
}
