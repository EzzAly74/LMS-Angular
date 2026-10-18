import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * "Generate with AI" in the quiz and assignment flows (backend D-113):
 * the button beside Add Quiz / Add Assignment opens the dialog; the generated
 * questions open in the Add form for review; the same button inside the
 * forms adds questions to the list. AI endpoints and list data are mocked in
 * the real response shapes; the forms are the real ones.
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/ai-questions');
const ok = (result: unknown) => ({ status: 'success', message: '', result });
const page1 = (data: unknown[]) => ({ status: 'success', message: '', result: data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length } });

const QUESTIONS = [
  { type: 'mcq', score: 2, question_en: 'What must stay clear at all times?', question_ar: 'ما الذي يجب أن يبقى خاليًا في كل الأوقات؟',
    options_en: ['Fire exits', 'Desks', 'Parking', 'Windows'], options_ar: ['مخارج الطوارئ', 'المكاتب', 'المواقف', 'النوافذ'],
    correct_answer_en: 'Fire exits', correct_answer_ar: 'مخارج الطوارئ', explanation_en: 'From the handbook.', explanation_ar: 'من الدليل.' },
  { type: 'yes_no', score: 2, question_en: 'Must near misses be reported within 24 hours?', question_ar: 'هل يجب الإبلاغ عن الحوادث الوشيكة خلال 24 ساعة؟',
    options_en: ['Yes', 'No'], options_ar: ['نعم', 'لا'], correct_answer_en: 'Yes', correct_answer_ar: 'نعم', explanation_en: null, explanation_ar: null },
  { type: 'open', score: 2, question_en: 'Why do we report near misses?', question_ar: 'لماذا نبلغ عن الحوادث الوشيكة؟',
    options_en: [], options_ar: [], correct_answer_en: null, correct_answer_ar: null,
    explanation_en: 'Expected answer: To prevent the next accident.', explanation_ar: 'الإجابة المتوقعة: لمنع الحادث التالي.' },
  { type: 'reorder', score: 2, question_en: 'Order the evacuation steps.', question_ar: 'رتّب خطوات الإخلاء.',
    options_en: ['Stop work', 'Leave by the nearest exit', 'Go to the assembly point'], options_ar: ['أوقف العمل', 'غادر من أقرب مخرج', 'اتجه إلى نقطة التجمع'],
    correct_answer_en: '["Stop work","Leave by the nearest exit","Go to the assembly point"]', correct_answer_ar: '["أوقف العمل","غادر من أقرب مخرج","اتجه إلى نقطة التجمع"]',
    explanation_en: null, explanation_ar: null },
];

const generation = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 41, target: 'quiz', status, error: null, error_message: null, counts: { mcq: 1, yes_no: 1, open: 1, reorder: 1 },
  sources: [{ name: 'Pasted text', kind: 'text' }], questions: status === 'succeeded' ? QUESTIONS : [],
  created_at: '2026-10-18T12:00:00Z', finished_at: null, ...extra,
});

interface Calls { starts: Request[] }

async function mock(page: Page, opts: { configured?: boolean; fail?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { starts: [] };
  const usage = { used: 3, limit: 30, configured: opts.configured ?? true };
  let polls = 0;

  // The harness account's real profile, plus quiz and assignment rights for these screens (the server still enforces them).
  await page.route('**/api/v1/auth/admin/me', async route => {
    // A permission refresh can fire as a test ends; the closed page needs no answer.
    const response = await route.fetch().catch(() => null);
    if (!response) return;
    const body = await response.json();
    const extra = ['quizzes', 'assignments'].flatMap(s => ['view', 'create', 'edit', 'delete'].map(a => `${a}-${s}`));
    body.result = {
      ...body.result,
      view_keys: [...new Set([...(body.result?.view_keys ?? []), 'view-quizzes', 'view-assignments'])],
      permissions: [...new Set([...(body.result?.permissions ?? []), ...extra])],
    };
    await route.fulfill({ response, json: body });
  });

  for (const section of ['quizzes', 'assignments'] as const) {
    const base = `**/api/v1/admin/${section}`;
    await page.route(`${base}/summary`, r => r.fulfill({ json: ok({ quizzes_count: 1, assignments_count: 1, courses_count: 1 }) }));
    await page.route(`${base}/instructors`, r => r.fulfill({ json: ok([{ id: 7, name: 'Nora Al-Fahad' }]) }));
    await page.route(`${base}?**`, r => r.fulfill({ json: page1([]) }));
    await page.route(`${base}/submissions?**`, r => r.fulfill({ json: page1([]) }));
    await page.route(`${base}/submissions/filter-options`, r => r.fulfill({ json: ok({ learners: [], instructors: [], items: [] }) }));
    await page.route(`${base}/list**`, r => r.fulfill({ json: ok([]) }));
    await page.route(`${base}/ai-generations/usage`, r => r.fulfill({ json: ok(usage) }));
    await page.route(`${base}/ai-generations`, r => {
      calls.starts.push(r.request());
      polls = 0;
      return r.fulfill({ status: 202, json: ok({ generation: generation('running'), usage: { ...usage, used: 4 } }) });
    });
    await page.route(`${base}/ai-generations/41`, r => {
      polls++;
      if (polls < 2) return r.fulfill({ json: ok(generation('running')) });
      return r.fulfill({ json: ok(opts.fail
        ? generation('failed', { error: 'provider_busy', error_message: 'The AI service is busy or its quota is used up. Try again later.' })
        : generation('succeeded')) });
    });
  }
  await page.route(/\/api\/v1\/courses\?/, r => r.fulfill({ json: page1([{ id: 1, title: 'Workplace Safety Essentials' }]) }));
  return calls;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  });

  test('quizzes page: Generate with AI opens the Add Quiz form with the questions', async ({ page }) => {
    const calls = await mock(page);
    await page.goto('/admin/quizzes');

    await expect(page.getByRole('button', { name: 'Generate with AI' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Quiz' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate with AI' }).click();

    const dialog = page.getByRole('dialog', { name: /Generate quiz questions with AI/ });
    await expect(dialog).toContainText('AI today: 3 / 30');

    // Step 1 with nothing to read from: explained, not moved on.
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Upload a file or paste at least 50 characters of course text.');
    await expect(dialog.locator('[aria-current=step]')).toContainText('Course material');

    await dialog.getByRole('button', { name: 'Paste text instead' }).click();
    await dialog.locator('#aig-text').fill('Fire exits must stay clear at all times. Report every near miss within 24 hours using the safety form.');
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 2: the Standard mix is preselected; counts are plain number fields (no − / + counters).
    await expect(dialog.locator('[aria-current=step]')).toContainText('Questions');
    await expect(dialog).toContainText('Questions: 10 · English + Arabic');
    await expect(dialog.getByRole('tab', { name: 'Standard · 10' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('button', { name: /increase|decrease|fewer|more .* questions/i })).toHaveCount(0);
    await dialog.getByRole('tab', { name: 'Quick check · 5' }).click();
    await expect(dialog).toContainText('Questions: 5 · English + Arabic');
    for (const type of ['mcq', 'yes_no', 'open', 'reorder']) await dialog.locator(`#aig-count-${type}`).fill('1');
    await dialog.getByRole('tab', { name: 'Hard' }).click();
    await dialog.getByText("Bloom's levels and learning objectives").click();
    await dialog.locator('#aig-score').fill('2');
    expect(calls.starts).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Generate (4)' }).click();

    await expect(dialog.getByRole('status')).toContainText('Writing 4 questions in English and Arabic');
    const sent = calls.starts[0].postDataBuffer()?.toString() ?? '';
    for (const part of ['name="counts[mcq]"', 'name="counts[yes_no]"', 'name="counts[open]"', 'name="counts[reorder]"', 'name="text"']) {
      expect(sent).toContain(part);
    }
    expect(sent).toMatch(/name="difficulty"\r\n\r\nhard/);
    expect(sent).toMatch(/name="score"\r\n\r\n2/);

    // Review: every question with its answer; leave one out, add the rest.
    await expect(dialog).toContainText('Questions ready: 4.', { timeout: 15_000 });
    await expect(dialog.locator('.af-question')).toHaveCount(4);
    await expect(dialog.locator('.aig-correct').first()).toContainText('Fire exits');
    await dialog.getByRole('checkbox', { name: 'Include question 3' }).uncheck();
    await dialog.getByRole('button', { name: 'Add questions (3)' }).click();

    // The Add Quiz form opens with the three questions, nothing saved.
    await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
    await expect(page.locator('.af-question')).toHaveCount(3);
    await expect(page.locator('#af-q-en-0')).toHaveValue('What must stay clear at all times?');
    await expect(page.locator('#af-q-en-2')).toHaveValue('Order the evacuation steps.');
    await expect(page.getByText('AI questions added: 3. Review them, then save.')).toBeVisible();
  });

  test('assignment form: Generate with AI adds to the questions in place', async ({ page }) => {
    await mock(page);
    await page.goto('/admin/assignments/new');
    await expect(page.locator('.af-question')).toHaveCount(1);

    await page.locator('.af-card--questions').getByRole('button', { name: 'Generate with AI' }).click();
    const dialog = page.getByRole('dialog', { name: /Generate assignment questions with AI/ });
    // A file the server would refuse is refused before upload.
    await dialog.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(dialog.getByRole('alert')).toContainText('"notes.txt" is not a PDF, DOCX or PPTX file.');
    await dialog.getByRole('button', { name: 'Paste text instead' }).click();
    await dialog.locator('#aig-text').fill('Fire exits must stay clear at all times. Report every near miss within 24 hours using the safety form.');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('File-upload questions are added by hand');
    for (const type of ['mcq', 'yes_no', 'open', 'reorder']) await dialog.locator(`#aig-count-${type}`).fill('1');
    await dialog.getByRole('button', { name: 'Generate (4)' }).click();
    await dialog.getByRole('button', { name: 'Add questions (4)' }).click({ timeout: 15_000 });

    // The empty starter question is replaced, not left above them.
    await expect(page.locator('.af-question')).toHaveCount(4);
    await expect(dialog).toBeHidden();
  });

  test('a failed generation explains itself and can be retried', async ({ page }) => {
    await mock(page, { fail: true });
    await page.goto('/admin/quizzes');
    await page.getByRole('button', { name: 'Generate with AI' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Paste text instead' }).click();
    await dialog.locator('#aig-text').fill('Fire exits must stay clear at all times. Report every near miss within 24 hours using the safety form.');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: /^Generate \(/ }).click();

    await expect(dialog).toContainText('The AI service is busy or its quota is used up.', { timeout: 15_000 });
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Back to settings' }).click();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(dialog.locator('#aig-text')).toHaveValue(/Fire exits/); // nothing typed is lost
    await expect(page).toHaveURL(/\/admin\/quizzes$/);
  });

  test('not configured: explained and Generate is off', async ({ page }) => {
    await mock(page, { configured: false });
    await page.goto('/admin/quizzes');
    await page.getByRole('button', { name: 'Generate with AI' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toContainText('AI generation is not set up on this server yet.');
    await dialog.getByRole('button', { name: 'Paste text instead' }).click();
    await dialog.locator('#aig-text').fill('Fire exits must stay clear at all times. Report every near miss within 24 hours using the safety form.');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('button', { name: /^Generate \(/ })).toBeDisabled();
  });

  test('the standalone AI Assessments page is gone', async ({ page }) => {
    await mock(page);
    await page.goto('/admin/quizzes');
    await expect(page.locator('nav').getByText('AI Assessments')).toHaveCount(0);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`AI dialog and generated questions fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    mkdirSync(ARTIFACTS, { recursive: true });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const shot = (name: string) => page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-${name}.png`), fullPage: true });
    const noRawKeys = async () => {
      const text = await page.locator('body').innerText();
      expect(text.match(/\b(ai_questions|quizzes|assignments|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    };

    await mock(page);
    for (const section of ['quizzes', 'assignments'] as const) {
      await page.goto(`/admin/${section}`);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const button = page.locator('.ql-ai');
      await expect(button).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(1);
      await shot(`${section}-page`);

      await button.click();
      await expect(page.locator('.aig-dialog')).toBeVisible();
      await noRawKeys();
      await shot(`${section}-dialog`);
      await page.keyboard.press('Escape');
    }

    // The generated questions in the real Add Quiz form.
    await page.goto('/admin/quizzes');
    await page.locator('.ql-ai').click();
    await page.locator('.aig-option').click();
    await page.locator('#aig-text').fill('Fire exits must stay clear at all times. Report every near miss within 24 hours using the safety form.');
    await page.locator('.aig-dialog button[type=submit]').click();
    await expect(page.locator('.aig-mix')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await noRawKeys();
    await shot('step-2');
    await page.locator('.aig-dialog button[type=submit]').click();
    await expect(page.locator('.aig-dialog .af-question')).toHaveCount(4, { timeout: 15_000 });
    expect(await overflow()).toBeLessThanOrEqual(1);
    await noRawKeys();
    await shot('review');
    await page.locator('.aig-foot .af-btn--primary').click();
    await expect(page.locator('.af-question')).toHaveCount(4);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await noRawKeys();
    await shot('quiz-form-with-ai-questions');

    expect(errors).toEqual([]);
  });
}
