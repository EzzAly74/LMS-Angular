import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Add Quiz / Add Assignment (Figma 1982:41913, 1983:44040; D-066, B-137).
 * Runs against the real API for courses and cohorts; saves are intercepted
 * so nothing is written.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/assessment-form');
const ok = (result: unknown) => ({ status: 'success', message: '', result });

async function interceptSave(page: Page, kind: 'quizzes' | 'assignments'): Promise<Request[]> {
  const saves: Request[] = [];
  await page.route(`**/api/v1/admin/${kind}`, r => {
    if (r.request().method() !== 'POST') return r.fallback();
    saves.push(r.request());
    return r.fulfill({ json: ok({ id: 999999, questions: [] }) });
  });
  return saves;
}

/** The local API serves one request at a time; the form needs ~10 s to be ready. */
async function ready(page: Page): Promise<void> {
  await expect(page.locator('.af-question')).toHaveCount(1, { timeout: 45_000 });
}

async function pick(page: Page, label: string | RegExp, option: string | RegExp): Promise<void> {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

test.setTimeout(120_000);

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  });

  test('assignment: Figma text, cohorts are the course cohorts, and Save waits for every required field', async ({ page }) => {
    const saves = await interceptSave(page, 'assignments');
    await page.goto('/admin/assignments/new');
    await ready(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add Assignment');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Create Assignment');
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect(save).toBeDisabled();

    // B-137: no course, no cohort scope.
    await expect(page.getByRole('combobox', { name: 'Cohort scope' })).toHaveAttribute('aria-disabled', 'true');

    await page.getByLabel('Assignment title (English)').fill('Safety readiness assessment');
    await page.getByLabel('Assignment title (Arabic)').fill('تقييم الجاهزية');
    await pick(page, 'Course', 'Management Course');
    await page.getByLabel('Pre-course').check();
    await pick(page, 'Cohort scope', 'Specific Cohort');

    const cohorts = page.getByRole('list', { name: 'Cohorts' });
    await expect(cohorts.getByRole('checkbox')).toHaveCount(2);
    await expect(cohorts).toContainText('First Group');
    await expect(cohorts).toContainText('Second Group');
    await expect(cohorts).not.toContainText('session');
    await cohorts.getByLabel('Second Group').check();

    // One radio at a time, drawn as checkboxes.
    await page.getByLabel('Post-course').check();
    await expect(page.getByLabel('Pre-course')).not.toBeChecked();

    // Question 1: Yes/No with its single key dropdown.
    await page.getByLabel('Question (English)').fill('Is PPE required?');
    await page.getByLabel('Question (Arabic)').fill('هل معدات الوقاية مطلوبة؟');
    await pick(page, /^Type/, 'Yes/No');
    await expect(page.getByRole('combobox', { name: 'Correct answer / grading key' })).toBeVisible();
    await expect(save).toBeDisabled();
    await pick(page, 'Correct answer / grading key', 'Yes');
    await page.getByRole('button', { name: 'Increase score' }).click();
    await expect(save).toBeEnabled();

    await save.click();
    await expect.poll(() => saves.length).toBe(1);
    const body = saves[0].postDataJSON() as Record<string, unknown> & { questions: Record<string, unknown>[] };
    expect(body).toMatchObject({ type: 'post', title_ar: 'تقييم الجاهزية', cohort_scope: 'specific' });
    expect((body['cohort_ids'] as number[]).length).toBe(1);
    expect(body.questions[0]).toMatchObject({
      type: 'yes_no', score: 1, options_en: ['Yes', 'No'], options_ar: ['نعم', 'لا'], correct_answer_en: 'Yes', correct_answer_ar: 'نعم',
    });
  });

  test('quiz: reorder items are the key, typed in order', async ({ page }) => {
    const saves = await interceptSave(page, 'quizzes');
    await page.goto('/admin/quizzes/new');
    await ready(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add Quiz');
    await page.getByLabel('Quiz title (English)').fill('Spill response');
    await page.getByLabel('Quiz title (Arabic)').fill('الاستجابة للانسكاب');
    await pick(page, 'Course', 'Management Course');
    await page.getByLabel('Mid-course').check();

    await page.getByLabel('Question (English)').fill('Put the steps in order');
    await page.getByLabel('Question (Arabic)').fill('رتب الخطوات');
    await pick(page, /^Type/, 'Reorder');
    await expect(page.getByText('Correct order / grading key (English)')).toBeVisible();

    const en = page.getByRole('group', { name: 'Correct order / grading key (English)' });
    const ar = page.getByRole('group', { name: 'Correct order / grading key (Arabic)' });
    await en.getByRole('button', { name: 'Add' }).click();
    await en.getByLabel('Order 1', { exact: true }).fill('Assess');
    await en.getByLabel('Order 2', { exact: true }).fill('Contain');
    await en.getByLabel('Order 3', { exact: true }).fill('Report');
    await ar.getByLabel('Order 1', { exact: true }).fill('قيّم');
    await ar.getByLabel('Order 2', { exact: true }).fill('احتوِ');
    await page.getByRole('spinbutton', { name: 'Score', exact: true }).fill('20');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => saves.length).toBe(1);
    const q = (saves[0].postDataJSON() as { questions: Record<string, unknown>[] }).questions[0];
    expect(q).toMatchObject({
      type: 'reorder', options_en: ['Assess', 'Contain', 'Report'], options_ar: ['قيّم', 'احتوِ'],
      correct_answer_en: JSON.stringify(['Assess', 'Contain', 'Report']), correct_answer_ar: JSON.stringify(['قيّم', 'احتوِ']),
    });
  });
});

for (const kind of ['assignments', 'quizzes'] as const) {
  for (const locale of ['en', 'ar'] as const) {
    test(`${kind} form fits and reads ${locale}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
      await page.goto(`/admin/${kind}/new`);
      await ready(page);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const text = await page.locator('body').innerText();
      expect(text.match(/\b(quizzes|assignments|common)\.[a-z_.]+/g) ?? []).toEqual([]);

      mkdirSync(ARTIFACTS, { recursive: true });
      await page.screenshot({ path: resolve(ARTIFACTS, `${kind}-${info.project.name}-${locale}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}
