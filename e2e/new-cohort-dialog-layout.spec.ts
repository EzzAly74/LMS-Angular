import { resolve } from 'node:path';
import { expect, Page, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * New Cohort modal (Figma 2393:123167 / 2393:122292) at every harness width x
 * locale (D-051). The layout harness visits routes, not open modals, so this
 * opens it in both states - before and after a file is chosen - and checks it
 * fits the viewport, reads in the right direction and threw nothing.
 * Screenshots go to e2e-artifacts/ for the Figma review.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts');
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function open(page: Page, locale: 'en' | 'ar'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // The realtime client cannot reach the broadcast server when it is not running locally; that is not this page.
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('WebSocket connection to')) errors.push(m.text()); });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await mockCourse(page);
  await page.goto('/admin/courses/10?tab=cohort');
  await page.locator('.ct-add').click();
  return errors;
}

async function fits(page: Page): Promise<void> {
  const d = page.getByRole('dialog');
  const width = page.viewportSize()?.width ?? 0;
  const box = await d.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  // Nothing inside the modal scrolls sideways.
  const overflow = await d.locator('.p-dialog-content').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const locale of ['en', 'ar'] as const) {
  test(`new cohort modal fits and reads ${locale}`, async ({ page }, info) => {
    const errors = await open(page, locale);
    const d = page.getByRole('dialog');
    await expect(d.locator('form')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    await fits(page);
    await page.screenshot({ path: `${ARTIFACTS}/new-cohort/${info.project.name}-${locale}.png` });

    await d.locator('#nc-name-en').fill('Cohort D');
    await d.locator('#nc-name-ar').fill('الدفعة د');
    await d.locator('#nc-file').setInputFiles({ name: 'a-rather-long-schedule-file-name-for-cohort-d.xlsx', mimeType: XLSX, buffer: Buffer.from('PK\x03\x04') });
    await expect(d.locator('.nc__file')).toBeVisible();
    await fits(page);
    await d.locator('.p-dialog-content').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.screenshot({ path: `${ARTIFACTS}/new-cohort/${info.project.name}-${locale}-file.png` });

    expect(errors).toEqual([]);
  });
}

for (const locale of ['en', 'ar'] as const) {
  test(`edit cohort modal fits and reads ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    // The realtime client cannot reach the broadcast server when it is not running locally; that is not this page.
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('WebSocket connection to')) errors.push(m.text()); });
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await mockCourse(page);
    await page.goto('/admin/courses/10?tab=cohort');
    await page.locator('.ct-menu').first().click();
    await page.locator('.row-menu__item').first().click();
    const d = page.getByRole('dialog');
    await expect(d.locator('.nc__rules')).toBeVisible();
    await expect(d.locator('#nc-name-en')).toHaveValue('Cohort A');
    await fits(page);
    await page.screenshot({ path: `${ARTIFACTS}/new-cohort/${info.project.name}-${locale}-edit.png` });
    await d.locator('.p-dialog-content').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.screenshot({ path: `${ARTIFACTS}/new-cohort/${info.project.name}-${locale}-edit-bottom.png` });

    const text = await page.locator('body').innerText();
    expect(text.match(/\bcourse_detail\.[a-z_.]+/g) ?? []).toEqual([]);
    expect(errors).toEqual([]);
  });
}
