import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DayCell {
  date: Date;
  day: number;
  otherMonth: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

/**
 * Reusable date picker — a drop-in replacement for <p-calendar> that works
 * reliably inside PrimeNG dialogs and any scrolling/transformed container.
 *
 * Why this exists: PrimeNG's calendar overlay kept getting clipped or
 * mis-positioned because p-dialog wraps its content in a transformed /
 * overflow-scrolled mask, which breaks `position: fixed` for anything
 * rendered inside it.
 *
 * How it stays robust:
 *   - Implements ControlValueAccessor with a `Date | null` value, so it plugs
 *     straight into `formControlName` exactly like the old p-calendar.
 *   - The popover is *portaled to <body>* (createEmbeddedView + move nodes),
 *     so no ancestor transform or overflow can ever clip or offset it. It is
 *     positioned with `position: fixed` from the trigger's viewport rect and
 *     re-anchored on scroll/resize.
 *   - The day grid is always laid out LTR (Sun→Sat, Western day numbers) so it
 *     renders identically in LTR and RTL. Month / weekday labels are localized
 *     from <html lang>.
 */
@Component({
  selector: 'nas-datepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NasDatepickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="nasdp" [class.nasdp--disabled]="disabled">
      <input
        #trigger
        type="text"
        class="nasdp__input"
        readonly
        [value]="display()"
        [placeholder]="placeholder"
        [disabled]="disabled"
        (click)="toggle()"
        (keydown.enter)="toggle(); $event.preventDefault()"
        (keydown.space)="toggle(); $event.preventDefault()"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="nasdp__btn"
        tabindex="-1"
        [disabled]="disabled"
        (click)="toggle()"
      >
        <i class="pi pi-calendar"></i>
      </button>
    </div>

    <ng-template #panelTpl>
      <div
        class="nasdp__panel"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="PANEL_WIDTH"
      >
        <div class="nasdp__head">
          <button
            type="button"
            class="nasdp__nav"
            (click)="prevMonth()"
            aria-label="Previous month"
          >
            <i class="pi pi-chevron-left"></i>
          </button>
          <span class="nasdp__title">{{ monthLabel() }}</span>
          <button
            type="button"
            class="nasdp__nav"
            (click)="nextMonth()"
            aria-label="Next month"
          >
            <i class="pi pi-chevron-right"></i>
          </button>
        </div>

        <table class="nasdp__grid">
          <thead>
            <tr>
              @for (w of weekdays; track w) {
                <th>{{ w }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (week of weeks(); track $index) {
              <tr>
                @for (c of week; track c.date.getTime()) {
                  <td>
                    <button
                      type="button"
                      class="nasdp__day"
                      [class.is-other]="c.otherMonth"
                      [class.is-today]="c.today"
                      [class.is-selected]="c.selected"
                      [disabled]="c.disabled"
                      (click)="pick(c)"
                    >
                      {{ c.day }}
                    </button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <div class="nasdp__foot">
          <button type="button" class="nasdp__link" (click)="goToday()">
            {{ todayLabel }}
          </button>
          <button type="button" class="nasdp__link" (click)="clear()">
            {{ clearLabel }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }

      /* The field follows the document direction (RTL in Arabic). Logical
       border properties keep the input/icon corners correct in both
       directions: the icon button sits on the trailing (inline-end) edge —
       right in LTR, left in RTL. */
      .nasdp {
        display: flex;
        width: 100%;
        max-width: 100%;
      }
      .nasdp__input {
        flex: 1 1 auto;
        min-width: 0;
        box-sizing: border-box;
        height: 44px;
        padding: 0 12px;
        border: 1px solid var(--nas-color-border, #d7dade);
        border-inline-end: none;
        border-start-start-radius: var(--nas-radius-md, 8px);
        border-end-start-radius: var(--nas-radius-md, 8px);
        background: #fff;
        font-family: inherit;
        font-size: 14px;
        color: var(--nas-color-text, #171819);
        cursor: pointer;
        outline: none;
      }
      .nasdp__input::placeholder {
        color: var(--nas-color-text-muted, #9aa0a6);
      }
      .nasdp__input:focus {
        border-color: var(--nas-teal-600, #0c6e62);
      }
      .nasdp__input:focus + button {
        border-color: var(--nas-teal-600, #0c6e62);
        border-inline-start-color: transparent;
      }

      .nasdp__btn {
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--nas-color-border, #d7dade);
        border-start-end-radius: var(--nas-radius-md, 8px);
        border-end-end-radius: var(--nas-radius-md, 8px);
        background: #fff;
        color: var(--nas-color-text-muted, #6b7178);
        cursor: pointer;
      }
      .nasdp__btn:hover:not(:disabled) {
        background: #f4f5f6;
      }

      .nasdp--disabled .nasdp__input,
      .nasdp--disabled .nasdp__btn {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* ── Popover panel (portaled to <body>) ── */
      .nasdp__panel {
        position: fixed;
        z-index: 11000;
        box-sizing: border-box;
        direction: ltr;
        padding: 10px;
        background: #fff;
        border: 1px solid var(--nas-color-border, #e2e5e9);
        border-radius: var(--nas-radius-md, 10px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
        user-select: none;
      }
      .nasdp__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .nasdp__title {
        font-size: 14px;
        font-weight: 600;
        color: var(--nas-color-text, #171819);
      }
      .nasdp__nav {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--nas-color-text, #171819);
        cursor: pointer;
        font-size: 13px;
      }
      .nasdp__nav:hover {
        background: #f0f1f3;
      }

      .nasdp__grid {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
      }
      .nasdp__grid th {
        padding: 4px 0;
        font-size: 11px;
        font-weight: 600;
        color: var(--nas-color-text-muted, #9aa0a6);
        text-align: center;
      }
      .nasdp__grid td {
        padding: 1px;
        text-align: center;
      }

      .nasdp__day {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
        border: 0;
        border-radius: 8px;
        background: transparent;
        font-family: inherit;
        font-size: 13px;
        color: var(--nas-color-text, #171819);
        cursor: pointer;
      }
      .nasdp__day:hover:not(:disabled):not(.is-selected) {
        background: #eef0f2;
      }
      .nasdp__day.is-other {
        color: var(--nas-color-text-muted, #c2c7cc);
      }
      .nasdp__day.is-today {
        box-shadow: inset 0 0 0 1px var(--nas-teal-600, #0c6e62);
      }
      .nasdp__day.is-selected {
        background: var(--nas-teal-700, #0c2427);
        color: #fff;
      }
      .nasdp__day:disabled {
        color: #d4d7da;
        cursor: not-allowed;
      }

      .nasdp__foot {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--nas-color-border, #eceef0);
      }
      .nasdp__link {
        border: 0;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--nas-teal-700, #0c6e62);
      }
    `,
  ],
})
export class NasDatepickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = '';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input() min: Date | null = null;
  @Input() max: Date | null = null;

  @ViewChild('panelTpl', { static: true }) private panelTpl!: TemplateRef<void>;

  protected readonly PANEL_WIDTH = 288;
  private readonly PANEL_HEIGHT = 340;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly renderer = inject(Renderer2);

  protected readonly value = signal<Date | null>(null);
  protected readonly open = signal(false);
  protected readonly pos = signal<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });
  protected readonly view = signal<Date>(this.startOfMonth(new Date()));

  private panelView?: EmbeddedViewRef<void>;
  private removeListeners: Array<() => void> = [];

  private readonly locale =
    (typeof document !== 'undefined' && document.documentElement.lang) || 'en';

  protected readonly weekdays = this.buildWeekdays();
  protected readonly todayLabel = this.locale.startsWith('ar')
    ? 'اليوم'
    : 'Today';
  protected readonly clearLabel = this.locale.startsWith('ar')
    ? 'مسح'
    : 'Clear';

  protected onTouched: () => void = () => {};
  private onChange: (v: Date | null) => void = () => {};

  // ── Derived view state ──────────────────────────────────────────────
  protected readonly monthLabel = computed(() => {
    const v = this.view();
    const month = new Intl.DateTimeFormat(this.locale, {
      month: 'long',
    }).format(v);
    return `${month} ${v.getFullYear()}`;
  });

  protected readonly weeks = computed<DayCell[][]>(() => {
    const view = this.view();
    const selected = this.value();
    const today = new Date();
    const year = view.getFullYear();
    const month = view.getMonth();

    const first = new Date(year, month, 1);
    const cursor = new Date(year, month, 1 - first.getDay()); // back up to Sunday

    const weeks: DayCell[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
        );
        row.push({
          date,
          day: date.getDate(),
          otherMonth: date.getMonth() !== month,
          today: this.sameDay(date, today),
          selected: !!selected && this.sameDay(date, selected),
          disabled: this.isDisabled(date),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(row);
    }
    return weeks;
  });

  protected readonly display = computed<string>(() => {
    const v = this.value();
    if (!v) return '';
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  });

  // ── Open / close / positioning ──────────────────────────────────────
  protected toggle(): void {
    if (this.disabled) return;
    this.open() ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    if (this.panelView) return;
    this.view.set(this.startOfMonth(this.value() ?? new Date()));
    this.open.set(true);
    this.onTouched();

    // Render the panel and portal its root node to <body> so no ancestor
    // transform/overflow can clip or offset it.
    this.panelView = this.vcr.createEmbeddedView(this.panelTpl);
    this.panelView.detectChanges();
    for (const node of this.panelView.rootNodes) {
      if (node?.nodeType === Node.ELEMENT_NODE) {
        this.renderer.appendChild(document.body, node);
      }
    }

    this.reposition();
    this.bindGlobalListeners();
  }

  protected close(): void {
    if (!this.panelView) {
      this.open.set(false);
      return;
    }
    this.unbindGlobalListeners();
    this.panelView.destroy();
    this.panelView = undefined;
    this.open.set(false);
  }

  private reposition(): void {
    const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    if (left + this.PANEL_WIDTH > vw - 8) left = vw - this.PANEL_WIDTH - 8;
    if (left < 8) left = 8;

    let top = rect.bottom + 4;
    if (
      top + this.PANEL_HEIGHT > vh - 8 &&
      rect.top - this.PANEL_HEIGHT - 4 > 8
    ) {
      top = rect.top - this.PANEL_HEIGHT - 4; // flip above when no room below
    }

    this.pos.set({ top, left });
    this.panelView?.detectChanges();
  }

  private bindGlobalListeners(): void {
    // Capture-phase scroll catches scrolling from ANY ancestor (e.g. the
    // dialog body), not just window. Reposition keeps it anchored.
    const onScroll = () => this.reposition();
    const onResize = () => this.reposition();
    const onDown = (ev: Event) => {
      const t = ev.target as Node;
      const hostHit = this.el.nativeElement.contains(t);
      const panelHit = this.panelView?.rootNodes.some(
        (n: Node) =>
          n?.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).contains(t),
      );
      if (!hostHit && !panelHit) this.close();
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onDown, true);

    this.removeListeners = [
      () => window.removeEventListener('scroll', onScroll, true),
      () => window.removeEventListener('resize', onResize),
      () => document.removeEventListener('mousedown', onDown, true),
    ];
  }

  private unbindGlobalListeners(): void {
    this.removeListeners.forEach((fn) => fn());
    this.removeListeners = [];
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  // ── Navigation / selection ──────────────────────────────────────────
  protected prevMonth(): void {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() + 1, 1));
  }

  protected pick(cell: DayCell): void {
    if (cell.disabled) return;
    this.commit(cell.date);
    this.close();
  }

  protected goToday(): void {
    const t = new Date();
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    if (this.isDisabled(d)) {
      this.view.set(this.startOfMonth(d));
      return;
    }
    this.commit(d);
    this.close();
  }

  protected clear(): void {
    this.commit(null);
    this.close();
  }

  private commit(d: Date | null): void {
    this.value.set(d);
    this.onChange(d);
  }

  // ── ControlValueAccessor ────────────────────────────────────────────
  writeValue(v: Date | string | null): void {
    const d = v == null ? null : v instanceof Date ? v : new Date(v);
    this.value.set(d && !isNaN(d.getTime()) ? d : null);
    this.view.set(this.startOfMonth(this.value() ?? new Date()));
  }

  registerOnChange(fn: (v: Date | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  ngOnDestroy(): void {
    this.close();
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private isDisabled(d: Date): boolean {
    if (
      this.min &&
      d <
        new Date(
          this.min.getFullYear(),
          this.min.getMonth(),
          this.min.getDate(),
        )
    )
      return true;
    if (
      this.max &&
      d >
        new Date(
          this.max.getFullYear(),
          this.max.getMonth(),
          this.max.getDate(),
        )
    )
      return true;
    return false;
  }

  private buildWeekdays(): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, { weekday: 'short' });
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      out.push(fmt.format(new Date(2023, 0, 1 + i))); // 2023-01-01 is a Sunday
    }
    return out;
  }
}
