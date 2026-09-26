import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
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
/**
 * A detail route needs a real record's id, which differs per database, so it
 * is looked up when its test runs (not when the list is built: Playwright
 * collects tests before global-setup, so a list extended from setup output
 * silently misses entries). No record on this database -> the test is
 * reported as skipped, never pointed at an invented id.
 */
interface DetailRoute {
  name: string;
  /** API list whose first row supplies the ids. */
  list: string;
  params?: Record<string, string>;
  /** The route for that row; undefined when the row lacks what it needs. */
  path: (row: FirstRow) => string | undefined;
}

/** The fields detail routes read from a list's first row. */
interface FirstRow {
  id?: number;
  learner?: { id: number };
  course?: { id: number };
  template?: { id: number | null };
}

type Route = string | DetailRoute;

const ROUTES: Route[] = [
  'dashboard',
  'courses',
  'categories',
  'users',
  'job-titles',
  'learners',
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
  { name: 'job-titles-detail', list: '/api/v1/job-titles', path: (r) => r.id && `job-titles/${r.id}` },
  { name: 'learners-detail', list: '/api/v1/admin/users', params: { role: 'learner' }, path: (r) => r.id && `learners/${r.id}` },
  // D4 (Figma 2169:108198, 2017:52260, 2169:108801).
  { name: 'evaluations-results', list: '/api/v1/admin/evaluations/templates', path: (r) => r.id && `evaluations/${r.id}` },
  'evaluations/scores',
  {
    name: 'evaluations-submission',
    list: '/api/v1/admin/evaluations/scores',
    path: (r) => r.learner && r.course && `evaluations/scores/${r.learner.id}/${r.course.id}?template=${r.template?.id ?? ''}`,
  },
];

const API_BASE = process.env['E2E_API_BASE'] ?? 'http://127.0.0.1:8000';

/** The first record of an API list, authenticated as the harness admin. */
async function firstRow(request: APIRequestContext, list: string, extra: Record<string, string> = {}): Promise<FirstRow | undefined> {
  const state = JSON.parse(readFileSync(resolve(__dirname, '.auth/admin.json'), 'utf8')) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const token = state.origins[0]?.localStorage.find((e) => e.name === '2b_token')?.value;
  const res = await request.get(`${API_BASE}${list}`, {
    params: { per_page: 1, ...extra },
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return undefined;
  const body = (await res.json()) as { result?: FirstRow[] | { data?: FirstRow[] } };
  const rows = Array.isArray(body.result) ? body.result : body.result?.data;
  return rows?.[0];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    for (const entry of ROUTES) {
      const name = typeof entry === 'string' ? entry : entry.name;
      test(name, async ({ page, request }, testInfo) => {
        let route: string;
        if (typeof entry === 'string') {
          route = entry;
        } else {
          const row = await firstRow(request, entry.list, entry.params);
          const path = row ? entry.path(row) : undefined;
          test.skip(!path, `${entry.name}: no record on this database to open`);
          route = path as string;
        }

        const errors = watchForErrors(page);

        await page.goto(`/admin/${route}`);
        await page.waitForLoadState('networkidle');

        // Landed where we asked, rather than bounced to login or a 403 page.
        // A redirect here means the harness's admin lacks a permission or the
        // token was rejected - either way the screenshot would be meaningless.
        await expect(page, `${route} redirected away`).toHaveURL(new RegExp(`/admin/${escapeRegExp(route)}`));

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

        // 2b. No table is CLIPPED by a container that cannot scroll.
        //
        // Check 2 alone has a blind spot, found 2026-09-25: a container with
        // `overflow: hidden` stops the page overflowing precisely BY cutting
        // its content off. The dashboard's top-courses table passed check 2 at
        // 375 px while 3 of its 6 columns were unreachable - the page was
        // "fine" because the columns were simply gone. A wide table must
        // scroll inside its card, never be silently truncated.
        const clipped = await page.evaluate(() => {
          const found: string[] = [];
          for (const table of Array.from(document.querySelectorAll('table, [role="table"]'))) {
            let el = table.parentElement;
            while (el && el !== document.body) {
              const cs = getComputedStyle(el);
              if (
                (cs.overflowX === 'hidden' || cs.overflowX === 'clip') &&
                el.scrollWidth > el.clientWidth + 1
              ) {
                const cls = String(el.className).trim().split(/\s+/).slice(0, 2).join('.');
                found.push(
                  `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} hides ` +
                    `${el.scrollWidth - el.clientWidth}px of a table ` +
                    `(${el.clientWidth}px visible of ${el.scrollWidth}px)`,
                );
                break;
              }
              el = el.parentElement;
            }
          }
          return found;
        });
        expect(clipped, `${route} clips table content the user cannot reach`).toEqual([]);

        // Evidence for the human Figma review, taken before the error
        // assertion so a failing page still leaves a screenshot behind.
        const dir = resolve(ARTIFACTS, name);
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
