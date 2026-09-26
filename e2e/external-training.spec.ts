import { expect, Page, Request, test } from '@playwright/test';

/**
 * External Training review (D8; Figma 2181:116177 list, 2181:116391 review,
 * 2209:90462 rejection reason).
 *
 * Every admin/external-training call is answered here, so a run never
 * decides a real request; the request the page sends is asserted exactly.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const LOCALE_KEY = '2b_locale';
const STATS = { pending: 2, this_year: 30, rejected_this_year: 1, year: 2026 };

const req = (id: number, status: 'pending' | 'approved' | 'rejected', extra: Record<string, unknown> = {}) => ({
  id, title: 'Advanced Excel for Finance', provider: 'Coursera', start_date: '2026-08-12', end_date: '2026-09-12',
  hours: 30, cost: 1500, currency: 'EGP', status, rejection_reason: null, qualification: null, course: null,
  certificate: { name: 'File Title.png', mime: 'image/png', size: 320000 },
  submitted_at: '2026-09-16 10:00:00', decided_at: null,
  learner: { id: 7, name: 'Layla Hassan', employee_id: 'EMP7' }, decided_by: null, ...extra,
});

async function setup(page: Page): Promise<string[]> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [LOCALE_KEY, 'en'] as const);
  const lists: string[] = [];
  await page.route('**/api/v1/admin/external-training?**', r => {
    lists.push(r.request().url());
    const rows = [
      req(1, 'pending', { learner: { id: 8, name: 'Fatima Al-Rashidi', employee_id: null }, provider: 'Udemy' }),
      req(2, 'approved', { qualification: { id: 5, name: 'Financial Analysis' }, course: { id: 3, title: 'Workplace Safety Essentials' } }),
      req(3, 'rejected', { learner: { id: 9, name: 'Tariq Al-Saud', employee_id: null }, provider: 'Linkedin learning' }),
    ];
    return r.fulfill({ json: { status: 'success', message: '', result: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: 3, stats: STATS } } });
  });
  await page.route('**/api/v1/admin/external-training/stats', r => r.fulfill({ json: { status: 'success', message: '', result: STATS } }));
  await page.route('**/api/v1/admin/external-training/options', r => r.fulfill({ json: { status: 'success', message: '', result: {
    qualifications: [{ id: 5, name: 'Financial Analysis' }, { id: 6, name: 'Workplace Safety' }],
    courses: [{ id: 3, title: 'Workplace Safety Essentials' }],
  } } }));
  return lists;
}

async function mockOne(page: Page, row: ReturnType<typeof req>): Promise<Request[]> {
  const posts: Request[] = [];
  await page.route(`**/api/v1/admin/external-training/${row.id}`, r => r.fulfill({ json: { status: 'success', message: '', result: row } }));
  await page.route(`**/api/v1/admin/external-training/${row.id}/*`, r => {
    const req0 = r.request();
    if (req0.method() !== 'POST') return r.fallback();
    posts.push(req0);
    const action = new URL(req0.url()).pathname.split('/').pop();
    const body = req0.postDataJSON() ?? {};
    const decided = action === 'approve'
      ? { ...row, status: 'approved', decided_at: '2026-09-26 12:00:00', decided_by: { id: 1, name: 'Admin' },
          qualification: body.qualification_skill_id === 5 ? { id: 5, name: 'Financial Analysis' } : null }
      : action === 'reject'
        ? { ...row, status: 'rejected', rejection_reason: body.reason, decided_at: '2026-09-26 12:00:00', decided_by: { id: 1, name: 'Admin' } }
        : { ...row, status: 'pending', decided_at: null, decided_by: null, rejection_reason: null };
    return r.fulfill({ json: { status: 'success', message: '', result: decided } });
  });
  return posts;
}

test('the list shows the tiles and every column, pending first', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/external-training');

  await expect(page.getByRole('heading', { name: 'External Training Requests' })).toBeVisible();
  const tiles = page.locator('nas-stat-tile');
  await expect(tiles).toHaveText([/2\s*Pending/, /30\s*Requests in 2026/, /1\s*Rejected/]);
  await expect(page.locator('thead th')).toHaveText(['Learner', 'Course', 'Provider', 'Qualification', 'Submitted', 'Hours', 'Status', 'Actions']);

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Fatima Al-Rashidi');
  await expect(rows.nth(0)).toContainText('Advanced Excel for Finance'); // no linked course: the learner's own title
  await expect(rows.nth(0)).toContainText('30h');
  await expect(rows.nth(0)).toContainText('Pending');
  await expect(rows.nth(1)).toContainText('Workplace Safety Essentials'); // the linked course
  await expect(rows.nth(1)).toContainText('Financial Analysis');
  await expect(rows.nth(1)).toContainText('Accepted');
  await expect(rows.nth(0).getByRole('link', { name: /Review the request from Fatima/ })).toHaveAttribute('href', '/admin/external-training/1');
});

test('the status chips and search narrow the list on the server', async ({ page }) => {
  const lists = await setup(page);
  await page.goto('/admin/external-training');
  await expect(page.locator('tbody tr')).toHaveCount(3);

  const before = lists.length;
  await page.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect.poll(() => lists.length).toBeGreaterThan(before);
  expect(new URL(lists.at(-1) ?? '').searchParams.getAll('statuses[]')).toEqual(['pending']);

  await page.getByRole('searchbox').fill('coursera');
  await expect.poll(() => new URL(lists.at(-1) ?? '').searchParams.get('search')).toBe('coursera');
});

test('approving asks first, then sends the chosen qualification', async ({ page }) => {
  await setup(page);
  const posts = await mockOne(page, req(1, 'pending'));
  await page.goto('/admin/external-training/1');

  await expect(page.getByRole('heading', { name: 'Review External Training Request' })).toBeVisible();
  await expect(page.locator('.etr__grid dd').first()).toHaveText('Advanced Excel for Finance');
  await expect(page.getByText('1500 EGP')).toBeVisible();
  await expect(page.getByRole('button', { name: /Download File Title.png/ })).toContainText('PNG');

  await page.locator('#etr-qualification').locator('..').click();
  await page.getByRole('option', { name: 'Financial Analysis' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Approve this request?' });
  await expect(confirm).toBeVisible();
  expect(posts).toHaveLength(0);
  await confirm.getByRole('button', { name: 'Approve' }).click();

  await expect.poll(() => posts.length).toBe(1);
  expect(new URL(posts[0].url()).pathname).toMatch(/\/1\/approve$/);
  expect(posts[0].postDataJSON()).toEqual({ qualification_skill_id: 5, course_id: null });
  await expect(page.getByRole('status').filter({ hasText: 'Accepted' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
});

test('rejecting needs a reason, which is sent and then shown', async ({ page }) => {
  await setup(page);
  const posts = await mockOne(page, req(1, 'pending'));
  await page.goto('/admin/external-training/1');

  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rejection reason' });
  const submit = dialog.getByRole('button', { name: 'Submit' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('Write your reason below').fill('   ');
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('Write your reason below').fill('The certificate is not legible.');
  await submit.click();

  await expect(dialog).toBeHidden();
  expect(posts[0].postDataJSON()).toEqual({ reason: 'The certificate is not legible.' });
  await expect(page.getByRole('status')).toContainText('The certificate is not legible.');
});

test('a decided request is read-only; only a super admin may reopen it', async ({ page }) => {
  await setup(page);
  await mockOne(page, req(2, 'approved', { qualification: { id: 5, name: 'Financial Analysis' }, decided_at: '2026-09-20 10:00:00' }));
  await page.goto('/admin/external-training/2');
  await expect(page.getByRole('status').filter({ hasText: 'Accepted' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Approve|Reject|Reopen/ })).toHaveCount(0);

  // The same request seen by a super admin.
  await page.route('**/api/v1/auth/admin/me', async r => {
    const res = await r.fetch();
    const body = await res.json();
    body.result = { ...(body.result ?? {}), is_super_admin: true };
    return r.fulfill({ response: res, json: body });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Reopen request' }).click();
  await page.getByRole('dialog', { name: 'Reopen request' }).getByRole('button', { name: 'Reopen request' }).click();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
});

test('an unknown request says so', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/admin/external-training/999', r => r.fulfill({ status: 404, json: { status: 'error', message: 'Not found' } }));
  await page.goto('/admin/external-training/999');
  await expect(page.getByRole('alert').filter({ hasText: 'does not exist' })).toBeVisible();
});
