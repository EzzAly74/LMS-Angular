import { HttpInterceptorFn } from '@angular/common/http';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, SupportedLocale } from '../constants/locale.constants';

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale;
  const locale: SupportedLocale = SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;

  const localeReq = req.clone({
    setHeaders: { 'Accept-Language': locale },
  });

  return next(localeReq);
};
