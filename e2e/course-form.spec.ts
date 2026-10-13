import { expect, Page, Request, test } from '@playwright/test';
import { mockCourse } from './fixtures/course-detail-mocks';

/**
 * Add / Edit Course page (D6 fields, Figma 2401:126596 / 2401:126340,
 * 2401:125976; a page since 2026-10-13) and the D-095 locks.
 *
 * Every course API call is answered here, so a run never writes to the dev
 * database; the multipart request the page sends is asserted field by field.
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
  locked_fields: [] as string[],
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

/** Lookups, the list, and the course itself (GET) answered; PUTs captured. */
async function setup(page: Page, detail: Partial<typeof DETAIL> = {}): Promise<Request[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  await page.route('**/api/v1/courses?**', r =>
    r.fulfill({ json: { ...ok([COURSE_ROW]), meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } } }));
  await page.route('**/api/v1/courses/tab-counts', r =>
    r.fulfill({ json: ok({ all: 1, active: 1, inactive: 0, pending: 0, upcoming: 0 }) }));
  await page.route('**/api/v1/categories/active**', r => r.fulfill({ json: ok([{ id: 1, name: 'Safety' }, { id: 2, name: 'Compliance' }]) }));
  await page.route('**/api/v1/instructors/all**', r => r.fulfill({ json: ok([{ id: 3, name: 'Hala Nabil' }, { id: 4, name: 'Karim Adel' }]) }));
  await page.route('**/api/v1/qualification-skills/active**', r =>
    r.fulfill({ json: ok([{ id: 11, name: 'Fire Safety Level 2' }, { id: 12, name: 'First Aid Certificate' }]) }));
  const puts: Request[] = [];
  await page.route('**/api/v1/courses/5', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: ok({ ...DETAIL, ...detail }) });
    puts.push(r.request());
    return r.fulfill({ json: ok({ id: 5 }) });
  });
  return puts;
}

async function pick(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function fillRequired(page: Page): Promise<void> {
  await page.getByLabel('Course Title (English)').fill('Workplace Safety Essentials');
  await page.getByLabel('Course Title (Arabic)').fill('أساسيات السلامة في العمل');
  await pick(page, 'Type', 'Hybrid');
  await pick(page, 'Instructor', 'Karim Adel');
  await pick(page, 'Level', 'Beginner');
  await page.locator('input[type="file"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
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

test('New Course opens the page, not a modal', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/courses');
  await page.getByRole('button', { name: 'New Course' }).click();

  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Add New Course' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Add New Course on the general rule sends the drawn fields and opens the new course', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);
  await page.route('**/api/v1/courses/9', r => r.fulfill({ json: ok({ ...DETAIL, id: 9 }) }));
  await page.goto('/admin/courses/new');

  await expect(page.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByText('PNG, JPG, JPEG, WEBP, GIF')).toBeVisible();
  await expect(page.getByText(/SVG/)).toHaveCount(0);

  await fillRequired(page);
  await pick(page, 'Category', 'Compliance');
  // A list is one input per point: Add point appends (and focuses) one, a blank one is dropped.
  const learnEn = page.getByRole('group', { name: 'What Students Will Learn (English)' });
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
  await page.getByRole('checkbox', { name: 'First Aid Certificate' }).check();
  await page.getByRole('button', { name: 'Create Course' }).click();

  await expect(page).toHaveURL(/\/admin\/courses\/9$/);
  expect(posts).toHaveLength(1);
  const body = posts[0].postData() ?? '';
  expect(field(body, 'title[en]')).toBe('Workplace Safety Essentials');
  expect(field(body, 'title[ar]')).toBe('أساسيات السلامة في العمل');
  expect(field(body, 'course_type')).toBe('hybrid');
  expect(field(body, 'level')).toBe('beginner');
  expect(field(body, 'category_id')).toBe('2');
  expect(fields(body, 'instructors[]')).toEqual(['4']);
  expect(field(body, 'certificate')).toBe('1');
  expect(field(body, 'certificate_rule')).toBe('general');
  expect(field(body, 'certificate_min_attendance')).toBeNull();
  expect(field(body, 'certificate_min_score')).toBeNull();
  expect(JSON.parse(field(body, 'what_students_will_learn') ?? '{}')).toEqual({ en: ['Spot hazards', 'Report incidents'], ar: [] });
  expect(fields(body, 'qualification_skill_ids[]')).toEqual(['12']);
  expect(body).toContain('filename="cover.png"');
});

test('No reveals the three rules as radios and the thresholds each one uses', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);
  await page.route('**/api/v1/courses/9', r => r.fulfill({ json: ok({ ...DETAIL, id: 9 }) }));
  await page.goto('/admin/courses/new');
  await page.getByRole('button', { name: 'No', exact: true }).click();

  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: 'Attendance only', exact: true })).toBeChecked();
  await expect(page.getByLabel('Min Passing Attendance (%)')).toHaveValue('70');
  await expect(page.getByLabel('Min Passing Score (%)')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Minimum score', exact: true }).check();
  await expect(page.getByLabel('Min Passing Attendance (%)')).toHaveCount(0);
  await expect(page.getByLabel('Min Passing Score (%)')).toHaveValue('70');

  await page.getByRole('radio', { name: 'Attendance & Minimum score', exact: true }).check();
  await page.getByLabel('Min Passing Attendance (%)').fill('85');
  await page.getByLabel('Min Passing Score (%)').fill('101');
  await fillRequired(page);
  await page.getByRole('button', { name: 'Create Course' }).click();
  await expect(page.getByText('Enter a whole number from 1 to 100.')).toBeVisible();
  expect(posts).toHaveLength(0);

  await page.getByLabel('Min Passing Score (%)').fill('60');
  await page.getByRole('button', { name: 'Create Course' }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/9$/);
  const body = posts[0].postData() ?? '';
  expect(field(body, 'certificate_rule')).toBe('both');
  expect(field(body, 'certificate_min_attendance')).toBe('85');
  expect(field(body, 'certificate_min_score')).toBe('60');
});

test('Create with nothing filled marks the required fields and sends nothing', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page);
  await page.goto('/admin/courses/new');
  await page.getByRole('button', { name: 'Create Course' }).click();

  await expect(page.getByText('This field is required.')).toHaveCount(6);
  await expect(page.getByLabel('Course Title (English)')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.cf__alert')).toContainText('Fix the highlighted fields');
  expect(posts).toHaveLength(0);

  // An SVG never reaches the form (D-044).
  await page.locator('input[type="file"]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByText('Upload a PNG, JPG, WEBP or GIF image.')).toBeVisible();
});

test('a server validation error is shown next to its field and the page stays', async ({ page }) => {
  await setup(page);
  const posts = await capturePost(page, 422, {
    status: 'error', message: 'Invalid', errors: { 'title.ar': ['The Arabic title is taken.'], image: ['The image failed to upload.'] },
  });
  await page.goto('/admin/courses/new');
  await fillRequired(page);
  await page.getByRole('button', { name: 'Create Course' }).click();

  await expect(page.locator('.cf__error', { hasText: 'The Arabic title is taken.' })).toBeVisible();
  await expect(page.locator('.cf__error', { hasText: 'The image failed to upload.' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  expect(posts).toHaveLength(1);
});

test('Edit Course from the list opens the page filled in and saves with PUT', async ({ page }) => {
  const puts = await setup(page);
  await page.goto('/admin/courses');
  await page.locator('tbody tr').first().locator('.cl-more').click();
  await page.getByRole('menuitem', { name: 'Edit Course' }).click();

  await expect(page).toHaveURL(/\/admin\/courses\/5\/edit$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Course' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Fire Safety' })).toBeVisible();
  await expect(page.getByLabel('Course Title (English)')).toHaveValue('Fire Safety');
  await expect(page.getByLabel('Course Title (Arabic)')).toHaveValue('السلامة من الحرائق');
  await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('radio', { name: 'Attendance & Minimum score', exact: true })).toBeChecked();
  await expect(page.getByLabel('Min Passing Attendance (%)')).toHaveValue('80');
  await expect(page.getByLabel('Min Passing Score (%)')).toHaveValue('65');
  const learnEn = page.getByRole('group', { name: 'What Students Will Learn (English)' });
  await expect(learnEn.getByRole('textbox')).toHaveCount(2);
  await expect(learnEn.getByRole('textbox').nth(0)).toHaveValue('Use an extinguisher');
  await learnEn.getByRole('button', { name: 'Remove point 2' }).click();
  await learnEn.getByRole('button', { name: 'Add point' }).click();
  await learnEn.getByRole('textbox').nth(1).fill('Call for help');
  await expect(page.getByRole('checkbox', { name: 'Fire Safety Level 2' })).toBeChecked();
  // No locks while nobody is enrolled.
  await expect(page.getByRole('note')).toHaveCount(0);

  // Back to the general rule; no new image is required on edit.
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Fire Safety Level 2' }).uncheck();
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page).toHaveURL(/\/admin\/courses\/5$/);
  expect(puts).toHaveLength(1);
  const body = puts[0].postData() ?? '';
  expect(puts[0].method()).toBe('POST');
  expect(field(body, '_method')).toBe('PUT');
  expect(field(body, 'course_type')).toBe('offline');
  expect(field(body, 'certificate_rule')).toBe('general');
  expect(field(body, 'level')).toBe('intermediate');
  expect(field(body, 'qualification_skill_ids')).toBe('');
  expect(JSON.parse(field(body, 'what_students_will_learn') ?? '{}')).toEqual({ en: ['Use an extinguisher', 'Call for help'], ar: ['استخدام الطفاية'] });
  expect(body).not.toContain('name="image"');
});

test('D-095: with learners enrolled, type, certificate rule and qualifications are read-only and not sent', async ({ page }) => {
  const puts = await setup(page, { locked_fields: ['course_type', 'certificate_rule', 'qualification_skill_ids'] });
  await page.goto('/admin/courses/5/edit');

  await expect(page.getByRole('note')).toContainText('Learners are enrolled in this course');
  await expect(page.getByRole('combobox', { name: 'Type' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'No', exact: true })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Attendance & Minimum score', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Min Passing Attendance (%)')).toBeDisabled();
  await expect(page.getByLabel('Min Passing Attendance (%)')).toHaveValue('80');
  await expect(page.getByRole('checkbox', { name: 'Fire Safety Level 2' })).toBeDisabled();
  await expect(page.getByText("Can't be changed: learners are enrolled.")).toHaveCount(3);

  // Everything else stays editable.
  await page.getByLabel('Course Title (English)').fill('Fire Safety 2026');
  await pick(page, 'Level', 'Professional');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page).toHaveURL(/\/admin\/courses\/5$/);
  const body = puts[0].postData() ?? '';
  expect(field(body, 'title[en]')).toBe('Fire Safety 2026');
  expect(field(body, 'level')).toBe('professional');
  for (const locked of ['course_type', 'certificate_rule', 'certificate_min_attendance', 'certificate_min_score', 'qualification_skill_ids']) {
    expect(field(body, locked), locked).toBeNull();
  }
  expect(fields(body, 'qualification_skill_ids[]')).toEqual([]);
});

test('a lock refused by the server is shown on its field', async ({ page }) => {
  // Another admin enrolled a learner while the form was open.
  await setup(page);
  await page.route('**/api/v1/courses/5', r => r.request().method() === 'GET'
    ? r.fulfill({ json: ok(DETAIL) })
    : r.fulfill({ status: 422, json: { status: 'error', message: 'Invalid', errors: { course_type: ["This can't be changed after learners have enrolled in the course."] } } }));
  await page.goto('/admin/courses/5/edit');
  await pick(page, 'Type', 'Online');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.locator('.cf__error', { hasText: "This can't be changed after learners have enrolled in the course." })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/courses\/5\/edit$/);
});

test('NEW2B-5792: Save Changes on an incomplete course says why instead of doing nothing', async ({ page }) => {
  // An older course with no instructor: the required field is empty on open.
  const puts = await setup(page, { instructors: [] });
  await page.goto('/admin/courses/5/edit');
  await expect(page.getByLabel('Course Title (English)')).toHaveValue('Fire Safety');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.locator('.cf__alert')).toContainText('Fix the highlighted fields');
  await expect(page.getByText('This field is required.').first()).toBeInViewport();
  expect(puts).toHaveLength(0);
});

test('Cancel goes back to the course on edit and to the list on add', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/courses/5/edit');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/5$/);

  await page.goto('/admin/courses/new');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
});

test("the course page's Edit links to the form page", async ({ page }) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  await mockCourse(page, {});
  await page.goto('/admin/courses/10');
  await page.locator('a.cd-head__edit').click();
  await expect(page).toHaveURL(/\/admin\/courses\/10\/edit$/);
});

test('each language field hints in its own language (NEW2B-5869)', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/courses/new');
  await expect(page.getByLabel('Course Title (English)')).toHaveAttribute('placeholder', 'e.g. Workplace Safety Essentials');
  await expect(page.getByLabel('Course Title (Arabic)')).toHaveAttribute('placeholder', 'مثال: أساسيات السلامة في مكان العمل');
  await expect(page.locator('textarea[dir="rtl"]')).toHaveAttribute('placeholder', 'نظرة عامة موجزة على أهداف الدورة…');
  await expect(page.getByRole('group', { name: 'What Students Will Learn (Arabic)' }).getByRole('textbox').first())
    .toHaveAttribute('placeholder', 'اكتب نقطة');
});
