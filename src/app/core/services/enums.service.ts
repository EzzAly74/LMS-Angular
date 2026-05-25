import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import { LocaleService } from './locale.service';
import { enumUrl } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';

/**
 * Canonical names of every backend enum. Keep in sync with
 * `App\Enums\EnumRegistry` on the Laravel side.
 *
 * The Angular templates pass these strings to `EnumsService.options(name)`,
 * so widening this union to add a new enum is a single-line change.
 */
export type EnumName =
  | 'course_type'
  | 'course_status'
  | 'course_level'
  | 'cohort_status'
  | 'module_content_type'
  | 'module_learner_scope'
  | 'resource_type'
  | 'certificate_basis'
  | 'locale'
  | 'cohort_scope'
  | 'question_type'
  | 'dashboard_range'
  | 'role_color'
  | 'role_guard'
  | 'inbox_tab'
  | 'user_status'
  | 'learner_type'
  | 'lifecycle_status'
  | 'enrollment_status';

/**
 * One option as served by `GET /api/v1/enums/{name}`.
 *
 *   - `id`    stable 1-indexed numeric identifier — what the frontend POSTs
 *             back to the API. Bind `optionValue="id"` on `p-dropdown`.
 *   - `value` localized display label for the active `Accept-Language`.
 *             Bind `optionLabel="value"`.
 *   - `code`  underlying string machine code (e.g. "hybrid"). Useful when
 *             you still need the legacy string — the backend's
 *             `AcceptsEnumIds` trait accepts both `id` and `code` so the
 *             frontend can keep submitting the numeric id.
 *   - `description?` optional localized helper text (only on enums that
 *                    opt in on the backend, e.g. `certificate_basis`).
 */
export interface EnumOption {
  id: number;
  value: string;
  code: string;
  description?: string;
}

type EnumMap = Record<EnumName, EnumOption[]>;

/**
 * Locale-aware dropdown enum cache.
 *
 * The frontend NEVER hardcodes dropdown options anymore — every `p-dropdown`,
 * radio list, or filter tab pulls its options from this service. The service
 * caches per-enum responses for the lifetime of the active locale, and clears
 * the cache automatically whenever the user switches language so the next
 * render fetches fresh (re-translated) labels.
 *
 * Typical usage in a component:
 *
 *   private readonly enums = inject(EnumsService);
 *   readonly typeOpts = this.enums.options('course_type');
 *
 *   // In the template:
 *   <p-dropdown [options]="typeOpts()"
 *               optionLabel="value"
 *               optionValue="id"
 *               formControlName="type" />
 *
 * `optionValue="id"` is what makes the form control receive the machine code
 * (`"hybrid"`) instead of the localized label (`"Hybrid"`/`"مدمج"`), which is
 * what every backend validator expects.
 */
@Injectable({ providedIn: 'root' })
export class EnumsService {
  private readonly api    = inject(ApiService);
  private readonly locale = inject(LocaleService);

  /**
   * Cache keyed by enum name. Each entry holds a signal that the templates
   * subscribe to directly. When the locale changes we wipe the cache so the
   * next `options(...)` call triggers a fresh HTTP fetch.
   */
  private readonly cache = new Map<EnumName, ReturnType<typeof signal<EnumOption[]>>>();

  /** In-flight requests deduplicated so concurrent reads share one HTTP call. */
  private readonly inFlight = new Map<EnumName, Observable<EnumOption[]>>();

  constructor() {
    // Whenever the user toggles EN ↔ AR, drop the cache so labels refresh.
    this.locale.changes$.subscribe(() => this.clear());
  }

  /**
   * Returns a reactive signal of the option list for `name`. The signal
   * starts empty and is populated lazily on the first request — components
   * can iterate it with `@for` and Angular will re-render once the fetch
   * resolves. Subsequent reads are served from cache.
   */
  options(name: EnumName): Signal<EnumOption[]> {
    let entry = this.cache.get(name);
    if (!entry) {
      entry = signal<EnumOption[]>([]);
      this.cache.set(name, entry);
      this.fetch(name).subscribe(opts => entry!.set(opts));
    }
    return entry.asReadonly();
  }

  /**
   * One-shot fetch used by bootstrap code paths that prefer to await all
   * options before rendering (e.g. forms that need to map an existing id
   * to its localized label on the very first paint).
   */
  fetchOnce(name: EnumName): Observable<EnumOption[]> {
    return this.fetch(name);
  }

  /**
   * Bulk-prime the cache with one API call. Convenient at app boot — every
   * subsequent `options(...)` call across the app then resolves synchronously
   * from cache. Safe to call multiple times; later calls are no-ops once the
   * cache is warm.
   */
  primeAll(): Observable<EnumMap> {
    return this.api.get<EnumMap>(enumUrl.all()).pipe(
      map(res => res.result ?? ({} as EnumMap)),
      tap(map => {
        (Object.entries(map) as Array<[EnumName, EnumOption[]]>).forEach(([name, opts]) => {
          let entry = this.cache.get(name);
          if (!entry) {
            entry = signal<EnumOption[]>([]);
            this.cache.set(name, entry);
          }
          entry.set(opts);
        });
      }),
    );
  }

  /** Useful in templates: `enums.label('course_type', 3)()` returns localized text. */
  label(name: EnumName, id: number | null | undefined): Signal<string> {
    const sig = this.options(name);
    return computed(() => {
      if (id === null || id === undefined) return '';
      return sig().find(o => o.id === id)?.value ?? '';
    });
  }

  /**
   * Translate a numeric dropdown id back to the underlying string code.
   * Returns `null` when the option list hasn't loaded yet or the id is unknown.
   */
  codeForId(name: EnumName, id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this.options(name)().find(o => o.id === id)?.code ?? null;
  }

  /**
   * Reverse mapping — translate a backend string code into the numeric id
   * used by the dropdown. Lets forms patch existing rows (whose API payload
   * still carries the string code) into a numeric-id-bound dropdown.
   */
  idForCode(name: EnumName, code: string | null | undefined): number | null {
    if (!code) return null;
    return this.options(name)().find(o => o.code === code)?.id ?? null;
  }

  /** Wipe the entire cache. Called automatically on locale change. */
  clear(): void {
    this.cache.forEach(sig => sig.set([]));
    this.inFlight.clear();
    // Refetch any enums the UI is currently subscribed to so new labels
    // appear without a page reload.
    Array.from(this.cache.keys()).forEach(name => {
      this.fetch(name).subscribe(opts => this.cache.get(name)?.set(opts));
    });
  }

  // ── private ────────────────────────────────────────────────────────────

  private fetch(name: EnumName): Observable<EnumOption[]> {
    const existing = this.inFlight.get(name);
    if (existing) return existing;

    const req$ = this.api
      .get<EnumOption[]>(enumUrl.byName(name))
      .pipe(
        map((res: ApiResponse<EnumOption[]>) => (Array.isArray(res.result) ? res.result : [])),
        tap({
          complete: () => this.inFlight.delete(name),
          error:    () => this.inFlight.delete(name),
        }),
        shareReplay(1),
      );

    this.inFlight.set(name, req$);
    return req$;
  }
}

/**
 * Fallback empty-list signal — used by components that need a stable
 * reference while migrating from hardcoded arrays.
 */
export const EMPTY_OPTIONS: EnumOption[] = [];
export const emptyOptions$ = of(EMPTY_OPTIONS);
