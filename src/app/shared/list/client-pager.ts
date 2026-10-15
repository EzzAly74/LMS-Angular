import { Signal, computed, signal } from '@angular/core';

/**
 * One page of a list the page already holds in full, for the shared
 * `nas-pager`. Only for lists that are loaded whole for another reason (a
 * course's cohorts feed the header and the other tabs' filters; its content
 * is numbered and timed as a whole; a cohort's attendance comes as one
 * summary). A list the server can page uses `createPagedList` instead.
 *
 * The page is clamped to the last one, so a list that shrinks (a search, a
 * filter, a delete) never shows an empty page. Hosts call `reset()` when the
 * search, a filter or the sort changes.
 */
export class ClientPager<T> {
  private readonly requested = signal(1);

  readonly total = computed(() => this.rows().length);
  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  /** The page shown: the one asked for, within the list. */
  readonly page = computed(() => Math.min(this.requested(), this.lastPage()));
  readonly items = computed<readonly T[]>(() => {
    const start = (this.page() - 1) * this.perPage;
    return this.rows().slice(start, start + this.perPage);
  });
  /** Worth drawing the pager: there is something to page through. */
  readonly pageable = computed(() => this.total() > 0);

  constructor(private readonly rows: Signal<readonly T[]>, readonly perPage: number) {}

  goTo(page: number): void { this.requested.set(Math.max(1, page)); }

  reset(): void { this.requested.set(1); }
}
