import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Job title detail (D1, Figma 2325:117118) with a POPULATED tree.
 *
 * layout.spec.ts visits the real page against the dev database, where no user
 * holds a job title yet, so it only ever sees the empty state. This spec
 * answers the two API calls the page makes with a fixed response, so the tree
 * itself - rows, expansion, plural forms, bars - is checked at every width in
 * both languages. The fixture exists only inside this test; nothing ships.
 */

const LOCALE_KEY = '2b_locale';
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/job-title-detail-fixture');

const learner = (id: number, name: string, percent: number, qualifications: unknown[]) => ({
  id,
  name,
  employee_id: `E-${1000 + id}`,
  image_url: null,
  department: null,
  courses: { completed: 1, total: 2, label: '1 of 2' },
  qualifications_total: qualifications.length,
  qualifications_completed: (qualifications as { earned: boolean }[]).filter((q) => q.earned).length,
  qualification_breakdown: qualifications,
  completion_percent: percent,
});

const qual = (id: number, name: string, done: number, total: number, direct = false) => ({
  id,
  name,
  courses_total: total,
  courses_completed: done,
  percent: direct ? 100 : total ? Math.round((done * 100) / total) : 0,
  granted_directly: direct,
  earned: direct || (total > 0 && done >= total),
});

const LEARNERS = [
  learner(1, 'Fixture Learner One', 50, [qual(10, 'Fixture Qualification A', 1, 1), qual(11, 'Fixture Qualification B', 0, 2)]),
  learner(2, 'Fixture Learner Two', 100, [qual(10, 'Fixture Qualification A', 0, 0, true), qual(11, 'Fixture Qualification B', 2, 2)]),
  learner(3, 'Fixture Learner Three', 0, [qual(10, 'Fixture Qualification A', 0, 1), qual(11, 'Fixture Qualification B', 0, 2), qual(12, 'Fixture Qualification C', 0, 3)]),
  // Seven more, so the list spans two pages of eight and the pager is exercised.
  ...[4, 5, 6, 7, 8, 9, 10].map((n) => learner(n, `Fixture Learner ${n}`, 25, [qual(10, 'Fixture Qualification A', 0, 1)])),
];
const PER_PAGE = 8;

async function answerWithFixture(page: Page): Promise<void> {
  await page.route('**/api/v1/job-titles/4242', (route) =>
    route.fulfill({ json: { status: true, result: { id: 4242, name: 'Fixture Job Title' } } }),
  );
  // The real response shape: `result` is the page's rows, `meta` sits beside it
  // (ApiResponse::paginated). Honours `page`, like the endpoint.
  await page.route('**/api/v1/admin/job-titles/4242/learners**', (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
    return route.fulfill({
      json: {
        status: 'success',
        message: '',
        result: LEARNERS.slice((current - 1) * PER_PAGE, current * PER_PAGE),
        meta: { current_page: current, last_page: Math.ceil(LEARNERS.length / PER_PAGE), per_page: PER_PAGE, total: LEARNERS.length },
      },
    });
  });
}

for (const locale of [{ code: 'en', dir: 'ltr' }, { code: 'ar', dir: 'rtl' }] as const) {
  test(`job title detail tree - ${locale.code}`, async ({ page }, testInfo) => {
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale.code] as const);
    await answerWithFixture(page);

    await page.goto('/admin/job-titles/4242');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);
    await expect(page.locator('.jtd__title')).toHaveText('Fixture Job Title');

    const toggles = page.locator('.jtd__toggle');
    await expect(toggles).toHaveCount(PER_PAGE);

    // The first learner opens by default, as in Figma; the others are closed.
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.jtd__row--child')).toHaveCount(2);

    // Mouse opens the second; keyboard closes the first.
    await toggles.nth(1).click();
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await toggles.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.jtd__row--child')).toHaveCount(2);

    // Plural forms and the direct-grant label, per locale (D-051).
    const assigned = page.locator('.jtd__assigned-count');
    const of = page.locator('.jtd__row--parent .jtd__of');
    const child = page.locator('.jtd__row--child .jtd__of');
    if (locale.code === 'en') {
      await expect(assigned.nth(0)).toHaveText('2 qualifications');
      await expect(assigned.nth(2)).toHaveText('3 qualifications');
      await expect(of.nth(0)).toHaveText('1 of 2 qualifications');
      await expect(child.nth(0)).toHaveText('Granted directly');
      await expect(child.nth(1)).toHaveText('2 of 2 Courses');
    } else {
      await expect(assigned.nth(0)).toHaveText('مؤهلان');
      await expect(assigned.nth(2)).toHaveText('3 مؤهلات');
      await expect(of.nth(0)).toHaveText('1 من مؤهلين');
      await expect(child.nth(0)).toHaveText('مُنح مباشرة');
      await expect(child.nth(1)).toHaveText('2 من دورتين');
    }

    // A Latin name is truncated at its own end in both layouts, and aligned
    // with the column's start: left in LTR, right in RTL.
    const name = page.locator('.jtd__name').first();
    const nameBox = await name.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { dir: getComputedStyle(el).direction, leftGap: text.left - box.left, rightGap: box.right - text.right };
    });
    expect(nameBox.dir).toBe('ltr');
    if (locale.dir === 'rtl') expect(nameBox.rightGap).toBeLessThanOrEqual(1);
    else expect(nameBox.leftGap).toBeLessThanOrEqual(1);

    // Each bar is filled to its percentage of the track.
    const ratios = await page.locator('.jtd__row--parent .jtd__bar').evaluateAll((bars) =>
      bars.map((b) => {
        const fill = b.firstElementChild as HTMLElement;
        return Math.round((fill.getBoundingClientRect().width / b.getBoundingClientRect().width) * 100);
      }),
    );
    expect(ratios.slice(0, 3)).toEqual([50, 100, 0]);

    // The pager: page 1 of 2, previous disabled, next moves on.
    const info = page.locator('.jtd__pager-info');
    const prev = page.locator('.jtd__pager-btn--prev');
    const next = page.locator('.jtd__pager-btn--next');
    await expect(info).toHaveText(locale.code === 'en' ? 'Showing 1-8 of 10' : 'عرض 1-8 من 10');
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    // The arrows point the reading direction: in RTL "previous" points right.
    const pointsRight = (loc: typeof prev) =>
      loc.locator('img').evaluate((img) => new DOMMatrix(getComputedStyle(img).transform).b < 0);
    expect(await pointsRight(next)).toBe(locale.dir === 'ltr');
    expect(await pointsRight(prev)).toBe(locale.dir === 'rtl');

    // No page-level horizontal scroll; the table scrolls inside its card.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // No raw translation keys.
    const text = await page.locator('main, body').first().innerText();
    expect(text.match(/\bjob_titles\.detail\.[a-z_.]+/g) ?? []).toEqual([]);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${testInfo.project.name}-${locale.code}.png`), fullPage: true });

    await next.click();
    await expect(info).toHaveText(locale.code === 'en' ? 'Showing 9-10 of 10' : 'عرض 9-10 من 10');
    await expect(toggles).toHaveCount(2);
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();
  });
}
