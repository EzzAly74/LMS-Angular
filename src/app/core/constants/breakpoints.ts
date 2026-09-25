/**
 * Layout breakpoints (D-025, FG-09).
 *
 * Neither the Dashboard nor its Figma file defined any breakpoints, and the
 * admin layout shell had no media queries at all - so the 260 px sidebar sat
 * at full width on every screen. At 375 px that left 91 px for the whole page,
 * and every route overflowed horizontally by 132 px (measured by the
 * Playwright layout harness).
 *
 * Kept in TypeScript rather than a CSS custom property because a custom
 * property cannot be used inside a `@media` query; the layout reads these via
 * `matchMedia`, which takes a plain string.
 */

/**
 * At or below this width the sidebar is held collapsed to its 72 px rail.
 *
 * D-025: "The Dashboard is desktop-first: the sidebar collapses to 72 px as
 * designed at <=1024, and there is no bespoke phone layout."
 */
export const SIDEBAR_COLLAPSE_MAX_WIDTH = 1024;

/** The media query for {@link SIDEBAR_COLLAPSE_MAX_WIDTH}. */
export const SIDEBAR_COLLAPSE_QUERY = `(max-width: ${SIDEBAR_COLLAPSE_MAX_WIDTH}px)`;
