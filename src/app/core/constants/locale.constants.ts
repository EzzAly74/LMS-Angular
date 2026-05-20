export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ar';
export const LOCALE_STORAGE_KEY = '2b_locale';

export const LOCALE_CONFIG: Record<SupportedLocale, { dir: 'ltr' | 'rtl'; label: string }> = {
  en: { dir: 'ltr', label: 'English' },
  ar: { dir: 'rtl', label: 'العربية' },
};
