import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return next(req).pipe(
    catchError(err => {
      const status = err.status ?? 500;
      const body   = err.error;

      // 401 ends the session (auth interceptor). A refused read (403 on GET)
      // is a hidden section, not something the admin did; a refused action
      // (D-073) is, so it is reported below with the server's reason.
      if (status === 401 || (status === 403 && req.method === 'GET')) {
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
        // The first field error says what to fix; the summary only says "invalid".
        toast.warn(firstFieldError(body) ?? message ?? 'errors.validation');
      } else if (status === 403) {
        toast.warn(message ?? 'errors.forbidden');
        // The role may have changed: show the admin what they can do now.
        injector.get(AuthService).refreshPermissions(true);
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

/** The first message of a Laravel validation body (`errors: {field: [msg]}`), if any. */
function firstFieldError(body: unknown): string | null {
  const errors = (body as { errors?: unknown } | null)?.errors;
  if (!errors || typeof errors !== 'object') return null;
  for (const list of Object.values(errors as Record<string, unknown>)) {
    const first = Array.isArray(list) ? list[0] : list;
    if (typeof first === 'string' && first) return first;
  }
  return null;
}
