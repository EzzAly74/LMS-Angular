import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The table pager of the 2026 designs: "1–4 of 6" and two 44px chevron
 * buttons (Figma 2181:115043, 1986:74701, 2325:117118).
 *
 * `rangeKey` is a translation taking {{from}}, {{to}} and {{total}}, because
 * the designs word the range differently from page to page. The chevrons are
 * the Figma asset, rotated, and mirrored in RTL so "previous" always points
 * against the reading direction.
 */
@Component({
  selector: 'nas-pager',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nas-pager" [attr.aria-label]="'common.pagination' | translate">
      <span class="nas-pager__info">
        {{ rangeKey() | translate: { from: from(), to: to(), total: total() } }}
        @if (showAllVisible() && total() > perPage()) {
          <button type="button" class="nas-pager__all" (click)="showAll.emit()">{{ 'common.show_all' | translate }}</button>
        }
      </span>
      <span class="nas-pager__nav">
        <button type="button" class="nas-pager__btn nas-pager__btn--prev" [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)" [attr.aria-label]="'common.previous' | translate">
          <img src="assets/icons/figma/arrow-down-old-system.svg" width="24" height="24" alt="" />
        </button>
        <button type="button" class="nas-pager__btn nas-pager__btn--next" [disabled]="page() >= lastPage()"
          (click)="pageChange.emit(page() + 1)" [attr.aria-label]="'common.next' | translate">
          <img src="assets/icons/figma/arrow-down-old-system.svg" width="24" height="24" alt="" />
        </button>
      </span>
    </nav>
  `,
  styles: `
    .nas-pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--nas-space-4);
      padding: var(--nas-space-6) var(--nas-space-5);
    }
    .nas-pager__info { display: flex; align-items: center; gap: var(--nas-space-2); font-size: var(--nas-size-xs); color: var(--nas-color-text-strong); }
    /* "Show All" (Figma 1983:42584): underlined teal-700 link. */
    .nas-pager__all {
      padding: 0; border: 0; background: none; font: inherit; font-weight: var(--nas-weight-medium);
      line-height: 16.8px; color: var(--nas-teal-700); text-decoration: underline; cursor: pointer;
    }
    .nas-pager__all:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: 2px; }
    .nas-pager__nav { display: flex; gap: var(--nas-space-4); }
    .nas-pager__btn {
      display: inline-flex;
      padding: var(--nas-space-2);
      border: 0;
      border-radius: var(--nas-radius-md);
      background: var(--nas-neutral-300);
      cursor: pointer;
    }
    .nas-pager__btn img { display: block; }
    .nas-pager__btn:hover:not([disabled]) { background: var(--nas-neutral-400); }
    .nas-pager__btn:focus-visible { outline: 2px solid var(--nas-teal-700); outline-offset: 2px; }
    .nas-pager__btn[disabled] { opacity: 0.4; cursor: not-allowed; }
    .nas-pager__btn--prev img { transform: rotate(90deg); }
    .nas-pager__btn--next img { transform: rotate(-90deg); }
    :host-context([dir='rtl']) .nas-pager__btn--prev img { transform: rotate(-90deg); }
    :host-context([dir='rtl']) .nas-pager__btn--next img { transform: rotate(90deg); }
  `,
})
export class NasPagerComponent {
  readonly page     = input.required<number>();
  readonly total    = input.required<number>();
  readonly perPage  = input.required<number>();
  readonly rangeKey = input('common.range_of');
  readonly pageChange = output<number>();
  /** Figma 1983:42584 adds "Show All" after the range; the host decides what it loads. */
  readonly showAllVisible = input(false);
  readonly showAll = output<void>();

  protected readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage())));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage() + 1));
  protected readonly to   = computed(() => Math.min(this.page() * this.perPage(), this.total()));
}
