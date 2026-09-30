import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return next(req).pipe(
    catchError(err => {
      const status = err.status ?? 500;
      const body   = err.error;

      if (status === 401 || status === 403) {
        return throwError(() => err);
      }

      // Resolved lazily: ToastService needs TranslateService, which must not
      // be constructed while an interceptor is being built (DI cycle).
      const toast = injector.get(ToastService);
      // A Blob / ArrayBuffer body (file downloads) has no message to show.
      const message = typeof body?.message === 'string' ? body.message
        : typeof body?.error === 'string' ? body.error
        : null;

      if (status === 422) {
        toast.warn(message ?? 'errors.validation');
      } else if (status >= 500) {
        toast.error('errors.server');
      } else if (status === 404) {
        toast.warn('errors.not_found');
      } else if (status === 0) {
        toast.error('errors.network');
      } else {
        toast.error(message ?? 'errors.unexpected');
      }

      return throwError(() => err);
    })
  );
};
