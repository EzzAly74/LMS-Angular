import {
  ChangeDetectionStrategy,
  Component,
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
import { PrimeTemplate } from 'primeng/api';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

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
  readonly options: NasFilterFieldOption[];
}

export type NasFilterValues = Readonly<Record<string, NasFilterValue | null>>;

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
  imports: [FormsModule, TranslateModule, DialogModule, DropdownModule, PrimeTemplate, NasIconComponent],
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

  private readonly document = inject(DOCUMENT);
  private opener: HTMLElement | null = null;

  protected readonly uid     = `nas-fd-${nextId++}`;
  protected readonly working = signal<Record<string, NasFilterValue | null>>({});

  protected readonly changed = computed(() => {
    const w = this.working();
    const a = this.applied();
    return this.fields().some(f => (w[f.key] ?? null) !== (a[f.key] ?? null));
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
  }

  protected value(key: string): NasFilterValue | null {
    return this.working()[key] ?? null;
  }

  protected set(key: string, value: NasFilterValue | null): void {
    this.working.update(w => ({ ...w, [key]: value ?? null }));
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

  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }

  /** Every field key present, unset ones as null, so callers read one shape. */
  private normalized(values: Record<string, NasFilterValue | null>): NasFilterValues {
    const out: Record<string, NasFilterValue | null> = {};
    for (const f of this.fields()) out[f.key] = values[f.key] ?? null;
    return out;
  }
}
