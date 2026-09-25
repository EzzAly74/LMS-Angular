import { Injectable } from '@angular/core';
import { TranslateLoader } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SupportedLocale } from '../constants/locale.constants';

/** The shape of a translation file: nested string maps. */
export interface TranslationTree {
  [key: string]: string | TranslationTree;
}

/**
 * Translations loaded as content-hashed build chunks, not fetched by URL.
 *
 * ── Why this replaces TranslateHttpLoader ───────────────────────────────────
 * The HTTP loader fetched `/assets/i18n/<lang>.json`. `outputHashing: "all"`
 * renames JS and CSS on every build, but files under `assets/` are copied
 * verbatim, so that URL never changed. After any deploy that added or renamed
 * a key, a browser still holding the old cached file rendered the new keys as
 * raw strings against the new code - and only a hard refresh cleared it. That
 * was one of the three causes of "translation corrupts and needs a refresh".
 *
 * A dynamic `import()` makes each language its own build chunk with a content
 * hash in its filename. Change a single string and the filename changes, so a
 * stale copy can never be served against new code, and an unchanged file can
 * be cached indefinitely. No server cache headers or version query strings to
 * keep in sync - the build does it.
 *
 * Each language is still loaded lazily and only when used; neither file joins
 * the initial bundle.
 *
 * ── Why an explicit map rather than a template-literal import ───────────────
 * `import(`./${lang}.json`)` relies on the bundler expanding a glob. Two
 * locales do not justify that indirection, and the explicit form is
 * type-checked: adding a locale to SUPPORTED_LOCALES without adding it here is
 * a compile error, not a runtime 404.
 *
 * Mirrors the Website's loader of the same name. The two apps are on
 * different ngx-translate majors (15 here, 18 there), so the contract differs
 * slightly, but the behaviour is identical.
 */
const LOADERS: Record<SupportedLocale, () => Promise<{ default: TranslationTree }>> = {
  en: () => import('../../../assets/i18n/en.json'),
  ar: () => import('../../../assets/i18n/ar.json'),
};

@Injectable()
export class BundledTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationTree> {
    const load = LOADERS[lang as SupportedLocale];

    if (load === undefined) {
      // An unsupported code must fail loudly. Silently returning {} would
      // render every key raw - the exact symptom this loader exists to end.
      throw new Error(`No bundled translations for locale "${lang}".`);
    }

    return from(load()).pipe(map((module) => module.default));
  }
}
