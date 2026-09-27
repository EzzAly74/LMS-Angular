import { expect, Page, test } from '@playwright/test';

/**
 * Switching language re-reads every page's data in the new language, without
 * a refresh. Regression for the course pages keeping the old language (the
 * course mapper read the language once, at first import) and for screens that
 * never re-fetched on a switch.
 *
 * The API is mocked and answers in the language each request asks for, so a
 * page that re-fetches but renders the old language fails as surely as one
 * that never re-fetches.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const ok = (result: unknown) => ({ status: 'success', message: '', result });
const lang = (h: Record<string, string>) => (h['accept-language'] === 'ar' ? 'ar' : 'en');

async function start(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await page.goto(path);
}

const toArabic = (page: Page) => page.getByRole('button', { name: 'العربية' }).click();

test('course detail shows the other language after a switch', async ({ page }) => {
  // The detail resource returns both languages; the page picks one.
  const detail = {
    id: 10, title: { en: 'Fire Safety', ar: 'السلامة من الحرائق' }, description: { en: 'Stay safe', ar: 'ابق آمنًا' },
    course_type: 'offline', status: 'active', level: 'beginner', instructors: [], qualification_skills: [], sections: [],
    what_students_will_learn: { en: [], ar: [] }, requirements: { en: [], ar: [] }, certificate: true,
  };
  await page.route('**/api/v1/courses/10', r => r.fulfill({ json: ok(detail) }));
  await page.route('**/api/v1/courses/10/sections', r => r.fulfill({ json: ok([]) }));
  await page.route('**/api/v1/courses/10/enrollments**', r =>
    r.fulfill({ json: { ...ok({ data: [], total: 0 }), meta: { current_page: 1, last_page: 1, per_page: 200, total: 0 } } }));
  await page.route('**/api/v1/courses/10/modules', r => r.fulfill({ json: ok([]) }));

  await start(page, '/admin/courses/10');
  await expect(page.getByRole('heading', { name: 'Fire Safety' })).toBeVisible();
  await toArabic(page);
  await expect(page.getByRole('heading', { name: 'السلامة من الحرائق' })).toBeVisible();
  await expect(page.getByText('Fire Safety')).toHaveCount(0);
});

test('course list shows the other language after a switch', async ({ page }) => {
  await page.route('**/api/v1/courses?**', r => {
    const title = { en: 'Fire Safety', ar: 'السلامة من الحرائق' };
    return r.fulfill({ json: { ...ok([{ id: 10, title, course_type: 'offline', status: 'active', updated_at: '2026-09-20' }]),
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } } });
  });
  await page.route('**/api/v1/courses/tab-counts', r => r.fulfill({ json: ok({ all: 1, active: 1, inactive: 0, pending: 0, upcoming: 0 }) }));

  await start(page, '/admin/courses');
  await expect(page.getByText('Fire Safety')).toBeVisible();
  await toArabic(page);
  await expect(page.getByText('السلامة من الحرائق')).toBeVisible();
});

test('external training review re-reads its names after a switch', async ({ page }) => {
  const stats = { pending: 0, this_year: 1, rejected_this_year: 0, year: 2026 };
  const request = (l: 'en' | 'ar') => ({
    id: 3, title: 'Advanced Excel', provider: 'Coursera', start_date: '2026-08-12', end_date: '2026-09-12', hours: 8,
    cost: null, currency: 'EGP', status: 'approved', rejection_reason: null, course: null,
    qualification: { id: 5, name: l === 'ar' ? 'التحليل المالي' : 'Financial Analysis' },
    certificate: { name: 'cert.png', mime: 'image/png', size: 32000 },
    submitted_at: '2026-09-16 10:00:00', decided_at: '2026-09-20 10:00:00',
    learner: { id: 7, name: 'Layla Hassan', employee_id: 'EMP7' }, decided_by: { id: 1, name: 'Admin' },
  });
  await page.route('**/api/v1/admin/external-training/3', r => r.fulfill({ json: ok(request(lang(r.request().headers()))) }));
  await page.route('**/api/v1/admin/external-training/stats', r => r.fulfill({ json: ok(stats) }));
  await page.route('**/api/v1/admin/external-training/options', r => r.fulfill({ json: ok({ qualifications: [], courses: [] }) }));

  await start(page, '/admin/external-training/3');
  await expect(page.getByText('Financial Analysis')).toBeVisible();
  await toArabic(page);
  await expect(page.getByText('التحليل المالي')).toBeVisible();
});
