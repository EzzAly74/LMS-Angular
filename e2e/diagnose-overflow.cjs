/**
 * Diagnostic: which elements overflow the viewport at a given width?
 *
 * The layout harness (layout.spec.ts) reports THAT a page overflows - "by
 * 132px" - but not WHY. This lists the outermost elements whose edge crosses
 * the viewport, widest first, so the cause can be fixed at its source.
 *
 * Reuses the harness's saved session (e2e/.auth/admin.json, written by
 * global-setup.ts on any `npm run e2e`), so no credential is handled here.
 * Needs the dev server running on :4300.
 *
 *   node e2e/diagnose-overflow.cjs [route] [width] [locale]
 *   node e2e/diagnose-overflow.cjs dashboard 375 ar
 */
const { chromium } = require('@playwright/test');
const { resolve } = require('node:path');

async function main() {
  const route = process.argv[2] || 'dashboard';
  const width = Number(process.argv[3] || 375);
  const locale = process.argv[4] || 'en';

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height: 812 },
    storageState: resolve(__dirname, '.auth/admin.json'),
  });
  await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['2b_locale', locale]);

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4300/admin/${route}`);
  await page.waitForLoadState('networkidle');

  const report = await page.evaluate((vw) => {
    const rtl = document.documentElement.dir === 'rtl';
    const hits = [];

    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = rtl ? Math.round(-r.left) : Math.round(r.right - vw);
      if (over <= 1) continue;
      hits.push({ el, r, over });
    }

    // Keep only the OUTERMOST overflowing elements: a descendant overflows
    // only because its ancestor does, so it is a symptom, not the cause.
    const outer = hits.filter((h) => !hits.some((o) => o !== h && o.el.contains(h.el)));

    const describe = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    };

    return {
      dir: document.documentElement.dir,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      outermostOverflowing: outer.slice(0, 10).map((h) => {
        const cs = getComputedStyle(h.el);
        return {
          el: describe(h.el),
          parent: h.el.parentElement ? describe(h.el.parentElement) : null,
          left: Math.round(h.r.left),
          width: Math.round(h.r.width),
          overflowPx: h.over,
          display: cs.display,
          minWidth: cs.minWidth,
          flex: cs.flex,
          width_css: cs.width,
        };
      }),
    };
  }, width);

  console.log(JSON.stringify({ route, width, locale, ...report }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
