import type { LocalizedText } from '../models/localized.types';

/**
 * Anything we might get from the API: a plain string, a localized object,
 * or null/undefined when the field is missing.
 *
 * We use a structural `{ [locale: string]: ... }` type so callers can pass any
 * partial-locale object (e.g. `{ en?: string }`) without a cast.
 */
export type MaybeLocalized =
  | string
  | LocalizedText
  | Readonly<Record<string, string | undefined>>
  | null
  | undefined;

/**
 * Defensive helper that always returns a plain string for the UI.
 *
 * Laravel resources are expected to return locale-resolved strings already
 * (via the `Accept-Language` header), but if a payload ever leaks a raw
 * `{ en, ar }` object we still render a sensible value instead of
 * "[object Object]".
 *
 * @param value  Localized value coming from the API.
 * @param locale Preferred locale (e.g. 'en' | 'ar'). Falls back to the other
 *               language and finally to any first non-empty value.
 * @param empty  Placeholder when nothing is available (default empty string).
 */
export function pickLocalized(
  value: MaybeLocalized,
  locale: 'en' | 'ar' = 'en',
  empty = '',
): string {
  if (value === null || value === undefined) return empty;
  if (typeof value === 'string') return value;

  const bag = value as Record<string, string | undefined>;

  const direct = bag[locale];
  if (typeof direct === 'string' && direct.trim().length) return direct;

  const fallbackKey: 'en' | 'ar' = locale === 'en' ? 'ar' : 'en';
  const fallback = bag[fallbackKey];
  if (typeof fallback === 'string' && fallback.trim().length) return fallback;

  for (const v of Object.values(bag)) {
    if (typeof v === 'string' && v.trim().length) return v;
  }

  return empty;
}

/**
 * Pulls a display name out of either:
 *   - a plain string ("Safety"),
 *   - a relation object ({ id, name }) where `name` may itself be localized,
 *   - or null/undefined.
 *
 * Used by row templates that bind to fields like `course.category` /
 * `course.instructor` which can be either a flat string or a nested object.
 */
export function displayName(
  value: MaybeLocalized | { name?: MaybeLocalized; title?: MaybeLocalized } | null | undefined,
  locale: 'en' | 'ar' = 'en',
  empty = '—',
): string {
  if (value === null || value === undefined) return empty;
  if (typeof value === 'string') return value || empty;

  if (typeof value === 'object') {
    if ('en' in value || 'ar' in value) {
      return pickLocalized(value as LocalizedText, locale, empty);
    }
    const obj = value as { name?: MaybeLocalized; title?: MaybeLocalized };
    return pickLocalized(obj.name ?? obj.title, locale, empty);
  }

  return empty;
}
