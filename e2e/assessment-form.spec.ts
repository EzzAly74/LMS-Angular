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
    // The course's cohorts come from the real API; the list shows exactly those.
    const courseCohorts = page.waitForResponse(r => r.url().includes('/admin/assignments/cohorts?') && r.url().includes('course_id='));
    await pick(page, 'Course', 'Management Course');
    const cohortCount = ((await (await courseCohorts).json()) as { result: unknown[] }).result.length;
    expect(cohortCount).toBeGreaterThanOrEqual(2);
    await page.getByLabel('Pre-course').check();
    await pick(page, 'Cohort scope', 'Specific Cohort');

    const cohorts = page.getByRole('list', { name: 'Cohorts' });
    await expect(cohorts.getByRole('checkbox')).toHaveCount(cohortCount);
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
    await page.locator('#af-q-score-0').fill('1'); // no chevrons on number fields (2026-10-18)
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

  test('quiz: reorder items are typed in any order and dragged into the key', async ({ page }) => {
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

    // One card per item, English and Arabic side by side; typed out of order.
    const editor = page.getByRole('group', { name: 'Items and their correct order' });
    await editor.getByRole('button', { name: 'Add item' }).click();
    await expect(editor.getByLabel('Item 3 (English)')).toBeFocused();
    const typed = [['Report', 'أبلغ'], ['Assess', 'قيّم'], ['Contain', 'احتوِ']];
    for (const [n, [en, ar]] of typed.entries()) {
      await editor.getByLabel(`Item ${n + 1} (English)`).fill(en);
      await editor.getByLabel(`Item ${n + 1} (Arabic)`).fill(ar);
    }

    // Keyboard: "Report" goes from 1st to last with Arrow Down on its handle.
    const handle1 = editor.getByRole('button', { name: 'Move item 1 of 3' });
    await handle1.focus();
    await page.keyboard.press('ArrowDown');
    await expect(editor.getByRole('button', { name: 'Move item 2 of 3' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(editor.getByLabel('Item 3 (English)')).toHaveValue('Report');
    await expect(editor.getByLabel('Item 3 (Arabic)')).toHaveValue('أبلغ');
    await expect(page.getByText('Moved to position 3 of 3')).toBeAttached();

    // Mouse: drag "Contain" (2nd) above "Assess" (1st), then back.
    const drag = async (from: number, to: number) => {
      const a = (await editor.getByRole('button', { name: `Move item ${from} of 3` }).boundingBox())!;
      const b = (await editor.getByRole('button', { name: `Move item ${to} of 3` }).boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + (to > from ? 8 : -8), { steps: 4 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + (to > from ? 12 : -12), { steps: 12 });
      await page.mouse.up();
    };
    await drag(2, 1);
    await expect(editor.getByLabel('Item 1 (English)')).toHaveValue('Contain');
    await drag(1, 2);
    await expect(editor.getByLabel('Item 1 (English)')).toHaveValue('Assess');

    await page.getByRole('spinbutton', { name: 'Score', exact: true }).fill('20');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => saves.length).toBe(1);
    const q = (saves[0].postDataJSON() as { questions: Record<string, unknown>[] }).questions[0];
    expect(q).toMatchObject({
      type: 'reorder', options_en: ['Assess', 'Contain', 'Report'], options_ar: ['قيّم', 'احتوِ', 'أبلغ'],
      correct_answer_en: JSON.stringify(['Assess', 'Contain', 'Report']), correct_answer_ar: JSON.stringify(['قيّم', 'احتوِ', 'أبلغ']),
    });
  });

  test('assignment: the MCQ key is one dropdown over the paired options (NEW2B-6289)', async ({ page }) => {
    const saves = await interceptSave(page, 'assignments');
    await page.goto('/admin/assignments/new');
    await ready(page);

    await page.getByLabel('Assignment title (English)').fill('Safety basics');
    await page.getByLabel('Assignment title (Arabic)').fill('أساسيات السلامة');
    await pick(page, 'Course', 'Management Course');
    await page.getByLabel('Mid-course').check();
    await page.getByLabel('Question (English)').fill('Which colour means stop?');
    await page.getByLabel('Question (Arabic)').fill('أي لون يعني توقف؟');
    // A new question starts as MCQ.

    const en = page.getByRole('group', { name: 'MCQ Options (English)' });
    const ar = page.getByRole('group', { name: 'MCQ Options (Arabic)' });
    await en.getByLabel('Option 1', { exact: true }).fill('Green');
    await en.getByLabel('Option 2', { exact: true }).fill('Red');
    await ar.getByLabel('Option 1', { exact: true }).fill('أخضر');
    await ar.getByLabel('Option 2', { exact: true }).fill('أحمر');
    await expect(page.getByRole('textbox', { name: /grading key/ })).toHaveCount(0);
    await pick(page, 'Correct answer / grading key', '2. Red');
    await page.locator('#af-q-score-0').fill('1'); // no chevrons on number fields (2026-10-18)

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => saves.length).toBe(1);
    const q = (saves[0].postDataJSON() as { questions: Record<string, unknown>[] }).questions[0];
    expect(q).toMatchObject({
      type: 'mcq', options_en: ['Green', 'Red'], options_ar: ['أخضر', 'أحمر'], correct_answer_en: 'Red', correct_answer_ar: 'أحمر',
    });
  });
});

for (const kind of ['assignments', 'quizzes'] as const) {
  for (const locale of ['en', 'ar'] as const) {
    test(`${kind} form fits and reads ${locale}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      // The realtime client cannot reach the broadcast server when it is not running locally; that is not this page.
      page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('WebSocket connection to')) errors.push(m.text()); });
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

for (const locale of ['en', 'ar'] as const) {
  test(`reorder editor fits and reads ${locale}`, async ({ page }, info) => {
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    await page.goto('/admin/quizzes/new');
    await ready(page);
    await page.getByRole('combobox', { name: locale === 'en' ? /^Type/ : /^النوع/ }).click();
    await page.getByRole('option', { name: locale === 'en' ? 'Reorder' : /ترتيب/ }).click();

    const editor = page.locator('nas-order-editor');
    await expect(editor.locator('.oe__card')).toHaveCount(2);
    await editor.locator('.oe__add').click();
    await expect(editor.locator('.oe__card')).toHaveCount(3);
    await expect(editor.locator('.oe__connector')).toHaveCount(2);
    const text = await editor.innerText();
    expect(text.match(/\border_editor\.[a-z_]+/g) ?? []).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    mkdirSync(ARTIFACTS, { recursive: true });
    await editor.screenshot({ path: resolve(ARTIFACTS, `reorder-editor-${info.project.name}-${locale}.png`) });
  });
}
