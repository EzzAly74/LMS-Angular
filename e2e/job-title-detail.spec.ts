import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Job title detail (D1b, Figma 2459:137558) with a POPULATED three-level tree.
 *
 * layout.spec.ts visits the real page against the dev database, where no user
 * holds a job title yet, so it only ever sees the empty state. This spec
 * answers the two API calls the page makes with a fixed response in the real
 * shape, so the tree itself - learner, qualification and course rows,
 * expansion, plural forms, pills, bars, search - is checked at every width in
 * both languages. The fixture exists only inside this test; nothing ships.
 */

const LOCALE_KEY = '2b_locale';
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/job-title-detail-fixture');

type Status = 'completed' | 'in_progress' | 'unenrolled';
const course = (id: number, title: string, status: Status, percent: number) => ({ id, title, status, percent });

const qual = (id: number, name: string, courses: ReturnType<typeof course>[], direct = false) => {
  const done = courses.filter((c) => c.status === 'completed').length;
  const total = courses.length;
  return {
    id,
    name,
    courses_total: total,
    courses_completed: done,
    percent: direct ? 100 : total ? Math.round((done * 100) / total) : 0,
    granted_directly: direct,
    earned: direct || (total > 0 && done >= total),
    courses,
  };
};

const learner = (id: number, name: string, percent: number, qualifications: ReturnType<typeof qual>[], match = false) => ({
  id,
  name,
  employee_id: `E-${1000 + id}`,
  image_url: null,
  department: null,
  courses: { completed: 1, total: 2, label: '1 of 2' },
  qualifications_total: qualifications.length,
  qualifications_completed: qualifications.filter((q) => q.earned).length,
  qualification_breakdown: qualifications,
  qualification_match: match,
  completion_percent: percent,
});

const QA = () => qual(10, 'Fixture Qualification A', [
  course(100, 'Fixture Course Done', 'completed', 100),
  course(101, 'Fixture Course Never', 'unenrolled', 0),
  course(102, 'Fixture Course Going', 'in_progress', 50),
]);
const QB = () => qual(11, 'Fixture Qualification B', [course(103, 'Fixture Course Other', 'in_progress', 20)]);

const LEARNERS = [
  learner(1, 'Fixture Learner One', 50, [QA(), QB()]),
  learner(2, 'Fixture Learner Two', 100, [qual(10, 'Fixture Qualification A', [], true), QB()]),
  learner(3, 'Fixture Learner Three', 0, [QA(), QB(), qual(12, 'Fixture Qualification C', [])]),
  // Seven more, so the list spans two pages of eight and the pager is exercised.
  ...[4, 5, 6, 7, 8, 9, 10].map((n) => learner(n, `Fixture Learner ${n}`, 25, [QB()])),
];
const PER_PAGE = 8;

async function answerWithFixture(page: Page): Promise<string[]> {
  const searches: string[] = [];
  await page.route('**/api/v1/job-titles/4242', (route) =>
    route.fulfill({ json: { status: true, result: { id: 4242, name: 'Fixture Job Title' } } }),
  );
  // The real response shape: `result` is the page's rows, `meta` sits beside it.
  await page.route('**/api/v1/admin/job-titles/4242/learners**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const current = Number(params.get('page') ?? '1');
    const search = params.get('search');
    if (search) searches.push(search);
    // A qualification search: every learner, narrowed to the match.
    const rows = search
      ? LEARNERS.slice(0, 2).map((l) => ({ ...l, qualification_match: true, qualification_breakdown: [l.qualification_breakdown[1]] }))
      : LEARNERS.slice((current - 1) * PER_PAGE, current * PER_PAGE);
    const total = search ? 2 : LEARNERS.length;
    return route.fulfill({
      json: {
        status: 'success',
        message: '',
        result: rows,
        meta: { current_page: current, last_page: Math.ceil(total / PER_PAGE), per_page: PER_PAGE, total },
      },
    });
  });
  return searches;
}

for (const locale of [{ code: 'en', dir: 'ltr' }, { code: 'ar', dir: 'rtl' }] as const) {
  test(`job title detail tree - ${locale.code}`, async ({ page }, testInfo) => {
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale.code] as const);
    const searches = await answerWithFixture(page);
    const en = locale.code === 'en';

    await page.goto('/admin/job-titles/4242');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
    await expect(page.locator('.jtd__title')).toHaveText('Fixture Job Title');
    await expect(page.locator('#jtd-search')).toHaveAttribute('placeholder',
      en ? 'Search by learner or qualification...' : 'ابحث باسم المتعلم أو المؤهل...');

    const learnerToggles = page.locator('.jtd__row--learner .jtd__chevron');
    await expect(learnerToggles).toHaveCount(PER_PAGE);

    // Figma: the first learner and its first qualification are open.
    await expect(learnerToggles.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(learnerToggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.jtd__row--qual')).toHaveCount(2);
    const qualToggles = page.locator('.jtd__row--qual .jtd__chevron');
    await expect(qualToggles.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(qualToggles.nth(1)).toHaveAttribute('aria-expanded', 'false');

    // Level 3: the three courses of qualification A, with pill, text and bar.
    const courses = page.locator('.jtd__row--course');
    await expect(courses).toHaveCount(3);
    await expect(courses.nth(0).locator('.jtd__course-name')).toHaveText('Fixture Course Done');
    const pills = courses.locator('.jtd__pill');
    const states = courses.locator('.jtd__of');
    if (en) {
      await expect(pills).toHaveText(['Completed', 'Unenrolled', 'In Progress']);
      await expect(states).toHaveText(['Completed', 'Not Yet', 'In Progress']);
    } else {
      await expect(pills).toHaveText(['مكتملة', 'غير مسجل', 'قيد التقدم']);
      await expect(states).toHaveText(['مكتملة', 'لم يبدأ بعد', 'قيد التقدم']);
    }
    const ratios = await courses.locator('.jtd__bar').evaluateAll((bars) =>
      bars.map((b) => {
        const fill = b.firstElementChild as HTMLElement;
        return Math.round((fill.getBoundingClientRect().width / b.getBoundingClientRect().width) * 100);
      }),
    );
    expect(ratios).toEqual([100, 0, 50]);

    // Plural forms, per locale (D-051).
    const learnerRow = page.locator('.jtd__row--learner').first();
    const qualRow = page.locator('.jtd__row--qual').first();
    if (en) {
      await expect(learnerRow.locator('td').nth(1)).toHaveText('2 qualifications');
      await expect(learnerRow.locator('.jtd__of')).toHaveText('0 of 2 qualifications');
      await expect(qualRow.locator('td').nth(1)).toHaveText('3 courses');
      await expect(qualRow.locator('.jtd__of')).toHaveText('1 of 3 Courses');
    } else {
      await expect(learnerRow.locator('td').nth(1)).toHaveText('مؤهلان');
      await expect(learnerRow.locator('.jtd__of')).toHaveText('0 من مؤهلين');
      await expect(qualRow.locator('td').nth(1)).toHaveText('3 دورات');
      await expect(qualRow.locator('.jtd__of')).toHaveText('1 من 3 دورات');
    }

    // The connector elbows sit on the start side: left in LTR, right in RTL.
    const elbowSide = await page.locator('.jtd__row--qual .jtd__conn--elbow').first().evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return { start: after.insetInlineStart, left: after.left, right: after.right };
    });
    expect(elbowSide.start).toBe('15px');
    if (locale.dir === 'ltr') expect(elbowSide.left).toBe('15px');
    else expect(elbowSide.right).toBe('15px');

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${testInfo.project.name}-${locale.code}.png`), fullPage: true });

    // Closing the qualification hides its courses; keyboard closes the learner.
    await qualToggles.nth(0).click();
    await expect(courses).toHaveCount(0);
    await learnerToggles.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.jtd__row--qual')).toHaveCount(0);

    // A direct grant reads "Granted directly" on its qualification row.
    await learnerToggles.nth(1).click();
    await expect(page.locator('.jtd__row--qual .jtd__of').first()).toHaveText(en ? 'Granted directly' : 'مُنح مباشرة');

    // Pager.
    const info = page.locator('.jtd__pager-info');
    await expect(info).toHaveText(en ? 'Showing 1-8 of 10 learners' : 'عرض 1-8 من 10 متعلم');
    await page.locator('.jtd__pager-btn--next').click();
    await expect(info).toHaveText(en ? 'Showing 9-10 of 10 learners' : 'عرض 9-10 من 10 متعلم');

    // A qualification search opens the matched rows down to their courses.
    await page.locator('#jtd-search').fill('qualification b');
    await expect.poll(() => searches.at(-1)).toBe('qualification b');
    await expect(page.locator('.jtd__row--learner')).toHaveCount(2);
    await expect(page.locator('.jtd__row--qual')).toHaveCount(2);
    await expect(page.locator('.jtd__row--course')).toHaveCount(2);

    // No page-level horizontal scroll; the table scrolls inside its card.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // No raw translation keys.
    const text = await page.locator('main, body').first().innerText();
    expect(text.match(/\bjob_titles\.[a-z_.]+/g) ?? []).toEqual([]);
  });
}
