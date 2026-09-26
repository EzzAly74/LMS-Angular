import { expect, Page, Request, test } from '@playwright/test';

/**
 * Learners list (D3, Figma 1986:74701) against the real dev API, which has
 * real learners. Behaviour is checked once, on the desktop project; the
 * layout at every width and locale is layout.spec.ts's job ('learners').
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';

function listRequest(page: Page): Promise<Request> {
  return page.waitForRequest((r) => /\/api\/v1\/admin\/users\?/.test(r.url()) && r.method() === 'GET');
}

function query(r: Request): URLSearchParams {
  return new URL(r.url()).searchParams;
}

async function open(page: Page, locale: 'en' | 'ar' = 'en'): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale] as const);
  await page.goto('/admin/learners');
  await page.waitForLoadState('networkidle');
}

test('lists real learners with the Figma columns and a pager', async ({ page }) => {
  const first = listRequest(page);
  await open(page);
  const q = query(await first);

  expect(q.get('role')).toBe('learner');
  expect(q.get('per_page')).toBe('15');

  const rows = page.locator('.ll__row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(15);
  await expect(page.locator('.ll__th')).toHaveText([
    'Learner Name', 'Learner ID', 'Courses Earned', 'Qualification (%)', 'Last Certification Date', 'Last Activity',
  ]);
  await expect(page.locator('.ll__pager-info')).toHaveText(/^\s*1–\d+ of \d+\s*$/);
});

test('the Learners chip filters by learner type and All clears it', async ({ page }) => {
  await open(page);
  const chip = page.getByRole('button', { name: 'Learners', exact: true });
  await chip.click();

  const dialog = page.locator('.nas-fp__card');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.nas-fp__label')).toHaveText('Learners');
  await expect(dialog.locator('.nas-fp__option-text')).toHaveText(['Online', 'Offline', 'Hybrid']);

  await dialog.getByText('Offline', { exact: true }).click();
  const filtered = listRequest(page);
  await dialog.getByRole('button', { name: 'Filter' }).click();
  expect(query(await filtered).getAll('learner_types[]')).toEqual(['offline']);
  await expect(page.locator('.ll__chip--on')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Learners, 1 selected' })).toBeVisible();

  const cleared = listRequest(page);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  expect(query(await cleared).getAll('learner_types[]')).toEqual([]);
  await expect(page.locator('.ll__chip--all.ll__chip--on')).toHaveCount(1);
});

test('the Instructors chip loads real instructors and sends course_instructor_ids', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Instructors', exact: true }).click();

  const options = page.locator('.nas-fp__option');
  await expect(options.first()).toBeVisible();
  await options.first().click();

  const filtered = listRequest(page);
  await page.getByRole('button', { name: 'Filter' }).click();
  const ids = query(await filtered).getAll('course_instructor_ids[]');
  expect(ids).toHaveLength(1);
  expect(Number(ids[0])).toBeGreaterThan(0);
});

test('Escape closes the picker without applying, and focus returns to the chip', async ({ page }) => {
  await open(page);
  const chip = page.getByRole('button', { name: 'Learners', exact: true });
  await chip.focus();
  await page.keyboard.press('Enter');

  const dialog = page.locator('.nas-fp__card');
  await expect(dialog).toBeVisible();
  // Tick with the keyboard: the checkboxes are native inputs.
  await dialog.locator('.nas-fp__native').first().focus();
  await page.keyboard.press('Space');
  await expect(dialog.locator('.nas-fp__native').first()).toBeChecked();

  let refetched = false;
  page.on('request', (r) => { if (/\/admin\/users\?/.test(r.url())) refetched = true; });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(500);

  expect(refetched).toBe(false);
  await expect(page.locator('.ll__chip--on.ll__chip--all')).toHaveCount(1);
  await expect(chip).toBeFocused();

  // Reopening starts from what is applied (nothing), not the abandoned tick.
  await chip.click();
  await expect(page.locator('.nas-fp__native').first()).not.toBeChecked();
});

test('Arabic: translated headings, chips and the Arabic learner types', async ({ page }) => {
  await open(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.ll__title')).toHaveText('المتعلمون');
  await expect(page.locator('.ll__th').first()).toHaveText('اسم المتعلم');

  await page.getByRole('button', { name: 'المتعلمون', exact: true }).click();
  await expect(page.locator('.nas-fp__option-text')).toHaveText(['عن بُعد', 'حضوري', 'مدمج']);
  await expect(page.locator('.nas-fp__title')).toHaveText('تصفية النتائج');
});
