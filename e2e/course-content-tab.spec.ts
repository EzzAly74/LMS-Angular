import { resolve } from 'node:path';
import { expect, Page, test } from '@playwright/test';
import { mockCourse, ok } from './fixtures/course-detail-mocks';

/**
 * Course Details - Content tab, Figma 2486:139920: count line + Module,
 * type filters, one card of numbered rows (title, type badge, duration,
 * pencil). Delete moved into the Edit Module dialog (the row has only the
 * pencil). Mocked API; screenshots in e2e-artifacts/course-content/.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts');

const MODULES = [
  { id: 1, title: { en: 'Introduction to Workplace Safety', ar: 'مقدمة في السلامة' }, content_type: 'video', duration_minutes: 30, type: 'file', video: 'v.mp4' },
  { id: 2, title: { en: 'Hazard Identification & Risk Assessment', ar: 'تحديد المخاطر' }, content_type: 'link', duration_minutes: 45, type: 'url', video: 'https://example.com' },
  { id: 3, title: { en: 'PPE & Equipment Handling', ar: 'معدات الوقاية' }, content_type: 'document', duration_minutes: 35, type: 'file', video: 'd.pdf' },
  { id: 4, title: { en: 'Practical Assessment', ar: 'التقييم العملي' }, content_type: 'article', duration_minutes: 60, type: 'article', video: null, content: '<p>x</p>' },
  { id: 5, title: { en: 'Emergency Procedures & Evacuation', ar: 'إجراءات الطوارئ' }, content_type: 'video', duration_minutes: 120, type: 'file', video: 'e.mp4' },
  { id: 6, title: { en: 'Long Workshop', ar: 'ورشة طويلة' }, content_type: 'document', duration_minutes: 75, type: 'file', video: 'w.pdf' },
].map(m => ({ course_id: 10, section_id: 0, ...m }));

/** The Content tab's list (GET courses/{id}/content, D-109): the modules as rows, plus any quizzes / assignments. */
type ContentRow = { kind: 'lecture' | 'quiz' | 'assignment'; id: number; code: string; title: string;
  content_type: string | null; duration_minutes: number | null; status: string | null; due_date: string | null };
function contentOf(locale: 'en' | 'ar', extra: ContentRow[] = []): ContentRow[] {
  return [
    ...MODULES.map(m => ({ kind: 'lecture' as const, id: m.id, code: String(m.id), title: m.title[locale],
      content_type: m.content_type, duration_minutes: m.duration_minutes, status: null, due_date: null })),
    ...extra,
  ];
}

async function open(page: Page, locale: 'en' | 'ar' = 'en', extra: ContentRow[] = []): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  await mockCourse(page, { modules_count: MODULES.length });
  await page.route('**/api/v1/courses/10/modules**', r => r.fulfill({ json: ok(MODULES) }));
  await page.route('**/api/v1/courses/10/content**', r => r.fulfill({ json: ok(contentOf(locale, extra)) }));
  // The type names as EnumRegistry serves them (resources/lang/*/enums.php).
  const names = locale === 'ar'
    ? { video: 'فيديو', document: 'مستند', article: 'مقال', link: 'رابط خارجي' }
    : { video: 'Video', document: 'Document', article: 'Article', link: 'External Link' };
  await page.route('**/api/v1/enums/module_content_type**', r => r.fulfill({ json: ok(
    (['video', 'document', 'article', 'link'] as const).map((code, i) => ({ id: i + 1, code, value: names[code] })),
  ) }));
  await page.goto('/admin/courses/10?tab=content');
  await expect(page.locator('.module-row')).toHaveCount(MODULES.length + extra.length);
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'desktop project only');

  test('rows match the design: index circle, title, type badge colours, duration, pencil only', async ({ page }) => {
    await open(page);
    await expect(page.locator('.modules-tab__count')).toHaveText('6 modules · 365 min estimated learner time');

    const row = page.locator('.module-row').first();
    const m = await row.evaluate(el => {
      const cs = (q: string) => getComputedStyle(el.querySelector(q)!);
      const box = el.getBoundingClientRect();
      return {
        height: box.height, padStart: getComputedStyle(el).paddingInlineStart,
        index: [cs('.module-row__index').width, cs('.module-row__index').backgroundColor, cs('.module-row__index').color],
        title: [cs('.module-row__title').fontSize, cs('.module-row__title').fontWeight, cs('.module-row__title').color],
        badge: [cs('.module-type').backgroundColor, cs('.module-type').color, cs('.module-type').height],
      };
    });
    expect(m.height).toBe(76);
    expect(m.padStart).toBe('20px');
    expect(m.index).toEqual(['32px', 'rgb(242, 251, 250)', 'rgb(38, 120, 123)']);
    expect(m.title).toEqual(['14px', '600', 'rgb(23, 24, 25)']);
    expect(m.badge).toEqual(['rgb(213, 242, 240)', 'rgb(34, 95, 99)', '18px']);

    const badge = (i: number) => page.locator('.module-type').nth(i).evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    expect(await badge(1)).toEqual(['rgb(73, 110, 145)', 'rgb(255, 251, 247)']); // link
    expect(await badge(2)).toEqual(['rgba(0, 0, 136, 0.1)', 'rgb(0, 0, 136)']); // document
    expect(await badge(3)).toEqual(['rgb(212, 245, 255)', 'rgb(23, 24, 25)']); // article

    await expect(page.locator('.module-row__sub')).toHaveText(['30 min', '45 min', '35 min', '1 hr', '2 hrs', '1 hr 15 min']);
    await expect(page.locator('.module-type')).toHaveText(['Video', 'External Link', 'Document', 'Article', 'Video', 'Document']);
    await expect(page.locator('.modules-filter')).toHaveText(['All', 'Videos', 'Document', 'Articles', 'Links']);
    await expect(row.getByRole('button')).toHaveCount(2);
    await expect(row.getByRole('button', { name: 'Edit Introduction to Workplace Safety' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Delete Introduction to Workplace Safety' })).toBeVisible();

    const card = await page.locator('.modules-list').evaluate(el => [getComputedStyle(el).borderRadius, getComputedStyle(el).borderTopColor]);
    expect(card).toEqual(['16px', 'rgb(230, 231, 232)']);
  });

  test('quizzes and assignments are numbered with the modules, with their badges, and edit in their own forms (D-109, Figma 342:11813)', async ({ page }) => {
    await open(page, 'en', [
      { kind: 'quiz', id: 7, code: 'Q7', title: 'Knowledge Check Quiz', content_type: null, duration_minutes: 20, status: 'active', due_date: null },
      { kind: 'assignment', id: 3, code: 'A3', title: 'Practical Assessment', content_type: null, duration_minutes: null, status: 'draft', due_date: '2026-10-20' },
    ]);
    await expect(page.locator('.modules-tab__count')).toHaveText('8 modules · 385 min estimated learner time');

    const quiz = page.locator('.module-row').nth(6);
    await expect(quiz.locator('.module-row__index')).toHaveText('7');
    await expect(quiz.locator('.module-type')).toHaveText('Quiz');
    expect(await quiz.locator('.module-type').evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]))
      .toEqual(['rgb(254, 244, 230)', 'rgb(168, 94, 5)']);
    await expect(quiz.locator('.module-row__sub')).toHaveText('20 min');
    await expect(quiz.getByRole('link', { name: 'Edit Knowledge Check Quiz' })).toHaveAttribute('href', '/admin/quizzes/7/edit');
    await expect(quiz.getByRole('button')).toHaveCount(0);

    const assignment = page.locator('.module-row').nth(7);
    await expect(assignment.locator('.module-type')).toHaveText(['Assignment', 'Draft']);
    expect(await assignment.locator('.module-type').first().evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]))
      .toEqual(['rgb(254, 236, 235)', 'rgb(176, 42, 33)']);
    await expect(assignment.locator('.module-row__sub')).toHaveText('Due 20 Oct 2026');
    await expect(assignment.getByRole('link', { name: 'Edit Practical Assessment' })).toHaveAttribute('href', '/admin/assignments/3/edit');

    // The type chips are module types: a quiz shows under All only.
    await page.getByRole('checkbox', { name: 'Videos' }).check();
    await expect(page.locator('.module-row')).toHaveCount(2);
  });

  test('type filters narrow the list and All resets it', async ({ page }) => {
    await open(page);
    await page.getByRole('checkbox', { name: 'Document' }).check();
    await expect(page.locator('.module-row')).toHaveCount(2);
    await expect(page.getByRole('checkbox', { name: 'All' })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'All' }).check();
    await expect(page.locator('.module-row')).toHaveCount(MODULES.length);
  });

  test('Delete beside Edit asks, then deletes the module', async ({ page }) => {
    await open(page);
    let deleted = false;
    await page.route('**/api/v1/courses/10/lectures/3', r => {
      if (r.request().method() === 'DELETE') { deleted = true; return r.fulfill({ json: ok(null) }); }
      return r.fallback();
    });
    await page.getByRole('button', { name: 'Delete PPE & Equipment Handling' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('PPE & Equipment Handling');
    await confirm.getByRole('button', { name: /Yes|Delete|Confirm/ }).click();
    await expect.poll(() => deleted).toBe(true);
  });
});

test.describe('confirm modal (design system, Figma 453:37969)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'desktop project only');

  test('focus starts on Cancel, Tab stays inside, Esc cancels and returns focus', async ({ page }) => {
    await open(page);
    const trigger = page.getByRole('button', { name: 'Delete PPE & Equipment Handling' });
    await trigger.click();
    const modal = page.getByRole('alertdialog', { name: 'Delete module' });
    await expect(modal).toContainText('Delete "PPE & Equipment Handling"? This action cannot be undone.');
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`content tab fits and reads ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (locale === 'ar') await expect(page.locator('.module-row__sub').nth(4)).toHaveText('ساعتان');
    await page.locator('.modules-tab').screenshot({ path: `${ARTIFACTS}/course-content/${info.project.name}-${locale}.png` });
    await page.locator('.module-row__action--danger').first().click();
    await expect(page.locator('.nas-confirm-card')).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS}/course-content/${info.project.name}-${locale}-confirm.png` });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}
