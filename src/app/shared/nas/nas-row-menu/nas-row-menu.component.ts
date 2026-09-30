import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { NasIconComponent } from '../nas-icon/nas-icon.component';

/** One entry of a row's actions menu. */
export interface NasRowAction<Id extends string = string> {
  readonly id: Id;
  /** Already translated. */
  readonly label: string;
  /** A nas-icon name ("eye", "trash"), or an asset path for a Figma icon ("assets/icons/figma/..."). */
  readonly icon: string;
  /** Drawn in red (delete, deactivate). */
  readonly danger?: boolean;
}

export interface NasRowActionPick<T, Id extends string = string> {
  readonly id: Id;
  readonly row: T;
}

/**
 * A table's row actions menu (reference: All Courses, Figma "Button - Course
 * actions"). ONE overlay per table, not one per row: each row's "..." button
 * calls `menu.open($event, row)`, the menu asks `actions(row)` for that row's
 * entries (so rows can differ, e.g. Deactivate vs Reactivate) and emits the
 * pick with its row. Style the row button with the shared `.cl-more` class.
 */
@Component({
  selector: 'nas-row-menu',
  standalone: true,
  imports: [OverlayPanelModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-overlayPanel #panel>
      @if (current(); as c) {
        <div class="nrm" role="menu">
          @for (a of c.actions; track a.id) {
            <button type="button" role="menuitem" class="nrm__item" [class.nrm__item--danger]="a.danger" (click)="pick(a.id, c.row)">
              @if (a.icon.startsWith('assets/')) {
                <img [src]="a.icon" width="16" height="16" alt="" />
              } @else {
                <nas-icon [name]="a.icon" [size]="16" />
              }
              {{ a.label }}
            </button>
          }
        </div>
      }
    </p-overlayPanel>
  `,
  styles: `
    .nrm { display: flex; flex-direction: column; min-inline-size: 180px; }
    .nrm__item {
      display: flex;
      align-items: center;
      gap: var(--nas-space-3);
      padding: var(--nas-space-3) var(--nas-space-4);
      border: 0;
      border-radius: var(--nas-radius-sm);
      background: transparent;
      font: inherit;
      font-size: var(--nas-size-2xs);
      color: var(--nas-color-text-body);
      text-align: start;
      cursor: pointer;
    }
    .nrm__item img { display: block; flex-shrink: 0; }
    .nrm__item:hover { background: var(--nas-neutral-200); }
    .nrm__item:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: -2px; }
    .nrm__item--danger { color: var(--nas-status-red-700); }
  `,
})
export class NasRowMenuComponent<T, Id extends string = string> {
  /** The entries for a row. Called only when that row's menu opens. */
  readonly actions = input.required<(row: T) => readonly NasRowAction<Id>[]>();
  readonly picked = output<NasRowActionPick<T, Id>>();

  private readonly panel = viewChild.required<OverlayPanel>('panel');
  protected readonly current = signal<{ row: T; actions: readonly NasRowAction<Id>[] } | null>(null);

  /** Open (or close, when it is this row's menu already open) under the clicked button. */
  open(event: Event, row: T): void {
    event.stopPropagation();
    this.current.set({ row, actions: this.actions()(row) });
    this.panel().toggle(event);
  }

  close(): void { this.panel().hide(); }

  protected pick(id: Id, row: T): void {
    this.panel().hide();
    this.picked.emit({ id, row });
  }
}
