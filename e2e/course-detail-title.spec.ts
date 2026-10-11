import { expect, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * NEW2B-5920: a long course name in the Course Details header wraps onto
 * lines that never overlap (older builds inherited a line height smaller
 * than the 24px title). EN + AR at every width. Mocked API.
 */
const LONG = 'Course Python hjvsd jbxhvjhd bxjnv chgvd nbzvx nbcv hgch gvxcjv vzxhjcv bvzxgcv vzxjchvd vzjxhvcjzd gvzxjv bxvhxz bnxzv jhvsdug dsvjsdbhyfds jhgwaye hsvcjhv xzhjbchjdg jbvjhbds hzbxhjsdbicbb asbfeugf jzxnckdjncj';

for (const lang of ['en', 'ar']) {
  test(`a long course name wraps without overlapping (${lang})`, async ({ page }) => {
    await page.addInitScript((l) => window.localStorage.setItem('2b_locale', l), lang);
    await mockCourse(page, { title: { en: LONG, ar: LONG } });
    await page.goto('/admin/courses/10');
    const title = page.locator('h1.cd-head__title');
    await expect(title).toBeVisible();

    const m = await title.evaluate((e) => {
      const cs = getComputedStyle(e);
      const lines = [...e.querySelector('bdi')!.getClientRects()].map((r) => r.top);
      return { font: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight), lines };
    });
    expect(m.lines.length).toBeGreaterThan(1);
    expect(m.line).toBeGreaterThanOrEqual(m.font * 1.15);
    for (let i = 1; i < m.lines.length; i++) expect(m.lines[i] - m.lines[i - 1]).toBeGreaterThanOrEqual(m.font);
    // The meta row starts below the last line of the title.
    const titleBox = (await title.boundingBox())!;
    const metaBox = (await page.locator('.cd-head__meta').first().boundingBox())!;
    expect(metaBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
  });
}
