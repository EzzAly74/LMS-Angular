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
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

export interface NasFilterOption {
  readonly id: number | string;
  readonly label: string;
}

let nextId = 0;

/**
 * "Filter your results" - Figma 1986:75113.
 *
 * One section (label + quick search + checkbox list) and Clear / Filter.
 * Used for every multi-select filter chip on the Learners list (instructors,
 * learner type, courses, qualifications), which is why it is a shared
 * primitive rather than four copies.
 *
 * Selection is edited on a working copy: closing without "Filter" leaves the
 * applied filter untouched. "Clear" empties it and applies at once.
 * Checkboxes are native inputs with labels, so they are announced and
 * keyboard-operable without ARIA. PrimeNG traps focus inside the dialog but
 * does not restore it, so the picker returns focus to whatever opened it.
 *
 * `closable` must stay true: PrimeNG ignores closeOnEscape on a dialog that is
 * not closable. The headless template draws its own header, so it adds no icon.
 */
@Component({
  selector: 'nas-filter-picker',
  standalone: true,
  imports: [TranslateModule, DialogModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nas-filter-picker.component.html',
  styleUrl: './nas-filter-picker.component.scss',
})
export class NasFilterPickerComponent {
  readonly visible   = model(false);
  /** Section label, already translated (e.g. "Instructors"). */
  readonly label     = input.required<string>();
  readonly options   = input<readonly NasFilterOption[]>([]);
  /** The filter currently applied. */
  readonly selected  = input<readonly (number | string)[]>([]);
  readonly loading   = input(false);
  /** Dialog title, already translated; defaults to "Filter your results". */
  readonly title     = input<string | null>(null);
  /** A short fixed list (Quiz Type, Figma 1981:41345) has no search box or section label. */
  readonly searchable = input(true);
  /**
   * `view`: Cancel + "View results", disabled until something is ticked
   * (Figma 1981:41345). `filter`: Clear + Filter (1986:75113).
   */
  readonly mode      = input<'filter' | 'view'>('filter');
  readonly apply     = output<(number | string)[]>();
  /** The quick-search text, for a parent whose options come from a server search. */
  readonly searchChange = output<string>();

  private readonly document = inject(DOCUMENT);
  /** The element focused when the dialog opened, refocused when it closes. */
  private opener: HTMLElement | null = null;

  protected readonly uid     = `nas-fp-${nextId++}`;
  protected readonly search  = signal('');
  protected readonly working = signal<ReadonlySet<number | string>>(new Set());

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase();
    const all = this.options();
    return q ? all.filter(o => o.label.toLocaleLowerCase().includes(q)) : all;
  });

  constructor() {
    // Each time the dialog opens, start from what is applied.
    effect(() => {
      if (this.visible()) {
        const applied = untracked(() => this.selected());
        untracked(() => {
          this.working.set(new Set(applied));
          this.search.set('');
          const active = this.document.activeElement;
          this.opener = active instanceof HTMLElement ? active : null;
        });
      }
    }, { allowSignalWrites: true });
  }

  protected onSearch(term: string): void {
    this.search.set(term);
    this.searchChange.emit(term);
  }

  protected isChecked(id: number | string): boolean {
    return this.working().has(id);
  }

  protected toggle(id: number | string): void {
    const next = new Set(this.working());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.working.set(next);
  }

  protected submit(): void {
    // Keep the options' order, not the order they were ticked in.
    const chosen = this.options().map(o => o.id).filter(id => this.working().has(id));
    this.apply.emit(chosen);
    this.visible.set(false);
  }

  protected clear(): void {
    this.working.set(new Set());
    this.apply.emit([]);
    this.visible.set(false);
  }

  protected close(): void {
    this.visible.set(false);
  }

  /** p-dialog (onHide): runs after the close animation, however it closed. */
  protected restoreFocus(): void {
    this.opener?.focus();
    this.opener = null;
  }
}
