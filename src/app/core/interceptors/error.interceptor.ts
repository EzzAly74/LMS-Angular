import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast    = inject(MessageService);
  const injector = inject(Injector);

  return next(req).pipe(
    catchError(err => {
      const status = err.status ?? 500;
      const body   = err.error;

      if (status === 401 || status === 403) {
        return throwError(() => err);
      }

      // (A guard for `/assets/i18n/` requests used to sit here, to stop an
      // HTTP translation fetch re-entering the DI cycle that constructs
      // TranslateService. Translations are now bundled chunks loaded by
      // BundledTranslateLoader and never pass through HttpClient, so the
      // guard could no longer match anything and was removed.)
      const translate = injector.get(TranslateService);
      const t = (key: string) => translate.instant(key);

      if (status === 422) {
        const message = body?.message ?? body?.error ?? t('errors.validation');
        toast.add({ severity: 'warn', summary: t('errors.title'), detail: message, life: 5000 });
        return throwError(() => err);
      }

      if (status >= 500) {
        toast.add({ severity: 'error', summary: t('errors.title'), detail: t('errors.server'), life: 5000 });
      } else if (status === 404) {
        toast.add({ severity: 'warn', summary: t('errors.title'), detail: t('errors.not_found'), life: 4000 });
      } else {
        const message = body?.message ?? body?.error ?? t('errors.unexpected');
        toast.add({ severity: 'error', summary: t('errors.title'), detail: message, life: 5000 });
      }

      return throwError(() => err);
    })
  );
};
