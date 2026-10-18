import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * AI Assessment builder (backend D-113): the library, the wizard steps, the
 * review editor (all seven question types), reorder / approve / edit, live
 * generation and export, on a mocked API in the real response shapes, at
 * every width and in both languages. No Figma frame exists for the module.
 */

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/ai-assessments');
const API = /\/api\/v1\/admin\/ai-assessments/;

const q = (id: number, position: number, type: string, extra: Record<string, unknown>) => ({
  id, position, type, context: null, prompt: '', options: null, answer: null, explanation: 'From the handbook.',
  source_ref: 'Handbook.docx, Page 2', bloom: 'remember', difficulty: 'easy', status: 'pending', ...extra,
});

const QUESTIONS = [
  q(11, 1, 'mcq', { prompt: 'What must stay clear at all times?', options: ['Fire exits', 'Desks', 'Parking', 'Windows'], answer: { indexes: [0] }, status: 'approved' }),
  q(12, 2, 'multi', { prompt: 'Which items are personal protective equipment?', options: ['Helmet', 'Gloves', 'Sandals', 'Goggles'], answer: { indexes: [0, 1, 3] } }),
  q(13, 3, 'true_false', { prompt: 'Near misses must be reported within 24 hours.', answer: { value: true }, status: 'flagged' }),
  q(14, 4, 'short', { prompt: 'Why do we report near misses?', answer: { text: 'To prevent the next accident.' } }),
  q(15, 5, 'fill_blank', { prompt: 'Exits must stay _____ at all times.', answer: { answers: ['clear'] } }),
  q(16, 6, 'matching', { prompt: 'Match each sign to its meaning.', options: [{ left: 'Red', right: 'Stop' }, { left: 'Green', right: 'Safe' }, { left: 'Yellow', right: 'Caution' }] }),
  q(17, 7, 'scenario', { context: 'A colleague stores boxes in front of an emergency exit.', prompt: 'What do you do first?', options: ['Ignore it', 'Ask them to move the boxes', 'Call the fire brigade'], answer: { indexes: [1] } }),
];

const SOURCES = [
  { id: 1, kind: 'docx', name: 'Handbook.docx', size: 482_000, units: 12, chars: 18_420, created_at: '2026-10-18T09:00:00Z' },
  { id: 2, kind: 'pdf', name: 'Fire safety policy.pdf', size: 2_300_000, units: null, chars: 0, created_at: '2026-10-18T09:01:00Z' },
];

function assessment(extra: Record<string, unknown> = {}) {
  return {
    id: 7, title: 'Workplace safety — induction', type: 'post', content_language: 'en', difficulty: 'mixed', audience: 'New hires',
    objectives: null, bloom_levels: ['remember', 'apply'], question_counts: { mcq: 2, true_false: 1 }, version: 1, status: 'ready',
    last_error: null, last_error_message: null, generation_started_at: null, course: { id: 3, title: 'Health & Safety' },
    sources: SOURCES, questions: QUESTIONS, updated_at: '2026-10-18T10:00:00Z', ...extra,
  };
}

const ROWS = [
  { id: 7, title: 'Workplace safety — induction', type: 'post', content_language: 'en', difficulty: 'mixed', status: 'ready', version: 2, questions_count: 7, approved_count: 1, course: { id: 3, title: 'Health & Safety' }, author: null, updated_at: '2026-10-18T10:00:00Z', created_at: '2026-10-17T10:00:00Z' },
  { id: 8, title: 'أساسيات خدمة العملاء', type: 'pre', content_language: 'ar', difficulty: 'easy', status: 'draft', version: 1, questions_count: 0, approved_count: 0, course: null, author: null, updated_at: '2026-10-16T10:00:00Z', created_at: '2026-10-16T10:00:00Z' },
  { id: 9, title: 'A very long assessment title that keeps going to check the column truncates instead of pushing the table wider than the screen', type: 'quiz', content_language: 'en', difficulty: 'hard', status: 'generating', version: 1, questions_count: 3, approved_count: 0, course: null, author: null, updated_at: '2026-10-15T10:00:00Z', created_at: '2026-10-15T10:00:00Z' },
];

interface Calls { library: Request[]; reorder: Request[]; status: Request[]; edits: Request[]; exports: Request[]; generate: Request[]; creates: Request[] }

const ok = (result: unknown, extra: Record<string, unknown> = {}) => ({ json: { status: 'success', message: '', result, ...extra } });

async function mockApi(page: Page, opts: { rows?: unknown[]; configured?: boolean; detail?: Record<string, unknown>; afterGenerate?: Record<string, unknown> } = {}): Promise<Calls> {
  const calls: Calls = { library: [], reorder: [], status: [], edits: [], exports: [], generate: [], creates: [] };
  const usage = { used: 3, limit: 30, configured: opts.configured ?? true };
  let detail = assessment(opts.detail);

  // The harness account's real profile, plus this module's permissions (D-113 grants
  // them to super admins only; the harness role is not one). The server still enforces them.
  await page.route('**/api/v1/auth/admin/me', async route => {
    const response = await route.fetch();
    const body = await response.json();
    const extra = ['view', 'create', 'edit', 'delete'].map(a => `${a}-ai-assessments`);
    body.result = {
      ...body.result,
      view_keys: [...new Set([...(body.result?.view_keys ?? []), 'view-ai-assessments'])],
      permissions: [...new Set([...(body.result?.permissions ?? []), ...extra])],
    };
    await route.fulfill({ response, json: body });
  });

  await page.route(API, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/admin\/ai-assessments/, '');
    const method = req.method();

    if (path === '' && method === 'GET') {
      calls.library.push(req);
      const rows = opts.rows ?? ROWS;
      return route.fulfill(ok(rows, { meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length, usage } }));
    }
    if (path === '' && method === 'POST') {
      calls.creates.push(req);
      detail = assessment({ ...req.postDataJSON(), id: 7, sources: [], questions: [], status: 'draft', course: null });
      return route.fulfill({ status: 201, ...ok(detail) });
    }
    if (path === '/usage') return route.fulfill(ok(usage));
    if (path === '/courses') return route.fulfill(ok([{ id: 3, title: 'Health & Safety' }, { id: 4, title: 'Customer Service' }]));
    if (path === '/7' && method === 'GET') {
      const current = detail;
      if (current.status === 'generating' && opts.afterGenerate) detail = assessment(opts.afterGenerate);
      return route.fulfill(ok(current));
    }
    if (path === '/7' && method === 'PUT') { detail = { ...detail, ...req.postDataJSON() }; return route.fulfill(ok(detail)); }
    if (path === '/7/generate') {
      calls.generate.push(req);
      detail = assessment({ status: 'generating', questions: QUESTIONS.slice(0, 2), current_run_id: 5 });
      return route.fulfill({ status: 202, ...ok({ assessment: detail, usage: { ...usage, used: 4 } }) });
    }
    if (path === '/7/questions/order') { calls.reorder.push(req); return route.fulfill(ok(null)); }
    const status = /^\/7\/questions\/(\d+)\/status$/.exec(path);
    if (status) {
      calls.status.push(req);
      const base = QUESTIONS.find(x => x.id === Number(status[1]))!;
      return route.fulfill(ok({ ...base, status: req.postDataJSON().status }));
    }
    const edit = /^\/7\/questions\/(\d+)$/.exec(path);
    if (edit && method === 'PUT') {
      calls.edits.push(req);
      const base = QUESTIONS.find(x => x.id === Number(edit[1]))!;
      return route.fulfill(ok({ ...base, ...req.postDataJSON() }));
    }
    if (path === '/7/export') {
      calls.exports.push(req);
      return route.fulfill({
        status: 200, contentType: 'application/octet-stream', body: 'x',
        headers: {
          'Content-Disposition': "attachment; filename=\"Workplace safety - Post-Assessment - EN - Trainer version.pdf\"; filename*=utf-8''Workplace%20safety%20-%20Post-Assessment%20-%20EN%20-%20Trainer%20version.pdf",
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
      });
    }
    return route.fulfill({ status: 404, json: { status: 'error', message: 'unmocked ' + method + ' ' + path } });
  });

  return calls;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  });

  test('library: rows, usage, filters and the sidebar entry', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/ai-assessments');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI Assessments');
    await expect(page.locator('.aal-usage')).toHaveText(/AI runs today: 3 \/ 30/);
    await expect(page.locator('.aal-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.aal-table tbody tr').first()).toContainText('Version 2');
    await expect(page.locator('.aal-table tbody tr').first()).toContainText('1/7');
    await expect(page.getByRole('link', { name: 'AI Assessments' }).first()).toBeVisible();

    await page.getByRole('searchbox').fill('safety');
    await expect.poll(() => new URL(calls.library.at(-1)!.url()).searchParams.get('search')).toBe('safety');

    await page.getByRole('row', { name: /أساسيات خدمة العملاء/ }).click();
    await expect(page).toHaveURL(/\/admin\/ai-assessments\/8$/);
  });

  test('library: not configured shows a notice; no rows shows the empty state', async ({ page }) => {
    await mockApi(page, { rows: [], configured: false });
    await page.goto('/admin/ai-assessments');
    await expect(page.locator('.aal-notice')).toContainText('AI generation is not set up');
    await expect(page.locator('nas-list-state')).toContainText('No assessments yet');
  });

  test('new: details are validated, then the assessment is created and Sources opens', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/ai-assessments/new');

    await page.getByRole('button', { name: 'Create and continue' }).click();
    await expect(page.locator('#aae-title-err')).toHaveText('Enter a title of 2 to 200 characters.');
    await expect(page.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.creates).toHaveLength(0);

    await page.getByLabel('Title').fill('Fire drill quiz');
    await page.getByRole('radio', { name: /Quiz/ }).check();
    await page.getByRole('radio', { name: 'Arabic' }).check();
    await page.getByRole('button', { name: 'Create and continue' }).click();

    await expect(page).toHaveURL(/\/admin\/ai-assessments\/7\?step=sources$/);
    expect(calls.creates[0].postDataJSON()).toMatchObject({ title: 'Fire drill quiz', type: 'quiz', content_language: 'ar' });
    await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
  });

  test('sources and configure: files listed, counts capped and saved', async ({ page }) => {
    await mockApi(page);
    await page.goto('/admin/ai-assessments/7?step=sources');

    await expect(page.locator('.aae-source')).toHaveCount(2);
    await expect(page.locator('.aae-source').first()).toContainText('12 pages');
    await expect(page.locator('.aae-source').nth(1)).toContainText('read by the AI as a document');

    // A file the server would refuse is refused before upload.
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('.aae-upload--error')).toContainText('Only PDF, DOCX and PPTX files can be added.');

    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.locator('#aae-count-mcq')).toHaveValue('2');
    await page.getByRole('button', { name: 'More Multiple response questions' }).click();
    await expect(page.locator('.aae-total')).toHaveText(/Total: 4 of 60 questions/);
    await page.locator('#aae-count-short').fill('60');
    await expect(page.locator('.aae-total')).toHaveClass(/aae-total--over/);
    await expect(page.getByRole('button', { name: 'Save and continue' })).toBeDisabled();
  });

  test('review: every type renders; approve, reorder by keyboard, edit and export', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/ai-assessments/7');

    await expect(page.locator('.aae-q')).toHaveCount(7);
    await expect(page.locator('.aae-q__type')).toHaveText(['Multiple choice', 'Multiple response', 'True / False', 'Short answer', 'Fill in the blank', 'Matching', 'Scenario-based']);
    await expect(page.locator('.aae-q').first().locator('.aae-q__option--correct')).toHaveText(/Fire exits/);
    await expect(page.locator('.aae-q').nth(1).locator('.aae-q__option--correct')).toHaveCount(3);
    await expect(page.locator('.aae-q').nth(6).locator('.aae-q__context')).toContainText('emergency exit');
    await expect(page.locator('.aae-review-counts')).toHaveText('1 approved · 1 flagged · 7 questions');

    // Approve toggles through the status endpoint.
    await page.locator('.aae-q').nth(1).getByRole('button', { name: 'Approve' }).click();
    await expect.poll(() => calls.status.at(-1)?.postDataJSON()).toEqual({ status: 'approved' });
    await expect(page.locator('.aae-q').nth(1).getByRole('button', { name: 'Approve' })).toHaveAttribute('aria-pressed', 'true');

    // Keyboard alternative to drag-and-drop: one request with the full order.
    await page.getByRole('button', { name: 'Move question 1 down' }).click();
    await expect.poll(() => calls.reorder.at(-1)?.postDataJSON()).toEqual({ ids: [12, 11, 13, 14, 15, 16, 17] });
    await expect(page.locator('.aae-q__type').first()).toHaveText('Multiple response');

    // Edit the MCQ (now second): change the key to "Desks".
    const mcq = page.locator('.aae-q').nth(1);
    await mcq.getByRole('button', { name: 'Edit' }).click();
    await mcq.getByRole('radio', { name: 'Option B is correct' }).check();
    await mcq.getByRole('button', { name: 'Save question' }).click();
    await expect.poll(() => calls.edits.at(-1)?.postDataJSON()).toMatchObject({ answer: { indexes: [1] }, options: ['Fire exits', 'Desks', 'Parking', 'Windows'] });

    // An invalid edit is stopped before it is sent.
    const blank = page.locator('.aae-q').nth(4);
    await blank.getByRole('button', { name: 'Edit' }).click();
    await blank.locator('textarea[id$="-prompt"]').fill('No blank here any more.');
    await blank.getByRole('button', { name: 'Save question' }).click();
    await expect(blank.getByRole('alert')).toHaveText('Add at least one blank (_____) to the question.');
    expect(calls.edits).toHaveLength(1);
    await blank.getByRole('button', { name: 'Cancel' }).click();

    // Export: format + variant, the file name from the server.
    await page.getByRole('button', { name: 'Export' }).click();
    await page.locator('.aae-choice--tile', { hasText: 'PDF' }).click();
    await page.getByRole('radio', { name: /Learner version/ }).check();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('Workplace safety - Post-Assessment - EN - Trainer version.pdf');
    const params = new URL(calls.exports.at(-1)!.url()).searchParams;
    expect([params.get('format'), params.get('variant')]).toEqual(['pdf', 'learner']);
  });

  test('generate: questions appear while generating, then the set is ready', async ({ page }) => {
    const calls = await mockApi(page, { detail: { questions: [], status: 'draft' }, afterGenerate: { status: 'ready' } });
    await page.goto('/admin/ai-assessments/7?step=review');

    await expect(page.locator('nas-list-state')).toContainText('No questions yet');
    await page.getByRole('button', { name: 'Generate questions' }).click();
    expect(calls.generate).toHaveLength(1);
    await expect(page.locator('.aae-progress')).toContainText('Writing questions… 2 so far.');
    await expect(page.locator('.aae-q')).toHaveCount(2);
    // The next poll returns the finished set.
    await expect(page.locator('.aae-q')).toHaveCount(7, { timeout: 10_000 });
    await expect(page.locator('.aae-progress')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Regenerate all' })).toBeEnabled();
  });

  test('a failed run explains itself', async ({ page }) => {
    await mockApi(page, { detail: { last_error: 'provider_busy', last_error_message: 'The AI service is busy right now. Try again in a minute.' } });
    await page.goto('/admin/ai-assessments/7?step=review');
    await expect(page.locator('.aae-notice--error')).toHaveText('The AI service is busy right now. Try again in a minute.');
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`library and wizard fit and read ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
    mkdirSync(ARTIFACTS, { recursive: true });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const shot = (name: string) => page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-${name}.png`), fullPage: true });
    const noRawKeys = async () => {
      const text = await page.locator('body').innerText();
      expect(text.match(/\b(ai_assessments|common)\.[a-z_.]+/g) ?? []).toEqual([]);
    };

    await mockApi(page);
    await page.goto('/admin/ai-assessments');
    await expect(page.locator('.aal-table tbody tr')).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await overflow()).toBeLessThanOrEqual(1);
    await noRawKeys();
    await shot('library');

    await page.goto('/admin/ai-assessments/new');
    await expect(page.locator('#aae-title')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await noRawKeys();
    await shot('details');

    for (const step of ['sources', 'configure', 'review'] as const) {
      await page.goto(`/admin/ai-assessments/7?step=${step}`);
      await expect(page.locator('.aae-step--current')).toBeVisible();
      if (step === 'review') await expect(page.locator('.aae-q')).toHaveCount(7);
      expect(await overflow()).toBeLessThanOrEqual(1);
      await noRawKeys();
      await shot(step);
    }

    // The question editor and the export dialog at this width.
    await page.locator('.aae-q').nth(5).getByRole('button', { name: locale === 'ar' ? 'تعديل' : 'Edit' }).click();
    await expect(page.locator('app-ai-question-editor')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await shot('edit-matching');

    await page.locator('.af-head').getByRole('button').first().click();
    await expect(page.locator('.aae-export')).toBeVisible();
    await noRawKeys();
    await shot('export');

    expect(errors).toEqual([]);
  });
}
