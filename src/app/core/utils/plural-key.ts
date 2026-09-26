/**
 * The translation key for a count, chosen by the locale's plural rules.
 *
 * ngx-translate has no plural support, and a single "{{n}} qualifications"
 * string is wrong in Arabic, which has six plural forms: 0, 1, 2, 3-10,
 * 11-99 and the rest take different words (D-051). `Intl.PluralRules` gives
 * the CLDR category, and the key is `<base>.<category>`:
 *
 *   en: one, other
 *   ar: zero, one, two, few, many, other
 *
 * So every counted string needs those sub-keys in each locale file.
 */
export function pluralKey(base: string, count: number, locale: string): string {
  return `${base}.${new Intl.PluralRules(locale).select(count)}`;
}
