import { Injectable, signal, effect } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  SupportedLocale,
} from '../constants/locale.constants';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  readonly locale = signal<SupportedLocale>(this.loadSaved());

  /**
   * Emits the new locale whenever the user switches language.
   * List/detail components subscribe to this and re-fetch with the
   * new `Accept-Language` header so the UI never displays stale text.
   */
  private readonly _changes$ = new Subject<SupportedLocale>();
  readonly changes$: Observable<SupportedLocale> = this._changes$.asObservable();

  constructor(private translate: TranslateService) {
    translate.addLangs([...SUPPORTED_LOCALES]);
    translate.setDefaultLang(DEFAULT_LOCALE);

    let previous: SupportedLocale | null = null;
    effect(() => {
      const next = this.locale();
      this.applyLocale(next);
      if (previous !== null && previous !== next) this._changes$.next(next);
      previous = next;
    });
  }

  switch(locale: SupportedLocale): void {
    this.locale.set(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  get dir(): 'ltr' | 'rtl' {
    return LOCALE_CONFIG[this.locale()].dir;
  }

  get isRtl(): boolean {
    return this.dir === 'rtl';
  }

  private applyLocale(locale: SupportedLocale): void {
    this.translate.use(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_CONFIG[locale].dir;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  private loadSaved(): SupportedLocale {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale;
    return SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  }
}
