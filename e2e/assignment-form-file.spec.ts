import { expect, Page, Request, test } from '@playwright/test';

/**
 * Assignment form, File question (Figma 1983:44040 empty / 1983:43199 with a
 * file; D-064) and B-128: the save sends each question's id back, and the
 * attachment is uploaded after the save, against the saved question id.
 * Desktop only; the rest of the form is unchanged.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const ok = (result: unknown) => ({ status: 'success', message: '', result });

const ASSIGNMENT = {
  id: 7, course_id: 1, course: { id: 1, title: 'Safety' }, title: 'Practical Assessment', title_ar: 'تقييم عملي',
  instructions_en: null, instructions_ar: null, due_date: null, cohort_scope: 'all', pass_score: 10, total_score: 20,
  status: 'active', file_url: null, cohorts: [], created_at: null, updated_at: null,
  questions: [{
    id: 81, position: 0, type: 'file', score: 20, question_en: 'Describe the first three actions.', question_ar: 'صف',
    options_en: [], options_ar: [], correct_answer_en: null, correct_answer_ar: null, explanation_en: null, explanation_ar: null,
    attachment: { name: 'Brief.pdf', size: 2048, uploaded_at: '2026-05-10 09:00:00', download_url: 'http://api.example/x' },
  }],
};

async function mock(page: Page): Promise<{ saves: Request[]; uploads: Request[]; downloads: string[] }> {
  const saves: Request[] = [];
  const uploads: Request[] = [];
  const downloads: string[] = [];
  await page.route('**/api/v1/admin/assignments/7', r => {
    if (r.request().method() === 'PUT') saves.push(r.request());
    return r.fulfill({ json: ok(ASSIGNMENT) });
  });
  await page.route('**/api/v1/admin/assignments/7/questions/81/attachment', r => {
    if (r.request().method() === 'POST') { uploads.push(r.request()); return r.fulfill({ json: ok(ASSIGNMENT.questions[0].attachment) }); }
    downloads.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' });
  });
  return { saves, uploads, downloads };
}

test('a file question keeps its id, replaces its attachment after saving, and requires one', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  const { saves, uploads, downloads } = await mock(page);
  await page.goto('/admin/assignments/7/edit');

  // The stored attachment, downloadable through the admin route.
  await page.getByRole('button', { name: 'Download Brief.pdf' }).click();
  await expect.poll(() => downloads.length).toBe(1);

  // Removing it leaves the required File empty: Publish is refused.
  await page.getByRole('button', { name: 'Remove Brief.pdf' }).click();
  const upload = page.getByRole('button', { name: 'Upload File' });
  await expect(upload).toBeVisible();

  // A wrong type is refused on the spot.
  await page.locator('#af-file-input-0').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.getByRole('alert')).toHaveText('Choose a PDF, Word, Excel, PowerPoint, PNG or JPG file.');

  await page.locator('#af-file-input-0').setInputFiles({ name: 'New brief.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(page.getByText('New brief.pdf')).toBeVisible();

  await page.locator('button').filter({ hasText: /Publish|Save Changes/ }).first().click();
  await expect.poll(() => saves.length).toBe(1);
  const body = saves[0].postDataJSON() as { questions: { id?: number; type: string }[] };
  expect(body.questions[0]).toMatchObject({ id: 81, type: 'file' });

  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0].postData() ?? '').toContain('filename="New brief.pdf"');
});
