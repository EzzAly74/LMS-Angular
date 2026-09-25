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

  /**
   * The bootstrap translation load, kept so startup can wait for it.
   *
   * It must be THIS observable and not a fresh `translate.use()` call.
   * ngx-translate v15's `use()` short-circuits on its first line with
   * `if (lang === this.currentLang) return of(this.translations[lang])` - and
   * it sets `currentLang` immediately on the first call, before the file has
   * loaded. A second `use()` for the same locale therefore resolves at once
   * with `undefined`, and anything awaiting it waits for nothing. The first
   * call's observable is `shareReplay(1)`, so awaiting it later is safe even
   * after it has completed.
   */
  private readonly bootLoad$: Observable<unknown>;

  constructor(private translate: TranslateService) {
    translate.addLangs([...SUPPORTED_LOCALES]);
    translate.setDefaultLang(DEFAULT_LOCALE);
    // Apply the saved/default locale once at bootstrap so the
    // <html lang/dir> attributes and ngx-translate are in sync from
    // first paint — but do NOT emit `changes$` here (it would fire
    // before any subscriber is attached, and is semantically a
    // "user changed language" signal, not "app booted").
    this.bootLoad$ = this.applyLocale(this.locale());
  }

  /**
   * Resolves once the active locale's translations are loaded.
   *
   * Awaited by the APP_INITIALIZER so nothing renders - and no
   * `translate.instant()` runs - before the strings exist. Without that wait,
   * `instant()` returns the raw key, and any component that stored the result
   * in a field or signal kept the raw key until the page was refreshed. That
   * was the Dashboard's half of "translation corrupts and needs a refresh";
   * `switch()` below already guarded against the same race, bootstrap never
   * did.
   */
  ready(): Observable<unknown> {
    return this.bootLoad$;
  }

  switch(locale: SupportedLocale): void {
    if (this.locale() === locale) return;
    this.locale.set(locale);
    this.setDocumentLocale(locale);
    /**
     * `translate.use()` is asynchronous — it resolves once the target
     * language file is loaded (and cached). We must emit `changes$`
     * *after* it completes, otherwise subscribers that read labels via
     * `translate.instant(...)` (e.g. data-table column headers) get the
     * previous language's strings on the first switch to a not-yet-cached
     * locale — the "English page still shows Arabic headers" bug.
     */
    this.translate.use(locale).subscribe(() => this._changes$.next(locale));
  }

  get dir(): 'ltr' | 'rtl' {
    return LOCALE_CONFIG[this.locale()].dir;
  }

  get isRtl(): boolean {
    return this.dir === 'rtl';
  }

  private applyLocale(locale: SupportedLocale): Observable<unknown> {
    const load = this.translate.use(locale);
    this.setDocumentLocale(locale);
    return load;
  }

  /** Syncs `<html lang/dir>` and persists the choice (no translation load). */
  private setDocumentLocale(locale: SupportedLocale): void {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_CONFIG[locale].dir;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  private loadSaved(): SupportedLocale {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale;
    return SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  }
}
