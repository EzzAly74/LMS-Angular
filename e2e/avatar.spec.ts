import { expect, Page, Route, test } from '@playwright/test';

/**
 * The signed-in admin in the sidebar footer: the name is the localized
 * display_name (and follows a language switch), and the avatar is the photo
 * when there is one, else the first letter - also when the photo fails to
 * load. The avatar is the shared nas-avatar, so this covers its fallback for
 * every screen that uses it.
 *
 * /auth/admin/me is answered from the real response with the name and image
 * fields replaced, in the language each request asks for.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, 'behaviour test: desktop project only');

const ME = '**/api/v1/auth/admin/me';
const MISSING = 'http://127.0.0.1:4300/__e2e/missing-avatar.png';
const PHOTO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="teal"/></svg>',
);

function patchMe(page: Page, image: string | null): void {
  void page.route(ME, async (route: Route) => {
    const ar = route.request().headers()['accept-language'] === 'ar';
    const response = await route.fetch();
    const body = await response.json();
    body.result = {
      ...body.result,
      name: 'Mohamed Saeed',
      display_name: ar ? 'محمد سعيد' : 'Mohamed Saeed',
      image,
    };
    await route.fulfill({ response, json: body });
  });
}

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('2b_locale', 'en'));
  await page.goto('/admin/job-titles');
  await page.waitForLoadState('networkidle');
}

const avatar = (page: Page) => page.locator('.nas-sidebar__footer nas-avatar');

test('without a photo the avatar is the initial of the localized name, and both follow a language switch', async ({ page }) => {
  patchMe(page, null);
  await open(page);

  await expect(page.locator('.nas-profile__name')).toHaveText('Mohamed Saeed');
  await expect(avatar(page).locator('img')).toHaveCount(0);
  await expect(avatar(page)).toHaveText('M');

  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('.nas-profile__name')).toHaveText('محمد سعيد');
  await expect(avatar(page)).toHaveText('م');
});

test('a photo is shown with its size set, decorative alt and eager loading in the sidebar', async ({ page }) => {
  patchMe(page, PHOTO);
  await open(page);

  const img = avatar(page).locator('img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('width', '36');
  await expect(img).toHaveAttribute('height', '36');
  await expect(img).toHaveAttribute('alt', '');
  await expect(img).toHaveAttribute('loading', 'eager');
  await expect(img).toHaveAttribute('decoding', 'async');
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test('a photo that fails to load falls back to the initial', async ({ page }) => {
  await page.route(MISSING, (route) => route.fulfill({ status: 404, body: '' }));
  patchMe(page, MISSING);
  await open(page);

  await expect(avatar(page).locator('img')).toHaveCount(0);
  await expect(avatar(page)).toHaveText('M');
});
