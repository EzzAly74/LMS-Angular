import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';

/**
 * A list's empty, no-results or error message (reference: All Courses). Use
 * it in a full-width table cell (`<tr><td [attr.colspan]="n">`) or on its own
 * under a card grid. An error is announced (role="alert") and offers Retry.
 */
@Component({
  selector: 'nas-list-state',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind() === 'error') {
      <div class="nls" role="alert">
        <p>{{ message() }}</p>
        <button type="button" class="nls__retry" (click)="retry.emit()">{{ 'common.retry' | translate }}</button>
      </div>
    } @else {
      <p class="nls">{{ message() }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .nls {
      margin: 0;
      padding: var(--nas-space-10, 40px) var(--nas-space-6);
      text-align: center;
      color: var(--nas-color-text-muted);
    }
    .nls p { margin: 0 0 var(--nas-space-3); }
    .nls__retry {
      display: inline-flex;
      align-items: center;
      block-size: 36px;
      padding: 0 var(--nas-space-4);
      border: 1px solid var(--nas-teal-1000);
      border-radius: var(--nas-radius-md);
      background: var(--nas-color-bg-surface);
      color: var(--nas-teal-1000);
      font: inherit;
      font-size: var(--nas-size-xs);
      font-weight: var(--nas-weight-medium);
      cursor: pointer;
    }
    .nls__retry:hover { background: var(--nas-neutral-200); }
    .nls__retry:focus-visible { outline: 2px solid var(--nas-teal-1000); outline-offset: 2px; }
  `,
})
export class NasListStateComponent {
  readonly kind = input<'empty' | 'error'>('empty');
  /** The message, already translated. */
  readonly message = input.required<string>();
  readonly retry = output<void>();
}

/**
 * One placeholder row while a table loads: `<tr nasSkeletonRow [columns]="9">`.
 * The first cell has a title line and a shorter second line (the list's
 * primary column); `actions` leaves the last cell empty for the row menu.
 */
@Component({
  selector: 'tr[nasSkeletonRow]',
  standalone: true,
  imports: [SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <td><p-skeleton height="16px" width="70%" /><p-skeleton height="12px" width="40%" styleClass="nsr-gap" /></td>
    @for (c of cells(); track c) { <td><p-skeleton height="14px" /></td> }
    @if (actions()) { <td></td> }
  `,
  styles: `:host ::ng-deep .nsr-gap { margin-block-start: 6px; }`,
})
export class NasSkeletonRowComponent {
  /** Total number of columns, the first and any actions column included. */
  readonly columns = input.required<number>();
  /** The last column holds row actions: left empty. */
  readonly actions = input(false);

  protected readonly cells = computed<readonly number[]>(() => {
    const n = Math.max(0, this.columns() - 1 - (this.actions() ? 1 : 0));
    return (SKELETON_CELLS[n] ??= Array.from({ length: n }, (_, i) => i));
  });
}

/** Placeholder cell lists by count, built once and shared by every row. */
const SKELETON_CELLS: (readonly number[] | undefined)[] = [];

/** Six placeholder rows, the reference's loading height. */
export const SKELETON_ROWS: readonly number[] = [0, 1, 2, 3, 4, 5];
