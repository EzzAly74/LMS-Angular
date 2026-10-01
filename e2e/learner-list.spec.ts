import { expect, Page, Request, test } from '@playwright/test';

/**
 * Learners list (D3, Figma 1986:74701) against the real dev API, which has
 * real learners. Filtering is the Dashboard's one Filter modal (D-070): the
 * frame's chips and From / To pickers are its fields. Behaviour is checked
 * once, on the desktop project; the layout at every width and locale is
 * layout.spec.ts's job ('learners').
 */
/**
 * Close an open multi-select list and nothing else (the Filter modal stays).
 * PrimeNG ignores a close that lands while the list is still animating open,
 * which a test (unlike a person) can do; wait for it to settle first.
 */
async function closeList(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.fd-ms-panel');
    return !!el && el.getAnimations({ subtree: true }).length === 0;
  });
  await page.locator('.fd-ms-panel .p-multiselect-filter').press('Escape');
  await expect(page.locator('.fd-ms-panel')).toHaveCount(0);
}

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';

function listRequest(page: Page): Promise<Request> {
  return page.waitForRequest((r) => /\/api\/v1\/admin\/learners\?/.test(r.url()) && r.method() === 'GET');
}

function query(r: Request): URLSearchParams {
  return new URL(r.url()).searchParams;
}

async function open(page: Page, locale: 'en' | 'ar' = 'en'): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, locale] as const);
  await page.goto('/admin/learners');
  await page.waitForLoadState('networkidle');
}

test('lists real learners with the Figma columns, a view link and the pager', async ({ page }) => {
  const first = listRequest(page);
  await open(page);
  const q = query(await first);

  // Its own endpoint since D-075: no role filter needed.
  expect(q.get('role')).toBeNull();
  expect(q.get('per_page')).toBe('15');

  const rows = page.locator('.ll__row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(15);
  await expect(page.locator('.ll__table thead th')).toHaveText([
    'Learner Name', 'Learner ID', 'Courses Earned', 'Qualification (%)', 'Last Certification Date', 'Last Activity', 'Actions',
  ]);
  await expect(page.locator('.nas-pager__info')).toContainText(/1–\d+ of \d+/);

  // The row's eye opens the learner's profile, like the name.
  const name = rows.first().locator('.ll__name');
  const view = rows.first().locator('a.cl-view');
  await expect(view).toHaveAttribute('href', (await name.getAttribute('href'))!);
  await expect(view).toHaveAttribute('aria-label', new RegExp(`^View ${(await name.textContent())!.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'s profile$`));
});

test('the Filter modal holds every learner filter; Learner type filters and Clear empties it', async ({ page }) => {
  await open(page);
  await expect(page.locator('.ll__chip')).toHaveCount(0);
  await page.locator('.nlt__filter').click();

  const d = page.getByRole('dialog', { name: 'Filter' });
  await expect(d.locator('.fd__label')).toHaveText(['Instructors', 'Learner type', 'Courses', 'Qualification', 'Last active from', 'Last active to']);
  await expect(d.locator('nas-datepicker')).toHaveCount(2);

  await d.locator('.p-multiselect').nth(1).click();
  await expect(page.locator('.fd-ms-panel [role=option]')).toHaveText(['Online', 'Offline', 'Hybrid']);
  await page.getByRole('option', { name: 'Offline' }).click();
  await closeList(page);
  const filtered = listRequest(page);
  await d.getByRole('button', { name: 'Filter' }).click();
  expect(query(await filtered).getAll('learner_types[]')).toEqual(['offline']);
  await expect(page.locator('.nlt__badge')).toHaveText('1');

  await page.locator('.nlt__filter').click();
  const cleared = listRequest(page);
  await page.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Clear' }).click();
  expect(query(await cleared).getAll('learner_types[]')).toEqual([]);
  await expect(page.locator('.nlt__badge')).toHaveCount(0);
});

test('the Instructors field loads real instructors and sends course_instructor_ids', async ({ page }) => {
  await open(page);
  await page.locator('.nlt__filter').click();
  const d = page.getByRole('dialog', { name: 'Filter' });
  await d.locator('.p-multiselect').first().click();

  const options = page.locator('.fd-ms-panel li.p-multiselect-item');
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await closeList(page);

  const filtered = listRequest(page);
  await d.getByRole('button', { name: 'Filter' }).click();
  const ids = query(await filtered).getAll('course_instructor_ids[]');
  expect(ids).toHaveLength(1);
  expect(Number(ids[0])).toBeGreaterThan(0);
});

test('Arabic: translated headings, filter fields and learner types', async ({ page }) => {
  await open(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.cl-title')).toHaveText('المتعلمون');
  await expect(page.locator('.ll__table thead th').first()).toHaveText('اسم المتعلم');

  // The Latin id reads left to right but sits at the start (right) of its RTL cell, under its header.
  const idCell = page.locator('.ll__row').first().locator('td.ll__c-id');
  await expect(idCell).not.toHaveAttribute('dir', /./);
  await expect(idCell.locator('bdi')).toHaveAttribute('dir', 'ltr');
  const [th, text] = await Promise.all([
    page.locator('.ll__table thead th.ll__c-id').boundingBox(),
    idCell.locator('bdi').boundingBox(),
  ]);
  expect(Math.abs((th!.x + th!.width) - (text!.x + text!.width))).toBeLessThanOrEqual(24); // the 20 px cell padding

  await page.locator('.nlt__filter').click();
  const d = page.getByRole('dialog');
  await expect(d.locator('.fd__title')).toHaveText('تصفية');
  await d.locator('.p-multiselect').nth(1).click();
  await expect(d.locator('.fd__label').nth(1)).toHaveText('نوع المتعلم');
  await expect(page.locator('.fd-ms-panel [role=option]')).toHaveText(['عن بُعد', 'حضوري', 'مدمج']);
});
