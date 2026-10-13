import { resolve } from 'node:path';
import { expect, Page, test } from '@playwright/test';

/**
 * Add / Edit Course page at every harness width x locale (D-051): the fullest
 * state - "No" with "Attendance & Minimum score", as 2401:126340 - and the
 * locked Edit state (D-095). Nothing scrolls sideways, the direction is right
 * and nothing threw. Screenshots go to e2e-artifacts/ for the Figma review.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts');
const ok = (result: unknown) => ({ status: 'success', message: '', result });

const DETAIL = {
  id: 5,
  title: { en: 'Fire Safety at the Workplace for Site Supervisors', ar: 'السلامة من الحرائق في مكان العمل لمشرفي المواقع' },
  description: { en: 'Stay safe', ar: 'ابق آمنًا' },
  course_type: 'offline',
  level: 'intermediate',
  category: { id: 1, name: 'Safety' },
  instructors: [{ id: 3, name: 'Hala Nabil' }],
  qualification_skills: [{ id: 1, name: 'Fire Safety Level 2' }],
  what_students_will_learn: { en: ['Use an extinguisher'], ar: ['استخدام الطفاية'] },
  requirements: { en: [], ar: [] },
  image: null,
  certificate_rule: 'both',
  certificate_min_attendance: 80,
  certificate_min_score: 65,
  locked_fields: ['course_type', 'certificate_rule', 'qualification_skill_ids'],
};

async function open(page: Page, locale: 'en' | 'ar', path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // The realtime client cannot reach the broadcast server when it is not running locally; that is not this page.
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('WebSocket connection to')) errors.push(m.text()); });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route('**/api/v1/categories/active**', r => r.fulfill({ json: ok([{ id: 1, name: 'Safety' }]) }));
  await page.route('**/api/v1/instructors/all**', r => r.fulfill({ json: ok([{ id: 3, name: 'Hala Nabil' }]) }));
  await page.route('**/api/v1/qualification-skills/active**', r => r.fulfill({ json: ok(
    ['Fire Safety Level 2', 'First Aid Certificate', 'GDPR Awareness', 'Workplace Safety Certified', 'Leadership Certification', 'ISO 45001 Awareness']
      .map((name, i) => ({ id: i + 1, name })),
  ) }));
  await page.route('**/api/v1/courses/5', r => r.fulfill({ json: ok(DETAIL) }));
  await page.goto(path);
  return errors;
}

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const locale of ['en', 'ar'] as const) {
  test(`add course page fits and reads ${locale}`, async ({ page }, info) => {
    const errors = await open(page, locale, '/admin/courses/new');
    await expect(page.locator('form.af-layout')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    await page.locator('.cf__toggle-btn').nth(1).click();
    await page.getByRole('radio').nth(2).check();
    await expect(page.locator('input[type="number"]')).toHaveCount(2);
    await noSidewaysScroll(page);

    await page.screenshot({ path: `${ARTIFACTS}/course-form/${info.project.name}-${locale}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test(`locked edit page fits and reads ${locale}`, async ({ page }, info) => {
    const errors = await open(page, locale, '/admin/courses/5/edit');
    await expect(page.getByRole('note')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toHaveCount(2);
    await noSidewaysScroll(page);

    // The clear (x) of a filled dropdown sits at the end, clear of the text, in
    // both directions (PrimeNG's theme pins it to the physical right).
    const gap = await page.locator('p-dropdown:has(.p-dropdown-clear-icon)').first().evaluate(dd => {
      const label = dd.querySelector('.p-dropdown-label') as HTMLElement;
      const icon = dd.querySelector('.p-dropdown-clear-icon')!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const rtl = getComputedStyle(label).direction === 'rtl';
      return rtl ? text.left - icon.right : icon.left - text.right;
    });
    expect(gap).toBeGreaterThanOrEqual(0);

    await page.screenshot({ path: `${ARTIFACTS}/course-form/${info.project.name}-${locale}-locked.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
