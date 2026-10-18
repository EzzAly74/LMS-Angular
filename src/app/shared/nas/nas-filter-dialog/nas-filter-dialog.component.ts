import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { PrimeTemplate } from 'primeng/api';
import { NasIconComponent } from '../nas-icon/nas-icon.component';
import { NasDatepickerComponent } from '../nas-datepicker/nas-datepicker.component';

export type NasFilterValue = number | string;

export interface NasFilterFieldOption {
  readonly id: NasFilterValue;
  readonly label: string;
}

export interface NasFilterField {
  /** Key in the applied / emitted value map. */
  readonly key: string;
  /** Label above the dropdown, already translated. */
  readonly label: string;
  /** Placeholder, already translated. */
  readonly placeholder: string;
  /** Choices of a select field; empty for a date field. */
  readonly options: NasFilterFieldOption[];
  /**
   * `date`: a calendar date instead of a list (e.g. "Active from"); its value
   * is a local `YYYY-MM-DD` string. Default: a dropdown / multi-select.
   */
  readonly type?: 'select' | 'date';
  /** Date field: may not be before this other date field (From of a From / To pair). */
  readonly after?: string;
  /** Date field: may not be after this other date field (To of a From / To pair). */
  readonly before?: string;
  /** Several choices (Figma annotation on the Job Titles Qualification field: "multi select + search"). */
  readonly multiple?: boolean;
  /**
   * Options come from a server search: the dialog emits `search` as the admin
   * types and the host replaces `options` (it must keep the chosen option in
   * the list so its label still shows).
   */
  readonly remote?: boolean;
  /** Spans both columns (Figma 2430:135164, Status). */
  readonly wide?: boolean;
  /** Placeholder of a multi-select's search box, already translated ("Search courses..."). */
  readonly searchPlaceholder?: string;
}

/** One field's choice: a value, several (multiple fields), or nothing. */
export type NasFilterSelection = NasFilterValue | readonly NasFilterValue[] | null;

export type NasFilterValues = Readonly<Record<string, NasFilterSelection>>;

let nextId = 0;

/**
 * "Filter" modal of the 2026 list pages - a grid of single-choice dropdowns,
 * Clear and Filter (Figma 2463:138054, Job Titles; the same Filter button on
 * the Course Details tabs, 2266:128868).
 *
 * The choice is edited on a working copy: closing without "Filter" leaves the
 * applied filter untouched. "Filter" is enabled only when the working copy
 * differs from what is applied (drawn disabled). "Clear" empties every field
 * and applies at once. Dropdowns are labelled through `ariaLabelledBy` (a
 * `label for` does not name PrimeNG's combobox); long lists get a search box.
 * PrimeNG traps focus in the dialog but does not restore it, so the dialog
 * returns focus to whatever opened it.
 */
@Component({
  selector: 'nas-filter-dialog',
  standalone: true,
  imports: [FormsModule, TranslateModule, DialogModule, DropdownModule, MultiSelectModule, PrimeTemplate, NasIconComponent, NasDatepickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-filter-dialog.component.html',
  styleUrl: './nas-filter-dialog.component.scss',
})
export class NasFilterDialogComponent {
  readonly visible = model(false);
  readonly fields  = input.required<readonly NasFilterField[]>();
  /** The filter currently applied, keyed by field key. */
  readonly applied = input<NasFilterValues>({});
  readonly apply   = output<NasFilterValues>();
  /** A remote field's search term, as typed. */
  readonly search  = output<{ key: string; term: string }>();

  private readonly document = inject(DOCUMENT);
  private opener: HTMLElement | null = null;
  private escapeForOverlay = false;

  protected readonly uid     = `nas-fd-${nextId++}`;
  protected readonly working = signal<Record<string, NasFilterSelection>>({});
  /** A dropdown list is open over the dialog. */
  protected readonly overlayOpen = signal(false);

  protected readonly changed = computed(() => {
    const w = this.working();
    const a = this.applied();
    return this.fields().some(f => !same(w[f.key] ?? null, a[f.key] ?? null));
  });

  constructor() {
    // Each time the dialog opens, start from what is applied.
    effect(() => {
      if (!this.visible()) return;
      const applied = untracked(() => this.applied());
      const active = this.document.activeElement;
      this.opener ??= active instanceof HTMLElement ? active : null;
      this.working.set({ ...applied });
    }, { allowSignalWrites: true });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || !this.visible() || !this.overlayOpen()) return;
      // Only for this keystroke: cleared once the event has finished, so a
      // later close (X, Cancel, a second Escape) is never refused.
      this.escapeForOverlay = true;
      setTimeout(() => (this.escapeForOverlay = false));
    };
    this.document.addEventListener('keydown', onKey, true);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('keydown', onKey, true));
  }

  protected value(key: string): NasFilterSelection {
    return this.working()[key] ?? null;
  }

  /** How many choices a multi-select holds. */
  protected count(key: string): number {
    const v = this.working()[key];
    return Array.isArray(v) ? v.length : v === null || v === undefined ? 0 : 1;
  }

  protected set(key: string, value: NasFilterSelection): void {
    // An emptied multi-select is "no filter", the same as never choosing.
    const v = Array.isArray(value) && value.length === 0 ? null : value;
    this.working.update(w => ({ ...w, [key]: v ?? null }));
  }

  /** A date field's value as a Date (local midnight), or null. */
  protected dateValue(key: string | undefined): Date | null {
    if (!key) return null;
    const v = this.working()[key];
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  /** Store a picked date as a local `YYYY-MM-DD` (not toISOString, which shifts by the UTC offset). */
  protected setDate(key: string, d: Date | null): void {
    if (!d) { this.set(key, null); return; }
    const pad = (n: number) => String(n).padStart(2, '0');
    this.set(key, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }

  protected onRemoteFilter(key: string, term: string | null | undefined): void {
    this.search.emit({ key, term: (term ?? '').trim() });
  }

  protected submit(): void {
    if (!this.changed()) return;
    this.apply.emit(this.normalized(this.working()));
    this.visible.set(false);
  }

  protected clear(): void {
    this.apply.emit(this.normalized({}));
    this.visible.set(false);
  }

  /**
   * Escape closes an open dropdown list and nothing more. The list lives in
   * <body>, so its Escape reached PrimeNG's document listener, which closed
   * the whole modal and threw the unsaved choices away. The capture listener
   * notes that a list was open when Escape went down; that close is refused.
   */
  protected onVisibleChange(open: boolean): void {
    if (!open && this.escapeForOverlay) {
      this.escapeForOverlay = false;
      return;
    }
    this.visible.set(open);
  }

  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  /** Every field key present, unset ones as null, so callers read one shape. */
  private normalized(values: Record<string, NasFilterSelection>): NasFilterValues {
    const out: Record<string, NasFilterSelection> = {};
    for (const f of this.fields()) out[f.key] = values[f.key] ?? null;
    return out;
  }
}

/** Equal choices; the order of a multi-select does not matter. */
function same(a: NasFilterSelection, b: NasFilterSelection): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : a === null ? [] : [a];
    const y = Array.isArray(b) ? b : b === null ? [] : [b];
    return x.length === y.length && x.every(v => y.includes(v));
  }
  return a === b;
}
