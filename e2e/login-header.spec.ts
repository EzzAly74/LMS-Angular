import { expect, test } from '@playwright/test';

/**
 * NEW2B-5959: the login page has the Figma header (Login 15:3, header
 * 2320:84528): the logo and an English / العربية switch that changes the
 * page language in place. Signed out, at 375 / 768 / 1440, EN and AR.
 */
test.use({ storageState: { cookies: [], origins: [] } });

for (const locale of ['en', 'ar'] as const) {
  test(`login header shows the logo and switches language (${locale})`, async ({ page }, info) => {
    await page.addInitScript((l) => window.localStorage.setItem('2b_locale', l), locale);
    await page.goto('/auth/login');

    const header = page.locator('.login-header');
    await expect(header.getByRole('img')).toBeVisible();
    const en = header.getByRole('button', { name: 'English' });
    const ar = header.getByRole('button', { name: 'العربية' });
    await expect(locale === 'en' ? en : ar).toHaveAttribute('aria-pressed', 'true');

    // The header spans the page and nothing scrolls sideways.
    const box = (await header.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    // The form is not hidden under the header.
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(title.y).toBeGreaterThanOrEqual(box.y + box.height);
    await page.screenshot({ path: `e2e-artifacts/login-header-${locale}-${info.project.name}.png` });

    // Switching changes the page language in place.
    await (locale === 'en' ? ar : en).click();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'en' ? 'rtl' : 'ltr');
    await expect(locale === 'en' ? ar : en).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'en' ? /مرحب/ : 'Welcome back');
  });
}
