import { expect, Page, Request, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * NEW2B-5763: an article module that is empty, or longer than the server
 * accepts (CourseLectureRequest::ARTICLE_MAX), gets a message on the field
 * and is never sent. Runs in every viewport project, in EN and AR.
 */
const COPY = {
  en: { module: 'Module', article: 'Article', create: 'Create Module', required: 'Write the article learners will read.', tooLong: /too long to save/ },
  ar: { module: 'وحدة', article: 'مقال', create: /إنشاء/, required: 'اكتب المقال الذي سيقرأه المتدربون.', tooLong: /أطول من أن يُحفظ/ },
} as const;

async function openArticleForm(page: Page, locale: 'en' | 'ar'): Promise<Request[]> {
  await page.addInitScript(l => window.localStorage.setItem('2b_locale', l), locale);
  const seen = await mockCourse(page);
  await page.goto('/admin/courses/10?tab=content');
  await page.getByRole('button', { name: COPY[locale].module, exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[formcontrolname="title_en"]').fill('Reading');
  await dialog.locator('input[formcontrolname="title_ar"]').fill('قراءة');
  await dialog.locator('p-dropdown[formcontrolname="content_type"]').click();
  await page.getByRole('option', { name: COPY[locale].article, exact: true }).click();
  // The module form has no session-number or learner-scope field any more (D-079).
  await expect(dialog.locator('[formcontrolname="session_number"], [formcontrolname="learner_scope"], [formcontrolname="session_id"]')).toHaveCount(0);
  return seen;
}

for (const locale of ['en', 'ar'] as const) {
  test(`article: empty and over-long bodies get a field message and are not sent (${locale})`, async ({ page }) => {
    const seen = await openArticleForm(page, locale);
    const dialog = page.getByRole('dialog');
    const create = dialog.getByRole('button', { name: COPY[locale].create });

    await create.click();
    await expect(dialog.getByRole('alert')).toHaveText(COPY[locale].required);

    // A long paste: set the editor's markup the way a paste does, then let
    // the editor report it.
    await dialog.locator('[contenteditable="true"]').evaluate(el => {
      el.innerHTML = '<p>' + 'x'.repeat(500_001) + '</p>';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await create.click();
    await expect(dialog.getByRole('alert')).toHaveText(COPY[locale].tooLong);

    // The message sits inside the dialog at every width.
    const box = await dialog.getByRole('alert').boundingBox();
    const frame = await dialog.boundingBox();
    expect(box && frame && box.x >= frame.x && box.x + box.width <= frame.x + frame.width + 1).toBe(true);

    expect(seen.filter(r => r.method() === 'POST' && /\/courses\/10\/lectures/.test(r.url()))).toHaveLength(0);
  });
}
