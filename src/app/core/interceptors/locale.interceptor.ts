import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LocaleService } from '../services/locale.service';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, SupportedLocale } from '../constants/locale.constants';

/**
 * Stamps every outgoing HTTP request with the user's current UI locale.
 *
 * Source of truth = `LocaleService.locale()` (a writable signal updated
 * synchronously by `switch()`). We fall back to `localStorage` and then
 * the global default so this still works inside guards/initializers that
 * run before LocaleService is fully booted.
 *
 * Why a signal read instead of localStorage:
 *   • Survives cross-tab desync (two tabs, different languages).
 *   • In-memory write is synchronous — no race against the localStorage
 *     write inside `LocaleService.applyLocale()`.
 *   • Tests can stub the service without touching localStorage.
 */
export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  let locale: SupportedLocale = DEFAULT_LOCALE;
  try {
    locale = inject(LocaleService).locale();
  } catch {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale;
    if (SUPPORTED_LOCALES.includes(saved)) locale = saved;
  }

  return next(req.clone({ setHeaders: { 'Accept-Language': locale } }));
};
