import { expect, Page, test } from '@playwright/test';

/**
 * NEW2B-5877 / 5878 / 5890: blog form limits. Each field says what is wrong
 * and the limit (not always "This field is required"); the subtitle has a
 * counter; reading time over 1000 is refused before sending; a server 422
 * lands on the field it names, section fields included. EN + AR. Mocked API.
 */
const BLOG = {
  id: 5, title: { en: 'Leading hybrid teams', ar: 'قيادة الفرق الهجينة' }, subtitle: { en: '', ar: '' }, slug: 'lead',
  image: 'blogs/a.jpg', image_url: null, level: 'beginner', author_user_id: null, author_name: null, is_anonymous: true,
  reading_time: 5, qualification_skill_ids: [], qualifications: [], active: true, published_at: null,
  sections: [{ id: 1, title: { en: 'Intro', ar: 'مقدمة' }, image: null, image_url: null, body: { en: '<p>x</p>', ar: '<p>س</p>' }, quote: { en: '', ar: '' }, sort_order: 0 }],
};
const TEXT = {
  en: { tooLong: /Use 1000 characters or fewer \(now 1001\)/, max: 'Must be 1000 or less.', save: /Save|Update/ },
  ar: { tooLong: /استخدم 1000 حرفًا أو أقل/, max: 'يجب ألا يزيد عن 1000.', save: /حفظ|تحديث/ },
} as const;

async function open(page: Page, lang: 'en' | 'ar'): Promise<string[]> {
  await page.addInitScript((l) => window.localStorage.setItem('2b_locale', l), lang);
  await page.route('**/api/v1/auth/admin/me', (r) => r.fulfill({ json: { status: 'success', message: '', result: {
    id: 99003, name: 'Editor', email: 'editor@local.test', roles: ['editor'], view_keys: ['view-resources'],
    permissions: ['view-resources', 'create-resources', 'edit-resources'], is_super_admin: false, course_scope: 'all', role_chip: null, created_at: null,
  } } }));
  await page.route('**/api/v1/admin/blogs/5', (r) => r.request().method() === 'GET'
    ? r.fulfill({ json: { status: 'success', message: '', result: BLOG } })
    : r.fallback());
  const posts: string[] = [];
  await page.route('**/api/v1/admin/blogs/5', (r) => {
    if (r.request().method() !== 'POST' && r.request().method() !== 'PUT') return r.fallback();
    posts.push(r.request().method());
    return r.fulfill({ status: 422, json: { status: 'fail', message: 'The given data was invalid.', errors: {
      'sections.0.title.en': ['The section English title has already been used.'],
    } } });
  });
  await page.goto('/admin/blogs/5/edit');
  await expect(page.locator('input[formcontrolname="title_en"]').first()).toHaveValue('Leading hybrid teams');
  return posts;
}

for (const lang of ['en', 'ar'] as const) {
  test(`limits say what is wrong; server errors land on the field (${lang})`, async ({ page }) => {
    const posts = await open(page, lang);

    const subtitle = page.locator('textarea[formcontrolname="subtitle_en"]');
    await subtitle.fill('a'.repeat(1001));
    await subtitle.blur();
    const subField = page.locator('.bf-field', { has: subtitle });
    await expect(subField.locator('.bf-field__error')).toHaveText(TEXT[lang].tooLong);
    await expect(subField.locator('.bf-field__error')).toHaveAttribute('role', 'alert');
    await expect(subField.locator('.bf-counter')).toContainText('1001/1000');
    await expect(subField.locator('.bf-counter')).toHaveClass(/bf-counter--over/);

    const time = page.locator('input[formcontrolname="reading_time"]');
    await time.fill('1001');
    await time.blur();
    await expect(page.locator('.bf-field', { has: time }).locator('.bf-field__error')).toHaveText(TEXT[lang].max);

    // Invalid form: nothing is sent.
    await page.getByRole('button', { name: TEXT[lang].save }).click();
    expect(posts).toEqual([]);

    // Valid form, server refuses a section field: the message sits under it.
    await subtitle.fill('Short');
    await time.fill('7');
    await page.getByRole('button', { name: TEXT[lang].save }).click();
    await expect.poll(() => posts.length).toBe(1);
    const sectionTitle = page.locator('input[formcontrolname="title_en"]').nth(1).locator('xpath=ancestor::div[contains(@class, "bf-field")][1]');
    await expect(sectionTitle.locator('.bf-field__error')).toHaveText('The section English title has already been used.');
  });
}
