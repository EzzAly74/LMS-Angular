import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, OperatorFunction, Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { ApiParams } from '../../core/services/api.service';
import type { PaginatedResponse } from '../../core/models/api-response.model';

/** What every server-paged list query carries; pages extend it with their own filters. */
export interface PagedQuery {
  readonly search: string;
  readonly page: number;
  readonly perPage: number;
}

export type ListState = 'loading' | 'ready' | 'error';

/** One page of rows and the total across all pages. */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export interface PagedListOptions<Q extends PagedQuery, T> {
  /** The starting query (page 1, the page's default size, no filters). */
  readonly initial: Q;
  /** Fetch one page for a query. Called once per settled query; a newer one cancels it. */
  readonly load: (query: Q) => Observable<PagedResult<T>>;
  /** Search input debounce. Every list uses the same value unless it has a reason not to. */
  readonly searchDebounceMs?: number;
  /** "Show All" loads one page of this size (the API ceiling, B-21). */
  readonly showAllPerPage?: number;
}

/** Search input debounce shared by every list (the Courses List reference). */
export const LIST_SEARCH_DEBOUNCE_MS = 300;
/** "Show All" page size: the API's per_page ceiling (B-21). */
export const LIST_SHOW_ALL_PER_PAGE = 200;

/**
 * The state and loading behaviour of a server-paged list, taken from the
 * Courses List reference so every list behaves the same:
 *
 * - one immutable query signal; every change goes through `patch()`, which
 *   returns to page 1 unless the patch names a page;
 * - search is debounced and de-duplicated, and a search that only adds or
 *   removes surrounding spaces sends nothing;
 * - loading goes through `switchMap`, so a newer query cancels the request of
 *   an older one and a slow response can never overwrite newer rows;
 * - failures land in `state() === 'error'` (the page shows Retry); the rows of
 *   the last good page are kept until the next success;
 * - everything is torn down with the host (created in an injection context).
 *
 * Nothing loads until the page calls `reload()` (usually in ngOnInit, once its
 * inputs are set).
 */
export class PagedList<Q extends PagedQuery, T> {
  private readonly _query: WritableSignal<Q>;
  private readonly _items = signal<readonly T[]>([]);
  private readonly _total = signal(0);
  private readonly _state = signal<ListState>('loading');
  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<Q>();
  private readonly showAllSize: number;

  readonly query: Signal<Q>;
  readonly items: Signal<readonly T[]> = this._items.asReadonly();
  readonly total: Signal<number> = this._total.asReadonly();
  readonly state: Signal<ListState> = this._state.asReadonly();
  /** The pager is worth drawing: loaded, and more than nothing to page through. */
  readonly pageable = computed(() => this._state() === 'ready' && this._total() > 0);
  /** "Show All" makes sense: more rows than one page holds, and not already showing all. */
  readonly canShowAll: Signal<boolean>;

  constructor(options: PagedListOptions<Q, T>) {
    this._query = signal(options.initial);
    this.query = this._query.asReadonly();
    this.showAllSize = options.showAllPerPage ?? LIST_SHOW_ALL_PER_PAGE;
    this.canShowAll = computed(() => this._query().perPage < this.showAllSize && this._total() > this._query().perPage);

    this.search$
      .pipe(
        map(term => term.trim()),
        debounceTime(options.searchDebounceMs ?? LIST_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(search => {
        if (search !== this._query().search) this.patch({ search } as Partial<Q>);
      });

    this.load$
      .pipe(
        switchMap(q => {
          this._state.set('loading');
          return options.load(q).pipe(
            map(res => ({ ok: true as const, res })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(r => {
        if (!r.ok) { this._state.set('error'); return; }
        this._items.set(r.res.items);
        this._total.set(r.res.total);
        this._state.set('ready');
      });
  }

  /** Raw search input, as typed; debounced and trimmed here. */
  search(term: string): void { this.search$.next(term); }

  /** Change the query and load it. Returns to page 1 unless `patch.page` is given. */
  patch(patch: Partial<Q>): void {
    this._query.update(q => ({ ...q, page: 1, ...patch }));
    this.load$.next(this._query());
  }

  goTo(page: number): void { this.patch({ page } as Partial<Q>); }

  showAll(): void { this.patch({ page: 1, perPage: this.showAllSize } as Partial<Q>); }

  /** Load the current query again (first load, Retry, after a save, on a locale switch). */
  reload(): void { this.load$.next(this._query()); }

  /** Replace the rows in place (an optimistic edit) without a round trip. */
  setItems(items: readonly T[]): void { this._items.set(items); }
}

/** Create a PagedList in an injection context (a field initializer or the constructor). */
export function createPagedList<Q extends PagedQuery, T>(options: PagedListOptions<Q, T>): PagedList<Q, T> {
  return new PagedList(options);
}

/** `page`, `per_page` and a non-empty `search` for a paged query. */
export function pagedParams(q: PagedQuery, searchKey = 'search'): ApiParams {
  const p: ApiParams = { page: q.page, per_page: q.perPage };
  if (q.search) p[searchKey] = q.search;
  return p;
}

/** Add a multi-value filter to the params only when something is chosen. */
export function withList(p: ApiParams, key: string, values: readonly (string | number)[]): ApiParams {
  if (values.length) p[key] = [...values];
  return p;
}

/** A Laravel paginator response as a PagedResult, each row mapped once. */
export function toPaged<R, T>(mapRow: (row: R) => T): OperatorFunction<PaginatedResponse<R>, PagedResult<T>> {
  return map(res => ({ items: res.result.data.map(mapRow), total: res.result.total }));
}
