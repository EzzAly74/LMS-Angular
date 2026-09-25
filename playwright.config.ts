import { defineConfig, devices } from '@playwright/test';

/**
 * Layout verification harness (D-047).
 *
 * CLAUDE.md's definition of done asks for every screen to be checked at 375,
 * 768 and 1440 in both AR/RTL and EN/LTR. Before this there was no mechanism
 * at all: no Playwright, no specs, no lint target.
 *
 * ── What this checks, and what it deliberately does not ─────────────────────
 * It asserts things that are TRUE OR FALSE regardless of design taste:
 *   - `<html dir>` matches the locale (rtl for Arabic, ltr for English)
 *   - no horizontal page overflow at the viewport width
 *   - no uncaught errors or console errors while the page loads
 * and it captures a full-page screenshot of every (route x width x locale)
 * combination into e2e-artifacts/ for a human to review against Figma.
 *
 * It does NOT pixel-diff against Figma. Figma and a browser rasterise fonts,
 * anti-aliasing and sub-pixel layout differently, so a Figma-vs-browser diff
 * would never pass and would teach everyone to ignore it. The Figma comparison
 * stays a human review of the captured screenshots - the harness's job is to
 * make that review cheap and repeatable, and to catch the objective failures
 * automatically.
 *
 * And 768 px / RTL have NO Figma frames at all (FG-01, FG-02). For those, the
 * screenshots are "derived, designer review pending" - never "matches Figma".
 */

const PORT = 4300; // the Website dev server owns 4200

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',

  // The dev server compiles on first request; keep generous but bounded.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env['CI'],

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    storageState: 'e2e/.auth/admin.json',
    trace: 'retain-on-failure',
    // Screenshots are taken explicitly by the spec, with stable names.
    screenshot: 'off',
    // Honour prefers-reduced-motion so captures are not mid-animation.
    reducedMotion: 'reduce',
  },

  projects: [
    { name: 'mobile-375',   use: { ...devices['Desktop Chrome'], viewport: { width: 375,  height: 812 } } },
    { name: 'tablet-768',   use: { ...devices['Desktop Chrome'], viewport: { width: 768,  height: 1024 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    // --host is required. Without it `ng serve` binds only `localhost`, which
    // on this Windows machine resolves to IPv6 ::1, so polling 127.0.0.1 never
    // sees it and the run times out after 240s. Verified: localhost:4200
    // answered 200 while 127.0.0.1:4200 refused.
    command: `npx ng serve --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
