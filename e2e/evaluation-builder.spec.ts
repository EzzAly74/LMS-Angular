import { expect, Page, Request, test } from '@playwright/test';

/**
 * Evaluation template builder and the templates list's Create / Import /
 * Export (D4; Figma 2409:132793, 2409:133222, 2009:88432).
 *
 * The builder's options, and every write, are answered here, so a run never
 * creates templates in the dev database; the request the page sends is
 * asserted exactly - that is the contract with the API.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';
const OPTIONS = {
  courses: [
    { id: 11, name: 'Excel', cohorts: [{ id: 101, name: 'Morning' }, { id: 102, name: 'Evening' }] },
    { id: 12, name: 'Safety', cohorts: [] },
  ],
  pass_threshold: 3,
  score_max: 5,
};

async function english(page: Page): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
}

async function mockOptions(page: Page): Promise<void> {
  await page.route('**/api/v1/admin/evaluations/templates/options', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: OPTIONS } }),
  );
}

async function pick(page: Page, dropdown: ReturnType<Page['locator']>, option: string): Promise<void> {
  await dropdown.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('publishing sends the whole template and opens its results', async ({ page }) => {
  await english(page);
  await mockOptions(page);
  const posts: Request[] = [];
  await page.route('**/api/v1/admin/evaluations/templates', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    posts.push(r.request());
    return r.fulfill({ status: 201, json: { status: 'success', message: '', result: { id: 77 } } });
  });
  await page.route('**/api/v1/admin/evaluations/77/results', (r) => r.fulfill({ status: 404, json: { status: 'error', message: '' } }));

  await page.goto('/admin/evaluations/new');
  const publish = page.getByRole('button', { name: 'Publish Evaluation' });
  await expect(publish).toBeDisabled();

  await page.getByLabel('Template Name (English)').fill('Course Feedback');
  await page.getByLabel('Template Name (Arabic)').fill('تقييم الدورة');
  await pick(page, page.locator('p-dropdown').first(), 'Excel');
  // Choosing a course reveals its cohorts.
  await pick(page, page.locator('p-dropdown').nth(1), 'Evening');
  await expect(page.locator('.tb__chip')).toHaveText(['Excel', 'Evening']);

  const q1 = page.locator('.tb__q').nth(0);
  await q1.getByLabel('Question (English)').fill('Clear?');
  await q1.getByLabel('Question (Arabic)').fill('واضح؟');
  await expect(publish).toBeEnabled();

  // "Type of questions" is the template's type (D-061): questions have no Type of their own.
  await page.getByRole('button', { name: 'Add Question' }).click();
  const q2 = page.locator('.tb__q').nth(1);
  await expect(page.locator('.tb__q p-dropdown')).toHaveCount(0);
  await q2.getByLabel('Question (English)').fill('Pace');
  await q2.getByLabel('Question (Arabic)').fill('السرعة');
  await expect(publish).toBeEnabled();

  // Switching to scale applies to both questions, which then need their end labels.
  await pick(page, page.locator('p-dropdown').nth(2), 'Evaluation Scale');
  await expect(publish).toBeDisabled();
  for (const [q, lo, hi] of [[q1, 'Not clear', 'Very clear'], [q2, 'Unsatisfied', 'Very satisfied']] as const) {
    await expect(q.locator('.tb__stars')).toHaveCount(0);
    await q.getByLabel('Evaluation “1” (English)').fill(lo);
    await q.getByLabel('Evaluation “5” (English)').fill(hi);
    await q.getByLabel('Evaluation “1” (Arabic)').fill(lo + ' ع');
    await q.getByLabel('Evaluation “5” (Arabic)').fill(hi + ' ع');
  }
  await q2.getByRole('switch', { name: 'Required' }).uncheck();
  await expect(page.locator('.tb__summary-num')).toHaveText('2');
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page).toHaveURL(/\/admin\/evaluations\/77$/);
  expect(posts).toHaveLength(1);
  expect(posts[0].postDataJSON()).toEqual({
    name: { en: 'Course Feedback', ar: 'تقييم الدورة' },
    course_id: 11,
    section_id: 102,
    questions: [
      {
        title: { en: 'Clear?', ar: 'واضح؟' }, type: 'scale', required: true,
        scale_label_min: { en: 'Not clear', ar: 'Not clear ع' }, scale_label_max: { en: 'Very clear', ar: 'Very clear ع' },
      },
      {
        title: { en: 'Pace', ar: 'السرعة' }, type: 'scale', required: false,
        scale_label_min: { en: 'Unsatisfied', ar: 'Unsatisfied ع' }, scale_label_max: { en: 'Very satisfied', ar: 'Very satisfied ع' },
      },
    ],
  });
});

test('the API refusal is shown and nothing navigates', async ({ page }) => {
  await english(page);
  await mockOptions(page);
  await page.route('**/api/v1/admin/evaluations/templates', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 422, json: { status: 'error', message: 'invalid', errors: { 'name.en': ['Another evaluation template already has this name.'] } } })
      : r.fallback(),
  );
  await page.goto('/admin/evaluations/new');
  await page.getByLabel('Template Name (English)').fill('Taken');
  await page.getByLabel('Template Name (Arabic)').fill('مأخوذ');
  await page.locator('.tb__q').nth(0).getByLabel('Question (English)').fill('Q');
  await page.locator('.tb__q').nth(0).getByLabel('Question (Arabic)').fill('س');
  await page.getByRole('button', { name: 'Publish Evaluation' }).click();

  await expect(page.locator('.tb__alert')).toHaveText('Another evaluation template already has this name.');
  await expect(page).toHaveURL(/\/admin\/evaluations\/new$/);
});

test('an answered template opens read-only, with no form to submit', async ({ page }) => {
  await english(page);
  await mockOptions(page);
  await page.route('**/api/v1/admin/evaluations/templates/5', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: {
      id: 5, name: { en: 'Used', ar: 'مستخدم' }, course: null, cohort: null, locked: true,
      highest_score: 4.2, score_max: 5, questions: [], created_at: null,
    } } }),
  );
  await page.goto('/admin/evaluations/5/edit');

  await expect(page.getByRole('alert')).toContainText('can no longer be edited');
  await expect(page.locator('form#tb-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Save Evaluation|Publish Evaluation/ })).toHaveCount(0);
});

test('Edit is offered only on templates nobody has answered', async ({ page }) => {
  await english(page);
  const row = (id: number, name: string, locked: boolean) => ({
    id, name, course: null, cohort: null, locked, questions: 1, submissions: locked ? 1 : 0,
    learners_scored: locked ? 1 : 0, learners_eligible: 3, score: locked ? 4 : null, passed: locked ? true : null,
    last_scored_at: null, created_at: '2026-09-26 10:00:00', updated_at: '2026-09-26 10:00:00',
  });
  await page.route('**/api/v1/admin/evaluations/templates?**', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: [row(1, 'Fresh', false), row(2, 'Answered', true)],
      meta: { current_page: 1, last_page: 1, per_page: 8, total: 2 } } }),
  );
  await page.goto('/admin/evaluations');
  const cards = page.locator('.tl__tcard');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('link', { name: /Edit/ })).toHaveAttribute('href', '/admin/evaluations/1/edit');
  await expect(cards.nth(1).getByRole('link', { name: /Edit/ })).toHaveCount(0);
});

test('an import with problems writes nothing and lists them by row', async ({ page }) => {
  await english(page);
  await page.route('**/api/v1/admin/evaluations/templates/import', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: {
      created: 0, questions: 0,
      errors: [
        { row: 3, column: 'type', message: 'Type must be star or scale.' },
        { row: 5, column: 'template_name_en', message: 'Another evaluation template already has this name.' },
      ],
    } } }),
  );
  await page.goto('/admin/evaluations');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Import' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Upload a file…' }).click();
  await (await chooser).setFiles({ name: 'templates.csv', mimeType: 'text/csv', buffer: Buffer.from('template_name_en\n') });

  const dialog = page.getByRole('dialog', { name: 'Import not completed' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await expect(dialog.locator('tbody tr').first()).toContainText('3');
  await expect(dialog.locator('tbody tr').first()).toContainText('Type must be star or scale.');
});

test('Export downloads the list with the filters that are applied', async ({ page }) => {
  await english(page);
  const exports: string[] = [];
  await page.route('**/api/v1/admin/evaluations/templates/export?**', (r) => {
    exports.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'text/csv', body: 'template_name_en\n' });
  });
  await page.goto('/admin/evaluations');
  await page.waitForLoadState('networkidle');
  await page.getByRole('checkbox', { name: 'Failed' }).check();

  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'CSV (.csv)' }).click();
  expect((await download).suggestedFilename()).toBe('evaluation-templates.csv');

  const q = new URL(exports[0]).searchParams;
  expect(q.get('format')).toBe('csv');
  expect(q.getAll('results[]')).toEqual(['failed']);
  expect(q.get('page')).toBeNull();
});
