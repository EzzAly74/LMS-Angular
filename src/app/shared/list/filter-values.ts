import { Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import type {
  NasFilterFieldOption,
  NasFilterSelection,
  NasFilterValues,
} from '../nas/nas-filter-dialog/nas-filter-dialog.component';

/** A filter choice as a list, whatever the field returned (one value, several, or none). */
function asList(v: NasFilterSelection | undefined): readonly (string | number)[] {
  return Array.isArray(v) ? v : v === null || v === undefined ? [] : [v as string | number];
}

/** The numeric ids chosen in a filter field. */
export function filterNumbers(v: NasFilterSelection | undefined): number[] {
  return asList(v).filter((x): x is number => typeof x === 'number');
}

/** The string codes chosen in a filter field, limited to the allowed set when one is given. */
export function filterStrings<S extends string>(v: NasFilterSelection | undefined, allowed?: readonly S[]): S[] {
  const list = asList(v).map(x => String(x));
  return (allowed ? list.filter((s): s is S => (allowed as readonly string[]).includes(s)) : list) as S[];
}

/** The single value of a single-choice field, or null. */
export function filterOne(v: NasFilterSelection | undefined): string | number | null {
  const list = asList(v);
  return list.length ? list[0] : null;
}

/** An applied-values map for nas-filter-dialog: empty choices as null. */
export function appliedValues(entries: Readonly<Record<string, readonly (string | number)[] | string | number | null>>): NasFilterValues {
  const out: Record<string, NasFilterSelection> = {};
  for (const [key, v] of Object.entries(entries)) {
    out[key] = Array.isArray(v) ? (v.length ? v : null) : (v === '' || v === undefined ? null : v as string | number | null);
  }
  return out;
}

/** How many filter fields hold a choice (the Filter button's badge). */
export function activeFilterCount(values: NasFilterValues): number {
  return Object.values(values).filter(v => asList(v).length > 0).length;
}

/** `{id, name}` lookups as filter options. */
export function toFilterOptions(list: readonly { id: number | string; name: string }[] | null | undefined): NasFilterFieldOption[] {
  return (list ?? []).map(o => ({ id: o.id, label: o.name }));
}

/**
 * The options of a filter field that searches the server as the admin types
 * (nas-filter-dialog `remote: true`). Search is debounced and a newer term
 * cancels the older request; a failed search shows nothing. Chosen options
 * keep their labels even when a later search does not return them, so the
 * field never shows a bare id. Create it in an injection context.
 */
export class RemoteFilterOptions {
  private readonly term$ = new Subject<string>();
  private readonly matches = signal<NasFilterFieldOption[]>([]);
  private readonly chosen = signal<NasFilterFieldOption[]>([]);

  /** The chosen options first, then the current matches. */
  readonly options: Signal<NasFilterFieldOption[]> = computed(() => {
    const chosen = this.chosen();
    return [...chosen, ...this.matches().filter(m => !chosen.some(c => c.id === m.id))];
  });

  constructor(search: (term: string) => Observable<NasFilterFieldOption[]>, debounceMs = 250) {
    this.term$
      .pipe(
        debounceTime(debounceMs),
        distinctUntilChanged(),
        switchMap(term => search(term).pipe(catchError(() => of<NasFilterFieldOption[]>([])))),
        takeUntilDestroyed(),
      )
      .subscribe(options => this.matches.set(options));
  }

  search(term: string): void { this.term$.next(term.trim()); }

  /** Keep the labels of the ids now applied (call when the filter is applied). */
  remember(ids: readonly (string | number)[]): void {
    const known = new Map([...this.chosen(), ...this.matches()].map(o => [o.id, o]));
    this.chosen.set(ids.map(id => known.get(id)).filter((o): o is NasFilterFieldOption => !!o));
  }
}
