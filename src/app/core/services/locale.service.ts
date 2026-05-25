import { Injectable, signal } from '@angular/core';
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
   *
   * NOTE: We emit imperatively from `switch()` rather than from an
   * `effect()` that tracks the `locale` signal. The previous
   * effect-based version had a subtle scheduling issue: depending on
   * when the service was first instantiated relative to the toggle
   * click, the captured `previous` closure value could miss the
   * transition entirely and the subject never fired — which is why
   * "no network requests after language switch" was happening on
   * some sessions. Imperative emit makes it deterministic.
   */
  private readonly _changes$ = new Subject<SupportedLocale>();
  readonly changes$: Observable<SupportedLocale> = this._changes$.asObservable();

  constructor(private translate: TranslateService) {
    translate.addLangs([...SUPPORTED_LOCALES]);
    translate.setDefaultLang(DEFAULT_LOCALE);
    // Apply the saved/default locale once at bootstrap so the
    // <html lang/dir> attributes and ngx-translate are in sync from
    // first paint — but do NOT emit `changes$` here (it would fire
    // before any subscriber is attached, and is semantically a
    // "user changed language" signal, not "app booted").
    this.applyLocale(this.locale());
  }

  switch(locale: SupportedLocale): void {
    if (this.locale() === locale) return;
    this.locale.set(locale);
    this.applyLocale(locale);
    this._changes$.next(locale);
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
