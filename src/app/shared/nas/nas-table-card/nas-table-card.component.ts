import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The card a Dashboard table sits in (reference: All Courses, Figma
 * 2556:151361): 16 px radius, the table scrolling sideways inside it on
 * narrow screens (focusable, so the keyboard can scroll it too), and the pager
 * row under it. The page projects its own `<table class="cl-table">` (so its
 * columns and cells stay page-specific) and, optionally, a `[nasTablePager]`.
 */
@Component({
  selector: 'nas-table-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ntc" [attr.aria-busy]="busy()" [attr.aria-label]="label()">
      <div class="ntc__scroll" tabindex="0" [attr.aria-label]="label()">
        <ng-content />
      </div>
      <ng-content select="[nasTablePager]" />
    </section>
  `,
  styles: `
    :host { display: block; min-inline-size: 0; }
    .ntc {
      border: 1px solid var(--nas-color-border);
      border-radius: var(--nas-radius-xl);
      background: var(--nas-color-bg-surface);
      box-shadow: 0 1px 2px 0 var(--nas-teal-1000-08);
      overflow: hidden;
    }
    /* Containing block for the table's visually hidden labels, so they cannot
       escape the scroll box and widen the page. */
    .ntc__scroll { position: relative; overflow-x: auto; }
    .ntc__scroll:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: -2px; }
    /* The pager row (Figma 92 px: nas-pager's own 24 px padding). */
    :host ::ng-deep [nasTablePager] { display: block; border-block-start: 1px solid var(--nas-color-border); }
  `,
})
export class NasTableCardComponent {
  /** Accessible name of the table region, already translated. */
  readonly label = input.required<string>();
  readonly busy = input(false);
}
