import { expect, Request, test } from '@playwright/test';
import { mockCourse, ok } from './fixtures/course-detail-mocks';

/**
 * D-111: a lesson video larger than one request may be (a 3-minute, 12 MB
 * video was refused at PHP's 8 MB) goes up in 4 MB parts: start, the parts
 * at their offsets (a 409 says where to resume), then complete. The dialog
 * shows the percentage. Mocked API.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const MB = 1024 * 1024;

test('a 9 MB video is sent in 4 MB parts, resumes after a 409, and completes', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await mockCourse(page);
  await page.route('**/api/v1/courses/10/content**', r => r.fulfill({ json: ok([]) }));

  const size = 9 * MB;
  let received = 0;
  let refusedOnce = false;
  const parts: { offset: number; bytes: number }[] = [];
  let started: Request | null = null;
  let completed = 0;

  await page.route('**/api/v1/courses/10/lectures/uploads', r => {
    started = r.request();
    return r.fulfill({ status: 201, json: ok({ id: '6f1c2c1e-1d2b-4c3d-9e4f-5a6b7c8d9e0f', chunk_size: 4 * MB, received: 0 }) });
  });
  await page.route('**/api/v1/courses/10/lectures/uploads/6f1c2c1e-1d2b-4c3d-9e4f-5a6b7c8d9e0f?offset=*', async r => {
    const offset = Number(new URL(r.request().url()).searchParams.get('offset'));
    const bytes = (r.request().postDataBuffer() ?? Buffer.alloc(0)).length;
    parts.push({ offset, bytes });
    // The second part "arrives twice": the server says where it is.
    if (offset === 4 * MB && !refusedOnce) {
      refusedOnce = true;
      received = offset;
      return r.fulfill({ status: 409, json: { status: 'error', message: 'resume', result: { received } } });
    }
    received = offset + bytes;
    return r.fulfill({ json: ok({ received }) });
  });
  await page.route('**/api/v1/courses/10/lectures/uploads/6f1c2c1e-1d2b-4c3d-9e4f-5a6b7c8d9e0f/complete', r => {
    completed++;
    return r.fulfill({ json: ok({ path: 'course-lectures/abc.mp4', url: 'http://127.0.0.1:8000/storage/course-lectures/abc.mp4', name: 'lesson.mp4', size }) });
  });

  await page.goto('/admin/courses/10?tab=content');
  await page.getByRole('button', { name: 'Module', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('p-dropdown[formcontrolname="content_type"]').click();
  await page.getByRole('option', { name: 'Video', exact: true }).click();
  await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'lesson.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(size, 1) });

  await expect(dialog.locator('.module-form__file')).toContainText('lesson.mp4');
  expect(started!.postDataJSON()).toEqual({ name: 'lesson.mp4', size });
  expect(started!.url()).not.toContain('lectures/upload?');
  // 0, 4 MB (refused, resumed), 4 MB again, 8 MB: every byte once.
  expect(parts).toEqual([
    { offset: 0, bytes: 4 * MB }, { offset: 4 * MB, bytes: 4 * MB }, { offset: 4 * MB, bytes: 4 * MB }, { offset: 8 * MB, bytes: 1 * MB },
  ]);
  expect(completed).toBe(1);
  // The resume is not an error for the admin.
  await expect(page.locator('.p-toast-message-error, .nas-toast--error')).toHaveCount(0);
});
