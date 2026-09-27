import { resolve } from 'node:path';
import { expect, Page, test } from '@playwright/test';

/**
 * Add / Edit Course modal at every harness width x locale (D-051). The layout
 * harness visits routes, not open modals, so this opens the modal in its
 * fullest state - "No" with "Attendance & Minimum score", as 2401:126340 -
 * and checks it fits the viewport, has the right direction and threw nothing.
 * Screenshots go to e2e-artifacts/ for the Figma review.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts');
const ok = (result: unknown) => ({ status: 'success', message: '', result });

async function open(page: Page, locale: 'en' | 'ar'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await page.route('**/api/v1/courses?**', r =>
    r.fulfill({ json: { ...ok([]), meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } } }));
  await page.route('**/api/v1/courses/tab-counts', r => r.fulfill({ json: ok({ all: 0, active: 0, inactive: 0, pending: 0, upcoming: 0 }) }));
  await page.route('**/api/v1/categories/active**', r => r.fulfill({ json: ok([{ id: 1, name: 'Safety' }]) }));
  await page.route('**/api/v1/instructors/all**', r => r.fulfill({ json: ok([{ id: 3, name: 'Hala Nabil' }]) }));
  await page.route('**/api/v1/qualification-skills/active**', r => r.fulfill({ json: ok(
    ['Fire Safety Level 2', 'First Aid Certificate', 'GDPR Awareness', 'Workplace Safety Certified', 'Leadership Certification', 'ISO 45001 Awareness']
      .map((name, i) => ({ id: i + 1, name })),
  ) }));
  await page.goto('/admin/courses?new=1');
  return errors;
}

for (const locale of ['en', 'ar'] as const) {
  test(`course modal fits and reads ${locale}`, async ({ page }, info) => {
    const errors = await open(page, locale);
    const d = page.getByRole('dialog');
    await expect(d.locator('form')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    await d.locator('.cd__toggle-btn').nth(1).click();
    await d.getByRole('radio').nth(2).check();
    await expect(d.locator('input[type="number"]')).toHaveCount(2);

    const width = page.viewportSize()?.width ?? 0;
    const box = await d.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    // Nothing inside the modal scrolls sideways.
    const overflow = await d.locator('.cd__body').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: `${ARTIFACTS}/course-dialog/${info.project.name}-${locale}.png` });
    await d.locator('.cd__body').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.screenshot({ path: `${ARTIFACTS}/course-dialog/${info.project.name}-${locale}-end.png` });
    expect(errors).toEqual([]);
  });
}
