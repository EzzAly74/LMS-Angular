import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Evaluation Templates (Figma 2009:88432) and View Learners scores
 * (2017:52260) on the shared list (D-070): search, the Filter modal (the
 * frames' chips, Result checks and From / To are its fields), sort, the eye
 * link, the ?template= scope and the pager. Mocked API in the real shapes.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/evaluation-lists');
const ok = (result: unknown) => ({ status: 'success', message: '', result });
const paged = (data: unknown[], total = data.length) => ({
  status: 'success', message: '', result: data, meta: { current_page: 1, last_page: Math.ceil(total / 8), per_page: 8, total },
});

const template = (id: number, name: string, score: number | null, passed: boolean | null) => ({
  id, name, course: { id: 8, name: 'Management Course' }, cohort: null, locked: false, questions: 5, submissions: 3,
  learners_scored: 3, learners_eligible: 12, score, passed, last_scored_at: '2026-09-29', created_at: '2026-09-20', updated_at: '2026-09-21',
});

const score = (learner: number, name: string, value: number, passed: boolean) => ({
  learner: { id: learner, name, employee_id: `AHL-0${learner}` }, course: { id: 8, name: 'Management Course' },
  template: { id: 5, name: 'Content & Delivery', created_at: '2026-09-20' },
  answers_count: 5, total: value * 5, max_total: 25, ratio: value / 5, score: value, passed, submitted_at: '2026-09-29',
});

async function mock(page: Page): Promise<{ templates: Request[]; scores: Request[]; learnerSearches: Request[] }> {
  const templates: Request[] = [];
  const scores: Request[] = [];
  const learnerSearches: Request[] = [];
  await page.route('**/api/v1/admin/evaluations/templates?**', r => {
    const perPage = new URL(r.request().url()).searchParams.get('per_page');
    if (perPage !== '2') templates.push(r.request());
    return r.fulfill({ json: paged([template(5, 'Content & Delivery', 4.4, true), template(6, 'Instructor', 2.1, false)], perPage === '2' ? 2 : 12) });
  });
  await page.route('**/api/v1/admin/evaluations/scores?**', r => {
    scores.push(r.request());
    return r.fulfill({ json: paged([score(63, 'Hesham Adly', 4, true), score(71, 'Adham Saif', 2.5, false)]) });
  });
  await page.route('**/api/v1/admin/evaluations/filter-options', r => r.fulfill({ json: ok({
    instructors: [{ id: 1, name: 'Mohamed Said' }], courses: [{ id: 8, name: 'Management Course' }],
  }) }));
  await page.route('**/api/v1/admin/evaluations/learner-options?**', r => {
    learnerSearches.push(r.request());
    return r.fulfill({ json: paged([{ id: 1963, name: 'Hesham Adly', employee_id: 'AHL-063' }]) });
  });
  return { templates, scores, learnerSearches };
}

const setLocale = (page: Page, locale: 'en' | 'ar') =>
  page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
const last = (list: Request[]) => new URL(list.at(-1)!.url()).searchParams;

/** Close an open multi-select list once it has settled (PrimeNG ignores a close mid-animation). */
async function closeList(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.fd-ms-panel');
    return !!el && el.getAnimations({ subtree: true }).length === 0;
  });
  await page.locator('.fd-ms-panel .p-multiselect-filter').press('Escape');
  await expect(page.locator('.fd-ms-panel')).toHaveCount(0);
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('templates: Filter modal with result and dates, sort, eye link', async ({ page }) => {
    await setLocale(page, 'en');
    const { templates } = await mock(page);
    await page.goto('/admin/evaluations');

    const rows = page.locator('.tl__row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.ev__chip')).toHaveCount(0);
    await expect(rows.first().locator('a.cl-view')).toHaveAttribute('href', '/admin/evaluations/5');
    await expect(page.locator('.nas-pager__info')).toContainText('of 12');

    // Sort by name, then the other way.
    await page.getByRole('button', { name: /^Template/ }).click();
    await expect.poll(() => last(templates).get('sort')).toBe('name');
    expect(last(templates).get('dir')).toBe('asc');
    await page.getByRole('button', { name: /^Template/ }).click();
    await expect.poll(() => last(templates).get('dir')).toBe('desc');

    const lookups = page.waitForResponse('**/api/v1/admin/evaluations/filter-options');
    await page.locator('.nlt__filter').click();
    await lookups;
    const d = page.getByRole('dialog', { name: 'Filter' });
    await expect(d.locator('.fd__label')).toHaveText(['Instructors', 'Courses', 'Result', 'Last scored from', 'Last scored to']);
    await expect(d.locator('nas-datepicker')).toHaveCount(2);

    await d.locator('.p-multiselect').nth(2).click();
    await page.getByRole('option', { name: 'Failed' }).click();
    await page.getByRole('option', { name: 'Unscored' }).click();
    await closeList(page);
    await d.locator('.p-multiselect').nth(0).click();
    await page.getByRole('option', { name: 'Mohamed Said' }).click();
    await closeList(page);
    await d.getByRole('button', { name: 'Filter' }).click();

    await expect.poll(() => last(templates).getAll('results[]')).toEqual(['failed', 'unscored']);
    expect(last(templates).getAll('instructor_ids[]')).toEqual(['1']);
    expect(last(templates).get('page')).toBe('1');
    await expect(page.locator('.nlt__badge')).toHaveText('2');

    // Search is debounced and trimmed.
    await page.getByLabel('Search templates').fill('  content ');
    await expect.poll(() => last(templates).get('search')).toBe('content');
  });

  test('scores: learners searched on the server, template scope, date sort', async ({ page }) => {
    await setLocale(page, 'en');
    const { scores, learnerSearches } = await mock(page);
    await page.goto('/admin/evaluations/scores?template=5');

    await expect(page.locator('.sl__row')).toHaveCount(2);
    expect(last(scores).get('template_id')).toBe('5');
    await expect(page.locator('.sl__scope')).toContainText('Content & Delivery');
    await expect(page.locator('.sl__row').first().locator('a.cl-view')).toHaveAttribute('href', '/admin/evaluations/scores/63/8?template=5');

    await page.locator('.nlt__filter').click();
    const d = page.getByRole('dialog', { name: 'Filter' });
    await expect(d.locator('.fd__label')).toHaveText(['Instructors', 'Learners', 'Courses']);
    await d.locator('.p-multiselect').nth(1).click();
    await page.locator('.fd-ms-panel .p-multiselect-filter').fill('hesham');
    await expect.poll(() => learnerSearches.map(r => new URL(r.url()).searchParams.get('search'))).toContain('hesham');
    await page.getByRole('option', { name: 'Hesham Adly · AHL-063' }).click();
    await closeList(page);
    await d.getByRole('button', { name: 'Filter' }).click();
    await expect.poll(() => last(scores).getAll('learner_ids[]')).toEqual(['1963']);

    await page.getByRole('button', { name: /^Last scored/i }).click();
    await expect.poll(() => last(scores).get('dir')).toBe('asc');

    // Removing the scope drops ?template= and reloads from page 1.
    await page.locator('.sl__scope-x').click();
    await expect(page).not.toHaveURL(/template=/);
    await expect.poll(() => last(scores).has('template_id')).toBe(false);
  });

  test('a failed load offers Retry', async ({ page }) => {
    await setLocale(page, 'en');
    await mock(page);
    let fail = true;
    await page.route('**/api/v1/admin/evaluations/scores?**', r => (fail ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fallback()));
    await page.goto('/admin/evaluations/scores');
    await expect(page.locator('nas-list-state [role=alert]')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.sl__row')).toHaveCount(2);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`evaluation lists fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await setLocale(page, locale);
    await mock(page);
    mkdirSync(ARTIFACTS, { recursive: true });

    for (const [path, rows, shot] of [['/admin/evaluations', '.tl__row', 'templates'], ['/admin/evaluations/scores', '.sl__row', 'scores']] as const) {
      await page.goto(path);
      await expect(page.locator(rows)).toHaveCount(2);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      expect((await page.locator('.cl-head').boundingBox())!.y).toBeLessThan(140);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const text = await page.locator('body').innerText();
      expect(text.match(/\b(evaluations|common|courses_list)\.[a-z_.]+/g) ?? []).toEqual([]);
      await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-${shot}.png`), fullPage: true });
      await page.locator('.nlt__filter').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-${shot}-filter.png`) });
    }
    expect(errors).toEqual([]);
  });
}
