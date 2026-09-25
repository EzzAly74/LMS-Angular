import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Objective layout checks at every width and in both directions (D-047).
 *
 * Runs once per Playwright project (375 / 768 / 1440) and, inside each, once
 * per locale. For every route it asserts:
 *
 *   1. `<html dir>` is correct for the locale.
 *   2. The page does not scroll horizontally. Horizontal overflow at a given
 *      width is the most common RTL and small-screen defect, and it is binary.
 *   3. No uncaught exception and no console error fired while it loaded.
 *
 * Then it saves a full-page screenshot for human review against Figma. The
 * screenshot is evidence for a review, not an assertion - see
 * playwright.config.ts for why this does not pixel-diff against Figma.
 */

const LOCALE_KEY = '2b_locale';

/**
 * The sections of the 2026 redesign, i.e. the ones in the Dashboard nav.
 *
 * Excluded on purpose:
 *   - exams, articles, forms: legacy sections the human approved removing
 *     (F1 in the 2026-09-25 answers). Verifying the layout of screens that are
 *     being deleted is wasted effort.
 *   - ratings: replaced by Evaluations once that flow ships (Q-050).
 */
const ROUTES = [
  'dashboard',
  'courses',
  'categories',
  'users',
  'job-titles',
  'qualifications',
  'assignments',
  'quizzes',
  'evaluations',
  'certificates',
  'instructors',
  'attendance',
  'reports',
  'messages',
  'roles',
  'controllers',
  'audit-log',
  'settings',
] as const;

const LOCALES = [
  { code: 'en', dir: 'ltr' },
  { code: 'ar', dir: 'rtl' },
] as const;

const ARTIFACTS = resolve(__dirname, '../e2e-artifacts');

/**
 * A raw translation key as it would render: lowercase dotted identifiers with
 * at least two dots, e.g. `course_detail.tabs.cohorts`.
 *
 * This is the regression guard for "translation corrupts and needs a refresh"
 * (2026-09-25). Every Playwright test starts with an empty cache, so every one
 * is a cold boot - exactly the path where the Dashboard used to render before
 * its translations had loaded, leaving raw keys on screen.
 */
const RAW_KEY = /\b[a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,}\b/g;

/** Dotted strings that are legitimately not translation keys. */
function isNotAKey(token: string): boolean {
  return /@|www\.|\.(com|eg|net|org|io|sa|ae)\b|^\d/.test(token);
}

/** Collect everything the page reports as broken while it loads. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`));

  // Record failing requests WITH their URL. The browser's own console line
  // for this is just "Failed to load resource: ... 404" and omits the URL, so
  // on its own it is undebuggable. The console duplicate is dropped below so
  // each failure is reported once, with the information needed to fix it.
  page.on('response', (res) => {
    if (res.status() >= 400) {
      errors.push(`http ${res.status()}: ${res.request().method()} ${res.url()}`);
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      errors.push(`console: ${msg.text()}`);
    }
  });

  return errors;
}

for (const locale of LOCALES) {
  test.describe(`${locale.code.toUpperCase()} / ${locale.dir.toUpperCase()}`, () => {
    test.beforeEach(async ({ page }) => {
      // Set the locale before the app boots, exactly as a returning user has
      // it - so the first render is already in the right direction and no
      // flash of the wrong layout is mistaken for the real one.
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [LOCALE_KEY, locale.code] as const,
      );
    });

    for (const route of ROUTES) {
      test(`${route}`, async ({ page }, testInfo) => {
        const errors = watchForErrors(page);

        await page.goto(`/admin/${route}`);
        await page.waitForLoadState('networkidle');

        // Landed where we asked, rather than bounced to login or a 403 page.
        // A redirect here means the harness's admin lacks a permission or the
        // token was rejected - either way the screenshot would be meaningless.
        await expect(page, `${route} redirected away`).toHaveURL(new RegExp(`/admin/${route}`));

        // 1. Direction.
        await expect(page.locator('html')).toHaveAttribute('dir', locale.dir);

        // 1b. No untranslated keys rendered. Checked on the settled page, on a
        // cold cache - the case that used to fail.
        const rendered = await page.locator('body').innerText();
        const rawKeys = [...new Set(rendered.match(RAW_KEY) ?? [])].filter((k) => !isNotAKey(k));
        expect(rawKeys, `${route} shows untranslated keys`).toEqual([]);

        // 2. No horizontal scroll. +1 absorbs sub-pixel rounding only.
        const overflow = await page.evaluate(() => {
          const el = document.documentElement;
          return { scroll: el.scrollWidth, client: el.clientWidth };
        });
        expect(
          overflow.scroll,
          `${route} overflows horizontally by ${overflow.scroll - overflow.client}px`,
        ).toBeLessThanOrEqual(overflow.client + 1);

        // Evidence for the human Figma review, taken before the error
        // assertion so a failing page still leaves a screenshot behind.
        const dir = resolve(ARTIFACTS, route);
        mkdirSync(dir, { recursive: true });
        await page.screenshot({
          path: resolve(dir, `${testInfo.project.name}-${locale.code}.png`),
          fullPage: true,
        });

        // 3. Nothing broke while loading.
        expect(errors, `${route} reported errors while loading`).toEqual([]);
      });
    }
  });
}
