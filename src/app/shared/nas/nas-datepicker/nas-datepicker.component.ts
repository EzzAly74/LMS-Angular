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
  templateUrl: './nas-datepicker.component.html',
  styleUrl: './nas-datepicker.component.scss',
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
