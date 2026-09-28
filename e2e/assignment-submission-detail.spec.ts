import { expect, Page, Request, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Assignment submission review (Figma 2393:120281 not scored, 2393:121481
 * scored + Edit, 2393:121817 Update Score) against a mocked API in the real
 * AdminAssignmentSubmissionDetailResource shape. Layout at every width and
 * language; behaviour on desktop.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/assignment-submission');
const ok = (result: unknown) => ({ status: 'success', message: '', result });

const file = (name: string) => ({ name, size: 313 * 1024, uploaded_at: '2026-05-10 09:00:00', download_url: 'http://api.example/x' });

function detail(score: number | null) {
  return {
    id: 55,
    assignment: { id: 7, title: 'Practical Assessment', title_ar: 'تقييم عملي', status: 'active', cohort_scope: 'all', pass_score: 10, total_score: 20 },
    course_title: 'Workplace Safety Essentials',
    course_type: 'hybrid',
    category_name: 'Safety',
    instructor_name: 'Nora',
    user: { id: 9, name: 'Layla Hassan', machine_code: 'LH-1', department_name: null },
    user_file_url: null,
    total_score: score ?? 0,
    max_score: 20,
    score_percent: score === null ? null : Math.round((score * 100) / 20),
    pending_answers: score === null ? 1 : 0,
    feedback: null,
    status: score === null ? 'pending' : 'graded',
    submitted_at: '2026-05-10 09:00:00',
    reviewed_at: null,
    updated_at: '2026-05-10 09:00:00',
    created_at: '2026-05-10 09:00:00',
    answers: [{
      id: 301,
      awarded_score: score,
      is_correct: null,
      answer: null,
      feedback: null,
      file: file('File Title.xls'),
      question: {
        id: 81, position: 0, type: 'file', score: 20,
        question_en: 'Describe the first three actions you would take after identifying a spill hazard.',
        question_ar: 'صف أول ثلاثة إجراءات تتخذها بعد اكتشاف خطر انسكاب.',
        options_en: [], options_ar: [], correct_answer_en: null, correct_answer_ar: null,
        explanation_en: null, explanation_ar: null,
        attachment: file('Brief.pdf'),
      },
    }],
  };
}

async function mock(page: Page, start: number | null): Promise<{ grades: Request[]; downloads: string[] }> {
  const grades: Request[] = [];
  const downloads: string[] = [];
  let current = detail(start);
  await page.route('**/api/v1/admin/assignments/submissions/55', r => r.fulfill({ json: ok(current) }));
  await page.route('**/api/v1/admin/assignments/submissions/55/answers/301/grade', r => {
    grades.push(r.request());
    current = detail(Number((r.request().postDataJSON() as { awarded_score: number }).awarded_score));
    return r.fulfill({ json: ok({ answer: { id: 301 }, submission: current }) });
  });
  for (const path of ['**/api/v1/admin/assignments/submissions/55/answers/301/file', '**/api/v1/admin/assignments/7/questions/81/attachment']) {
    await page.route(path, r => { downloads.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }); });
  }
  return { grades, downloads };
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('score, then Edit and Update; files download through the admin API', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    const { grades, downloads } = await mock(page, null);
    await page.goto('/admin/assignments/submissions/55');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practical Assessment');
    await expect(page.locator('.asd-stat__value').nth(0)).toHaveText('--%');
    await expect(page.locator('.asd-stat__value').nth(1)).toHaveText('-- / 20');
    await expect(page.locator('.asd-q__pts')).toContainText('-- / 20');
    await expect(page.getByText('Learner answer')).toBeVisible();
    await expect(page.getByText('Assignment file')).toBeVisible();

    // Both files download from the admin routes, not from download_url.
    await page.getByRole('button', { name: 'Download File Title.xls' }).click();
    await page.getByRole('button', { name: 'Download Brief.pdf' }).click();
    await expect.poll(() => downloads.length).toBe(2);
    expect(downloads.every(u => !u.includes('api.example'))).toBe(true);

    // Not scored: the Score form (2393:120281).
    const score = page.getByLabel('Score', { exact: true });
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();
    await score.fill('25');
    await expect(page.getByRole('alert')).toHaveText('Enter a whole number from 0 to 20.');
    await expect(save).toBeDisabled();
    await score.fill('10');
    await save.click();
    await expect.poll(() => grades.length).toBe(1);
    expect(grades[0].postDataJSON()).toMatchObject({ awarded_score: 10 });

    // Scored: Edit (2393:121481).
    await expect(page.locator('.asd-stat__value').nth(0)).toHaveText('50%');
    await expect(page.locator('.asd-q__pts')).toContainText('10 / 20');
    await page.getByRole('button', { name: 'Edit' }).click();

    // Editing: Update Score (2393:121817).
    const update = page.getByLabel('Update Score');
    await expect(update).toHaveValue('10');
    await update.fill('15');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect.poll(() => grades.length).toBe(2);
    await expect(page.locator('.asd-q__pts')).toContainText('15 / 20');

    // Cancel leaves the saved score alone.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Update Score').fill('3');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(grades).toHaveLength(2);
  });

  test('a failed load offers a retry', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
    let fail = true;
    await page.route('**/api/v1/admin/assignments/submissions/55', r =>
      fail ? r.fulfill({ status: 500, json: { status: 'error', message: 'x' } }) : r.fulfill({ json: ok(detail(null)) }));
    await page.goto('/admin/assignments/submissions/55');
    await expect(page.locator('.asd-message')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practical Assessment');
  });
});

for (const locale of ['en', 'ar'] as const) {
  for (const state of ['pending', 'graded'] as const) {
    test(`review page fits and reads ${locale} ${state}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
      await mock(page, state === 'pending' ? null : 10);
      await page.goto('/admin/assignments/submissions/55');
      await expect(page.locator('.asd-q__card')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'ar' ? 'تقييم عملي' : 'Practical Assessment');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const text = await page.locator('body').innerText();
      expect(text.match(/\b(assignments|common|quiz_types)\.[a-z_.]+/g) ?? []).toEqual([]);

      mkdirSync(ARTIFACTS, { recursive: true });
      await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}-${state}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}
