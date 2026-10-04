import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Inbox (Messages):
 * - NEW2B-5905: server pages with the shared pager; the tab is sent with the
 *   page and a tab change goes back to page 1;
 * - NEW2B-5904: "All" in New Message ticks only the rows the search shows, and
 *   only those are sent;
 * - the error state offers Retry; rows open by keyboard.
 * Mocked API in the real shapes (GET conversations: `result` is the list and
 * `meta` the pages). Layout at every width in EN and AR.
 */
const ARTIFACTS = resolve(__dirname, '../e2e-artifacts/inbox');
const TOTAL = 23;
const PER_PAGE = 15;

const conversation = (i: number, tab: string) => ({
  id: 1000 + i,
  subject: `Safety week ${i}`,
  course: null,
  counterpart: { name: i % 2 ? `Hesham Adly ${i}` : `هشام عدلي ${i}`, image: null, role: 'learners' },
  last_message: { body: `Message body ${i} (${tab})`, created_at: '2026-10-03T09:00:00+03:00', mine: tab === 'sent' },
  unread_count: tab === 'unread' ? 1 : 0,
  last_message_at: '2026-10-03T09:00:00+03:00',
});

const CATALOG = [
  { key: 'learner', type: 'learner', role_id: null, label: 'Learners', members: [
    { id: 1963, name: 'Hesham Adly' }, { id: 1964, name: 'Hala Samir' }, { id: 1965, name: 'Omar Nabil' },
  ] },
  { key: 'role:4', type: 'role', role_id: 4, label: 'Instructor', members: [{ id: 2, name: 'Mona Said' }] },
];

interface Seen { list: URL[]; bulk: unknown[] }

async function mock(page: Page, locale: 'en' | 'ar', opts: { failFirst?: boolean } = {}): Promise<Seen> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale] as const);
  const seen: Seen = { list: [], bulk: [] };
  let fail = opts.failFirst ?? false;

  // An inbox account that may write (the dev DB may lack the create-* seed).
  await page.route('**/api/v1/auth/admin/me', r => r.fulfill({ json: { status: 'success', message: '', result: {
    id: 99002, name: 'Inbox Admin', email: 'inbox@local.test', roles: ['inbox'], view_keys: ['view-inbox'],
    permissions: ['view-inbox', 'create-inbox'], is_super_admin: false, course_scope: 'all', role_chip: null, created_at: null,
  } } }));

  await page.route(/\/api\/v1\/conversations(\?.*)?$/, r => {
    const u = new URL(r.request().url());
    seen.list.push(u);
    if (fail) { fail = false; return r.fulfill({ status: 500, json: { status: 'error', message: 'Server error' } }); }
    const tab = u.searchParams.get('tab') ?? 'unread';
    const pageNo = Number(u.searchParams.get('page') ?? 1);
    const perPage = Number(u.searchParams.get('per_page') ?? 30);
    const from = (pageNo - 1) * perPage;
    const rows = Array.from({ length: Math.max(0, Math.min(perPage, TOTAL - from)) }, (_, i) => conversation(from + i + 1, tab));
    return r.fulfill({ json: { status: 'success', message: '', result: rows,
      meta: { current_page: pageNo, last_page: Math.ceil(TOTAL / perPage), per_page: perPage, total: TOTAL } } });
  });
  await page.route('**/api/v1/conversations/unread-count', r => r.fulfill({ json: { status: 'success', message: '', result: { count: 3 } } }));
  await page.route('**/api/v1/messages/recipients', r => r.fulfill({ json: { status: 'success', message: '', result: CATALOG } }));
  await page.route('**/api/v1/conversations/bulk', r => {
    seen.bulk.push(r.request().postDataJSON());
    return r.fulfill({ json: { status: 'success', message: '', result: { count: 1 } } });
  });
  return seen;
}

test.describe('behaviour', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

  test('pages through the inbox; a tab change returns to page 1', async ({ page }) => {
    const seen = await mock(page, 'en');
    await page.goto('/admin/messages');

    const rows = page.locator('.inbox-item:not(.inbox-item--skeleton)');
    await expect(rows).toHaveCount(PER_PAGE);
    await expect(page.locator('.nas-pager__info')).toContainText(`of ${TOTAL}`);
    let last = seen.list.at(-1)!;
    expect([last.searchParams.get('tab'), last.searchParams.get('page'), last.searchParams.get('per_page')]).toEqual(['unread', '1', String(PER_PAGE)]);

    await page.locator('.nas-pager__btn--next').click();
    await expect(rows).toHaveCount(TOTAL - PER_PAGE);
    await expect(rows.first()).toContainText('Message body 16');
    expect(seen.list.at(-1)!.searchParams.get('page')).toBe('2');
    await expect(page.locator('.nas-pager__btn--next')).toBeDisabled();

    await page.getByRole('tab').nth(2).click();
    await expect(rows).toHaveCount(PER_PAGE);
    last = seen.list.at(-1)!;
    expect([last.searchParams.get('tab'), last.searchParams.get('page')]).toEqual(['sent', '1']);

    // Rows open from the keyboard.
    await page.route('**/api/v1/conversations/1001', r => r.fulfill({ json: { status: 'success', message: '', result: {
      conversation: conversation(1, 'sent'), messages: [{ id: 1, body: 'Message body 1', mine: true, sender_name: 'Admin', created_at: '2026-10-03T09:00:00+03:00' }],
    } } }));
    await rows.first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Message body 1');
  });

  test('"All" after a search selects and sends only the results', async ({ page }) => {
    const seen = await mock(page, 'en');
    await page.goto('/admin/messages');
    await page.locator('.nas-cta-btn').click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('input[formcontrolname="title"]').fill('Safety week');
    await dialog.locator('textarea[formcontrolname="message"]').fill('Please read the new policy.');
    await dialog.locator('.nas-input-with-icon input').fill('hesh');
    await expect(dialog.locator('.recipient-list .nas-checklist__item')).toHaveCount(2); // "All" + Hesham
    await dialog.locator('.recipient-list .nas-checklist__item').first().locator('.p-checkbox').click();

    // Clearing the search shows the others still unticked.
    await dialog.locator('.nas-input-with-icon input').fill('');
    await expect(dialog.locator('.recipient-list .nas-checklist__item')).toHaveCount(5);
    await expect(dialog.locator('.recipient-list .nas-checklist__item').first().locator('.p-checkbox')).not.toHaveClass(/p-checkbox-checked/);

    await dialog.locator('button[type="submit"]').click();
    await expect.poll(() => seen.bulk.length).toBe(1);
    expect(seen.bulk[0]).toEqual({ subject: 'Safety week', body: 'Please read the new policy.', recipients: [{ type: 'learner', id: 1963 }] });
    expect(seen.list.at(-1)!.searchParams.get('tab')).toBe('sent');
  });

  test('a failed load offers Retry', async ({ page }) => {
    await mock(page, 'en', { failFirst: true });
    await page.goto('/admin/messages');
    const retry = page.locator('nas-list-state').getByRole('button');
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.locator('.inbox-item:not(.inbox-item--skeleton)')).toHaveCount(PER_PAGE);
  });
});

for (const locale of ['en', 'ar'] as const) {
  test(`inbox layout with the pager (${locale})`, async ({ page }, info) => {
    await mock(page, locale);
    await page.goto('/admin/messages');
    await expect(page.locator('.inbox-item:not(.inbox-item--skeleton)')).toHaveCount(PER_PAGE);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    const pager = page.locator('nas-pager');
    await expect(pager).toBeVisible();
    const card = await page.locator('.inbox-card').boundingBox();
    const box = await pager.boundingBox();
    expect(card && box && box.x >= card.x - 1 && box.x + box.width <= card.x + card.width + 1).toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({ path: resolve(ARTIFACTS, `${info.project.name}-${locale}.png`), fullPage: true });
  });
}
