import { expect, Page, Request, test } from '@playwright/test';

/**
 * "Assign Qualification" on the Learners list (D3, D-053).
 *
 * The dev database has no qualifications and a real grant would write to it,
 * so the qualification list and the bulk-grant POST are answered here; the
 * learners come from the real API. The request the page sends is asserted
 * exactly - that is the contract with POST admin/qualification-skills/{id}/learners.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';

async function setup(page: Page, posts: Request[]): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  await page.route('**/api/v1/qualification-skills/active', (r) =>
    r.fulfill({ json: { status: 'success', message: '', result: [{ id: 7, name: 'Fixture Qualification' }, { id: 8, name: 'Other Qualification' }] } }),
  );
  await page.route('**/api/v1/admin/qualification-skills/*/learners', (r) => {
    posts.push(r.request());
    return r.fulfill({ status: 201, json: { status: 'success', message: '', result: { granted: 2, already_held: 1 } } });
  });
  await page.goto('/admin/learners');
  await page.waitForLoadState('networkidle');
}

test('assigns one qualification to the learners ticked', async ({ page }) => {
  const posts: Request[] = [];
  await setup(page, posts);

  await page.getByRole('button', { name: 'Assign Qualification' }).click();
  const dialog = page.locator('.aq__card');
  await expect(dialog).toBeVisible();

  const submit = dialog.locator('.aq__btn--primary');
  await expect(submit).toBeDisabled(); // nothing chosen yet

  await dialog.getByText('Fixture Qualification', { exact: true }).click();
  await expect(submit).toBeDisabled(); // no learner yet

  const learners = dialog.locator('.aq__list').nth(1).locator('.aq__option');
  await expect(learners.first()).toBeVisible();
  await learners.nth(0).click();
  await learners.nth(1).click();
  await expect(dialog.locator('.aq__count')).toHaveText('Selected: 2');
  await expect(submit).toHaveText('Assign (2)');

  await submit.click();
  await expect(dialog).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(posts[0].url()).toMatch(/\/admin\/qualification-skills\/7\/learners$/);
  const body = posts[0].postDataJSON() as { user_ids: number[] };
  expect(body.user_ids).toHaveLength(2);
  expect(body.user_ids.every((n) => Number.isInteger(n) && n > 0)).toBe(true);

  await expect(page.locator('.p-toast-detail')).toHaveText('Granted to 2. Already held by 1.');
});

test('"everyone matching" is refused above the 500 the API accepts', async ({ page }) => {
  const posts: Request[] = [];
  await setup(page, posts);
  // The unfiltered dev list has 1,056 learners - over the limit.
  await page.getByRole('button', { name: 'Assign Qualification' }).click();
  const dialog = page.locator('.aq__card');
  await dialog.getByText('Fixture Qualification', { exact: true }).click();
  await dialog.locator('.aq__mode').nth(1).click();

  await expect(dialog.locator('.aq__note--warn')).toContainText('at most 500');
  await expect(dialog.locator('.aq__btn--primary')).toBeDisabled();
  expect(posts).toHaveLength(0);
});

test('"everyone matching" pages through the whole filtered list and posts every id', async ({ page }) => {
  const posts: Request[] = [];
  // Every dev learner is "online", so a real filter matching 1..500 learners
  // is not available. Answer the filtered list with 150 learners over two
  // pages of 100 - exactly the paging the dialog has to follow.
  const FILTERED = Array.from({ length: 150 }, (_, i) => ({
    id: 5000 + i, source: 'user', composite_id: `user:${5000 + i}`, name: `Fixture Learner ${i + 1}`,
    machine_code: null, image: null, avatar_initial: 'F', job_title: null, courses_earned: 0,
    compliance_pct: null, last_certification_at: null, last_active_at: null,
  }));
  const listCalls: string[] = [];
  await page.route('**/api/v1/admin/users?**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (!q.getAll('learner_types[]').includes('offline')) return route.continue();
    const pageNo = Number(q.get('page') ?? '1');
    const per = Number(q.get('per_page') ?? '15');
    listCalls.push(`${pageNo}x${per}`);
    return route.fulfill({
      json: {
        status: 'success', message: '', result: FILTERED.slice((pageNo - 1) * per, pageNo * per),
        meta: { current_page: pageNo, last_page: Math.ceil(FILTERED.length / per), per_page: per, total: FILTERED.length },
      },
    });
  });
  await setup(page, posts);

  await page.getByRole('button', { name: 'Learners', exact: true }).click();
  await page.locator('.nas-fp__card').getByText('Offline', { exact: true }).click();
  await page.locator('.nas-fp__card').getByRole('button', { name: 'Filter' }).click();
  await expect(page.locator('.ll__pager-info')).toContainText('of 150');

  await page.getByRole('button', { name: 'Assign Qualification' }).click();
  const dialog = page.locator('.aq__card');
  await dialog.getByText('Fixture Qualification', { exact: true }).click();
  await dialog.locator('.aq__mode').nth(1).click();
  await expect(dialog.locator('.aq__btn--primary')).toHaveText('Assign (150)');
  await dialog.locator('.aq__btn--primary').click();
  await expect(dialog).toBeHidden();

  // Two pages of 100, with the list's filter, then one POST with all 150.
  expect(listCalls).toEqual(expect.arrayContaining(['1x100', '2x100']));
  expect(posts).toHaveLength(1);
  const ids = (posts[0].postDataJSON() as { user_ids: number[] }).user_ids;
  expect(ids).toHaveLength(150);
  expect(new Set(ids).size).toBe(150);
});

test('Escape closes the dialog without posting', async ({ page }) => {
  const posts: Request[] = [];
  await setup(page, posts);
  const button = page.getByRole('button', { name: 'Assign Qualification' });
  await button.click();
  await expect(page.locator('.aq__card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.aq__card')).toBeHidden();
  await expect(button).toBeFocused();
  expect(posts).toHaveLength(0);
});
