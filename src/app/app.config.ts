import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { localeInterceptor } from './core/interceptors/locale.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export function createTranslateLoader(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' })
    ),
    provideHttpClient(
      withInterceptors([localeInterceptor, authInterceptor, errorInterceptor])
    ),
    provideAnimationsAsync(),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide:    TranslateLoader,
          useFactory: createTranslateLoader,
          deps:       [HttpClient],
        },
        defaultLanguage: 'ar',
      })
    ),
    MessageService,
    ConfirmationService,
    {
      // Materialise the auth session BEFORE Angular bootstraps the
      // router. Returning a Promise makes the initializer awaited, so
      // the permission guard can read `view_keys` from the very first
      // navigation (no race on a hard refresh of /admin/anything).
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () =>
        new Promise<void>(resolve => {
          auth.bootstrapSession().subscribe({
            next:     () => resolve(),
            error:    () => resolve(),
            complete: () => resolve(),
          });
        }),
      deps: [AuthService],
      multi: true,
    },
  ],
};
