import { expect, Locator, Page, Request, test } from '@playwright/test';

/**
 * Add / Edit Course modal (D6; Figma 2401:126596 / 2401:126340, 2401:125976).
 *
 * Every course API call is answered here, so a run never writes to the dev
 * database; the multipart request the modal sends is asserted field by field.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';
const ok = (result: unknown) => ({ status: 'success', message: '', result });

const COURSE_ROW = {
  id: 5, title: 'Fire Safety', course_type: 'offline', type: 'offline', status: 'active',
  category: { id: 1, name: 'Safety' }, instructor: { id: 3, name: 'Hala Nabil' },
  cohorts_count: 1, users_count: 12, updated_at: '2026-09-20',
};

const DETAIL = {
  id: 5,
  title: { en: 'Fire Safety', ar: 'السلامة من الحرائق' },
  description: { en: 'Stay safe', ar: 'ابق آمنًا' },
  course_type: 'offline',
  level: 'intermediate',
  category: { id: 1, name: 'Safety' },
  instructors: [{ id: 3, name: 'Hala Nabil' }],
  qualification_skills: [{ id: 11, name: 'Fire Safety Level 2' }],
  what_students_will_learn: { en: ['Use an extinguisher', 'Evacuate'], ar: ['استخدام الطفاية'] },
  requirements: { en: [], ar: [] },
  image: null,
  certificate_rule: 'both',
  certificate_min_attendance: 80,
  certificate_min_score: 65,
};

/** One field of a multipart body (null when absent). */
function field(body: string, name: string): string | null {
  const escaped = name.replace(/[[\]]/g, m => `\\${m}`);
  const m = body.match(new RegExp(`name="${escaped}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`));
  return m ? m[1] : null;
}

function fields(body: string, name: string): string[] {
  const escaped = name.replace(/[[\]]/g, m => `\\${m}`);
  return [...body.matchAll(new RegExp(`name="${escaped}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`, 'g'))].map(m => m[1]);
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function setup(page: Page, path = '/admin/courses'): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  await page.route('**/api/v1/courses?**', r =>
    r.fulfill({ json: { ...ok([COURSE_ROW]), meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } } }));
  await page.route('**/api/v1/courses/tab-counts', r =>
    r.fulfill({ json: ok({ all: 1, active: 1, inactive: 0, pending: 0, upcoming: 0 }) }));
  await page.route('**/api/v1/categories/active**', r => r.fulfill({ json: ok([{ id: 1, name: 'Safety' }, { id: 2, name: 'Compliance' }]) }));
  await page.route('**/api/v1/instructors/all**', r => r.fulfill({ json: ok([{ id: 3, name: 'Hala Nabil' }, { id: 4, name: 'Karim Adel' }]) }));
  await page.route('**/api/v1/qualification-skills/active**', r =>
    r.fulfill({ json: ok([{ id: 11, name: 'Fire Safety Level 2' }, { id: 12, name: 'First Aid Certificate' }]) }));
  await page.goto(path);
}

const dialog = (page: Page) => page.getByRole('dialog', { name: /Course/ });

async function pick(d: Locator, page: Page, label: string, option: string): Promise<void> {
  await d.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function fillRequired(d: Locator, page: Page): Promise<void> {
  await d.getByLabel('Course Title (English)').fill('Workplace Safety Essentials');
  await d.getByLabel('Course Title (Arabic)').fill('أساسيات السلامة في العمل');
  await pick(d, page, 'Type', 'Hybrid');
  await pick(d, page, 'Instructor', 'Karim Adel');
  await pick(d, page, 'Level', 'Beginner');
  await d.locator('input[type="file"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
}

async function capturePost(page: Page, status = 201, json: unknown = ok({ id: 9 })): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route('**/api/v1/courses', r => {
    if (r.request().method() !== 'POST') return r.fallback();
    posts.push(r.request());
    return r.fulfill({ status, json });
  });
  return posts;
}

test('Add New Course on the general rule sends the drawn fields', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);

  await page.getByRole('button', { name: 'New Course' }).click();
  const d = dialog(page);
  await expect(d.getByRole('heading', { name: 'Add New Course' })).toBeVisible();
  await expect(d.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
  await expect(d.getByRole('radio')).toHaveCount(0);
  await expect(d.getByText('PNG, JPG, JPEG, WEBP, GIF')).toBeVisible();
  await expect(d.getByText(/SVG/)).toHaveCount(0);

  await fillRequired(d, page);
  await pick(d, page, 'Category', 'Compliance');
  // A list is one input per point: Add point appends (and focuses) one, a blank one is dropped.
  const learnEn = d.getByRole('group', { name: 'What Students Will Learn (English)' });
  await expect(learnEn.getByRole('textbox')).toHaveCount(1);
  await learnEn.getByRole('textbox').first().fill('Spot hazards');
  await learnEn.getByRole('button', { name: 'Add point' }).click();
  await expect(learnEn.getByRole('textbox').nth(1)).toBeFocused();
  await learnEn.getByRole('button', { name: 'Add point' }).click();
  await learnEn.getByRole('textbox').nth(2).fill('Report incidents');
  await learnEn.getByRole('button', { name: 'Add point' }).click();
  await learnEn.getByRole('textbox').nth(3).fill('Remove me');
  await learnEn.getByRole('button', { name: 'Remove point 4' }).click();
  await expect(learnEn.getByRole('textbox')).toHaveCount(3);
  await d.getByRole('checkbox', { name: 'First Aid Certificate' }).check();
  await d.getByRole('button', { name: 'Create Course' }).click();

  await expect(d).toBeHidden();
  expect(posts).toHaveLength(1);
  const body = posts[0].postData() ?? '';
  expect(field(body, 'title[en]')).toBe('Workplace Safety Essentials');
  expect(field(body, 'title[ar]')).toBe('أساسيات السلامة في العمل');
  expect(field(body, 'course_type')).toBe('hybrid');
  expect(field(body, 'level')).toBe('beginner');
  expect(field(body, 'category_id')).toBe('2');
  expect(fields(body, 'instructors[]')).toEqual(['4']);
  expect(field(body, 'certificate_rule')).toBe('general');
  expect(field(body, 'certificate_min_attendance')).toBeNull();
  expect(field(body, 'certificate_min_score')).toBeNull();
  expect(JSON.parse(field(body, 'what_students_will_learn') ?? '{}')).toEqual({ en: ['Spot hazards', 'Report incidents'], ar: [] });
  expect(fields(body, 'qualification_skill_ids[]')).toEqual(['12']);
  expect(body).toContain('filename="cover.png"');
  // Cohort dates and the session count left the modal.
  expect(field(body, 'cohort_start')).toBeNull();
  expect(field(body, 'number_of_sessions')).toBeNull();
});

test('No reveals the three rules as radios and the thresholds each one uses', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);

  await page.getByRole('button', { name: 'New Course' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'No', exact: true }).click();

  await expect(d.getByRole('radio')).toHaveCount(3);
  await expect(d.getByRole('radio', { name: 'Attendance only', exact: true })).toBeChecked();
  await expect(d.getByLabel('Min Passing Attendance (%)')).toHaveValue('70');
  await expect(d.getByLabel('Min Passing Score (%)')).toHaveCount(0);

  await d.getByRole('radio', { name: 'Minimum score', exact: true }).check();
  await expect(d.getByLabel('Min Passing Attendance (%)')).toHaveCount(0);
  await expect(d.getByLabel('Min Passing Score (%)')).toHaveValue('70');

  await d.getByRole('radio', { name: 'Attendance & Minimum score', exact: true }).check();
  await d.getByLabel('Min Passing Attendance (%)').fill('85');
  await d.getByLabel('Min Passing Score (%)').fill('101');
  await fillRequired(d, page);
  await d.getByRole('button', { name: 'Create Course' }).click();
  await expect(d.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
  expect(posts).toHaveLength(0);

  await d.getByLabel('Min Passing Score (%)').fill('60');
  await d.getByRole('button', { name: 'Create Course' }).click();
  await expect(d).toBeHidden();
  const body = posts[0].postData() ?? '';
  expect(field(body, 'certificate_rule')).toBe('both');
  expect(field(body, 'certificate_min_attendance')).toBe('85');
  expect(field(body, 'certificate_min_score')).toBe('60');
});

test('Create with nothing filled marks the required fields and sends nothing', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);

  await page.getByRole('button', { name: 'New Course' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'Create Course' }).click();

  await expect(d.getByText('This field is required.')).toHaveCount(6);
  await expect(d.getByLabel('Course Title (English)')).toHaveAttribute('aria-invalid', 'true');
  expect(posts).toHaveLength(0);

  // An SVG never reaches the form (D-044).
  await d.locator('input[type="file"]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(d.getByText('Upload a PNG, JPG, WEBP or GIF image.')).toBeVisible();
});

test('a server validation error is shown next to its field', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page, 422, {
    status: 'error', message: 'Invalid', errors: { 'title.ar': ['The Arabic title is taken.'], image: ['The image failed to upload.'] },
  });

  await page.getByRole('button', { name: 'New Course' }).click();
  const d = dialog(page);
  await fillRequired(d, page);
  await d.getByRole('button', { name: 'Create Course' }).click();

  await expect(d.getByText('The Arabic title is taken.')).toBeVisible();
  await expect(d.getByText('The image failed to upload.')).toBeVisible();
  await expect(d).toBeVisible();
  expect(posts).toHaveLength(1);
});

test('Edit Course opens the same modal filled in and saves with PUT', async ({ page }) => {
  await setup(page);
  const puts: Request[] = [];
  await page.route('**/api/v1/courses/5', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: ok(DETAIL) });
    puts.push(r.request());
    return r.fulfill({ json: ok({ id: 5 }) });
  });

  await page.locator('tbody tr').first().locator('.cl-more').click();
  await page.getByRole('menuitem', { name: 'Edit Course' }).click();
  const d = dialog(page);
  await expect(d.getByRole('heading', { name: 'Edit Course' })).toBeVisible();
  await expect(d.getByLabel('Course Title (English)')).toHaveValue('Fire Safety');
  await expect(d.getByLabel('Course Title (Arabic)')).toHaveValue('السلامة من الحرائق');
  await expect(d.getByRole('button', { name: 'No', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(d.getByRole('radio', { name: 'Attendance & Minimum score', exact: true })).toBeChecked();
  await expect(d.getByLabel('Min Passing Attendance (%)')).toHaveValue('80');
  await expect(d.getByLabel('Min Passing Score (%)')).toHaveValue('65');
  const learnEn = d.getByRole('group', { name: 'What Students Will Learn (English)' });
  await expect(learnEn.getByRole('textbox')).toHaveCount(2);
  await expect(learnEn.getByRole('textbox').nth(0)).toHaveValue('Use an extinguisher');
  await expect(learnEn.getByRole('textbox').nth(1)).toHaveValue('Evacuate');
  await expect(d.getByRole('group', { name: 'Course Requirements (English)' }).getByRole('textbox')).toHaveCount(1);
  // The list can be edited: drop the second point, add another.
  await learnEn.getByRole('button', { name: 'Remove point 2' }).click();
  await learnEn.getByRole('button', { name: 'Add point' }).click();
  await learnEn.getByRole('textbox').nth(1).fill('Call for help');
  await expect(d.getByRole('checkbox', { name: 'Fire Safety Level 2' })).toBeChecked();

  // Back to the general rule; no new image is required on edit.
  await d.getByRole('button', { name: 'Yes', exact: true }).click();
  await d.getByRole('checkbox', { name: 'Fire Safety Level 2' }).uncheck();
  await d.getByRole('button', { name: 'Save Changes' }).click();

  await expect(d).toBeHidden();
  expect(puts).toHaveLength(1);
  const body = puts[0].postData() ?? '';
  expect(puts[0].method()).toBe('POST');
  expect(field(body, '_method')).toBe('PUT');
  expect(field(body, 'certificate_rule')).toBe('general');
  expect(field(body, 'level')).toBe('intermediate');
  expect(field(body, 'qualification_skill_ids')).toBe('');
  expect(JSON.parse(field(body, 'what_students_will_learn') ?? '{}')).toEqual({ en: ['Use an extinguisher', 'Call for help'], ar: ['استخدام الطفاية'] });
  expect(body).not.toContain('name="image"');
});

test("the dashboard's Add Course opens the modal on the course list", async ({ page }) => {
  await setup(page, '/admin/courses?new=1');
  await expect(dialog(page).getByRole('heading', { name: 'Add New Course' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/courses$/);
});
