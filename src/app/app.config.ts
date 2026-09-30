import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { BundledTranslateLoader } from './core/i18n/bundled-translate.loader';
import { LocaleService } from './core/services/locale.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { NasMessageService } from './core/services/toast.service';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { localeInterceptor } from './core/interceptors/locale.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

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
        // Translations ship as content-hashed build chunks, so a deploy can
        // never serve a stale cached file against new code. This replaces the
        // HTTP loader, which fetched a fixed /assets/i18n/<lang>.json URL
        // that the build never renamed. See BundledTranslateLoader.
        loader: {
          provide:  TranslateLoader,
          useClass: BundledTranslateLoader,
        },
        defaultLanguage: 'ar',
      })
    ),
    // One MessageService for the whole app; it normalises every toast (D-072).
    { provide: MessageService, useClass: NasMessageService },
    ConfirmationService,
    {
      // Load the active locale's translations BEFORE anything renders.
      //
      // This initializer did not exist, and that was the Dashboard's half of
      // "translation corrupts and needs a refresh". Angular rendered before
      // ar.json/en.json had arrived, so every `translate.instant()` returned
      // the raw key - and any component that stored the result in a field or
      // signal kept the raw key permanently. A refresh appeared to fix it only
      // because the file was then cached and usually won the race.
      //
      // Runs alongside the auth initializer below; Angular awaits both.
      provide: APP_INITIALIZER,
      useFactory: (locale: LocaleService) => () => firstValueFrom(locale.ready()),
      deps: [LocaleService],
      multi: true,
    },
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
