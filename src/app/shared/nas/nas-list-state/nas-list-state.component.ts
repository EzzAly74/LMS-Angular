import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

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
 * The shape a placeholder cell takes, so the loading table looks like the
 * table that is coming:
 * - `title`: a bold line and a shorter caption (the primary column);
 * - `person`: an avatar circle and a name line;
 * - `text` / `short`: a line of text / a short value (a date, an id);
 * - `num`: a small centred number;
 * - `bar`: a progress bar and its percentage;
 * - `pill`: a status badge;
 * - `action`: the row's "..." or eye button.
 */
export type NasSkeletonCell = 'title' | 'person' | 'text' | 'short' | 'num' | 'bar' | 'pill' | 'action';

/** Widths (%) the text-like shapes cycle through, so rows do not look stamped out. */
const TEXT_WIDTHS = [72, 58, 84, 64, 76, 52] as const;
const TITLE_WIDTHS = [78, 64, 88, 70, 82, 60] as const;
const CAPTION_WIDTHS = [44, 36, 52, 40, 48, 32] as const;

interface CellView {
  readonly kind: NasSkeletonCell;
  readonly w: number;
  readonly w2: number;
}

/**
 * One placeholder row while a table loads:
 * `<tr nasSkeletonRow [cells]="['title', 'text', 'num', 'bar', 'pill', 'action']" [row]="i">`.
 *
 * The cells are this component's own (not the page's), so it draws them to
 * the shared table metrics itself: 57 px rows, 20 px sides, the row divider.
 * A soft shimmer sweeps across, a little later on each row; it stops for
 * prefers-reduced-motion. Hidden from assistive tech: the table card says
 * aria-busy while it loads.
 */
@Component({
  selector: 'tr[nasSkeletonRow]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'nsr', '[style.--nsr-delay]': 'delay()', '[style.opacity]': 'fade()' },
  template: `
    @for (c of view(); track $index) {
      <td class="nsr__cell" [class.nsr__cell--center]="c.kind === 'num'" [class.nsr__cell--end]="c.kind === 'action'">
        @switch (c.kind) {
          @case ('title') {
            <span class="nsr__stack">
              <span class="nsr__b nsr__b--title" [style.inline-size.%]="c.w"></span>
              <span class="nsr__b nsr__b--caption" [style.inline-size.%]="c.w2"></span>
            </span>
          }
          @case ('person') {
            <span class="nsr__person">
              <span class="nsr__b nsr__b--avatar"></span>
              <span class="nsr__b nsr__b--line" [style.inline-size.%]="c.w"></span>
            </span>
          }
          @case ('num') { <span class="nsr__b nsr__b--num"></span> }
          @case ('bar') {
            <span class="nsr__bar">
              <span class="nsr__b nsr__b--track"></span>
              <span class="nsr__b nsr__b--pct"></span>
            </span>
          }
          @case ('pill') { <span class="nsr__b nsr__b--pill" [style.inline-size.px]="c.w2 + 20"></span> }
          @case ('action') { <span class="nsr__b nsr__b--action"></span> }
          @default { <span class="nsr__b nsr__b--line" [style.inline-size.%]="c.kind === 'short' ? c.w2 + 12 : c.w"></span> }
        }
      </td>
    }
  `,
  styleUrl: './nas-skeleton-row.component.scss',
})
export class NasSkeletonRowComponent {
  /** One shape per column. */
  readonly cells = input.required<readonly NasSkeletonCell[]>();
  /** The row's position, so widths and the shimmer vary from row to row. */
  readonly row = input(0);

  protected readonly delay = computed(() => `${this.row() * 90}ms`);
  /** Rows fade out towards the bottom, so the placeholder reads as a preview, not a wall. */
  protected readonly fade = computed(() => Math.max(0.5, 1 - this.row() * 0.1));

  protected readonly view = computed<CellView[]>(() => {
    const r = this.row();
    return this.cells().map((kind, i) => {
      const k = (r + i * 2) % TEXT_WIDTHS.length;
      return {
        kind,
        w: kind === 'title' ? TITLE_WIDTHS[k] : TEXT_WIDTHS[k],
        w2: CAPTION_WIDTHS[k],
      };
    });
  });
}

/** Six placeholder rows, the reference's loading height. */
export const SKELETON_ROWS: readonly number[] = [0, 1, 2, 3, 4, 5];

/**
 * One placeholder block for card grids and panels (Job Titles cards, Blogs,
 * Roles): the table placeholder's soft block and shimmer, sized by the page.
 * Decorative; the region that loads says aria-busy.
 */
@Component({
  selector: 'nas-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'nsk',
    '[style.inline-size]': 'width()',
    '[style.block-size]': 'height()',
    '[style.border-radius]': 'radius()',
  },
  template: '',
  styleUrl: './nas-skeleton.component.scss',
})
export class NasSkeletonComponent {
  readonly width = input('100%');
  readonly height = input('12px');
  readonly radius = input('999px');
}
