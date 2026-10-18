import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrimeTemplate } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { map, tap } from 'rxjs';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasDatepickerComponent } from '../../../../shared/nas/nas-datepicker/nas-datepicker.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasPillTabsComponent, type NasPillTab } from '../../../../shared/nas/nas-pill-tabs/nas-pill-tabs.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import { createPagedList, type PagedQuery } from '../../../../shared/list/paged-list';
import { RemoteFilterOptions } from '../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { EVALUATION_RESPONSES, EVALUATION_SUMMARY } from '../../report-icons';
import { ReportExportError, ReportsApiService } from '../../services/reports-api.service';
import {
  asFormat,
  type ReportCell, type ReportDefinition, type ReportFilter, type ReportFilterOption, type ReportFilterParams,
  type ReportPreviewColumn, type ReportRow, type ReportTone,
} from '../../models/report.model';

interface Query extends PagedQuery {
  readonly filters: ReportFilterParams;
}

type FilterValue = string | number | readonly (string | number)[];

/** A filter value list, as opposed to one value. */
function isList(v: unknown): v is readonly (string | number)[] {
  return Array.isArray(v);
}

/**
 * One report (Figma 2201:82041; empty 2265:128244): the breadcrumb and
 * "Export" (Excel or CSV, with the filters applied), the Filters card (every
 * filter inline, applied as it changes, with the active count), then
 * "Preview: <report>": a few key columns, paged; the export carries every
 * column. With no rows the table gives way to the Figma empty state. The
 * evaluation summary and its response detail are two tabs of one report.
 */
@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslateModule,
    PrimeTemplate,
    DropdownModule,
    MultiSelectModule,
    NasDatepickerComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasPagerComponent,
    NasPillTabsComponent,
    NasTableCardComponent,
    NasDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-view.component.html',
  styleUrl: './report-view.component.scss',
})
export class ReportViewComponent {
  private readonly api = inject(ReportsApiService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  /** Route param, bound by withComponentInputBinding. */
  readonly key = input.required<string>();

  readonly catalog = signal<readonly ReportDefinition[]>([]);
  readonly definition = signal<ReportDefinition | null>(null);
  readonly definitionState = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  readonly columns = signal<readonly ReportPreviewColumn[]>([]);
  readonly exporting = signal(false);
  readonly exportMenuOpen = signal(false);
  readonly skeletons = SKELETON_ROWS;

  readonly list = createPagedList<Query, ReportRow>({
    initial: { search: '', page: 1, perPage: 25, filters: {} },
    load: q => this.api.page(this.key(), q.filters, q.page, q.perPage).pipe(
      tap(p => {
        this.columns.set(p.columns);
        this.adoptDefaults(p.filters);
      }),
      map(p => ({ items: p.rows, total: p.total })),
    ),
  });

  /** One server-searched option list per filter with a source. */
  private readonly remote = signal<ReadonlyMap<string, RemoteFilterOptions>>(new Map());
  private loadedKey: string | null = null;

  readonly skeletonCells = computed<readonly NasSkeletonCell[]>(() =>
    (this.columns().length ? this.columns().map(() => 'text' as const) : ['text', 'text', 'text', 'text', 'text', 'text']));

  /** Filters holding a value; the evaluation template is the report's scope, not counted. */
  readonly activeCount = computed(() => {
    const filters = this.list.query().filters;
    return (this.definition()?.filters ?? []).filter(f => !f.required && (f.type === 'date_range'
      ? filters[`${f.key}_from`] !== undefined || filters[`${f.key}_to`] !== undefined
      : filters[f.key] !== undefined)).length;
  });

  /** Summary / Response detail, when the reader may open both. */
  readonly tabs = computed<NasPillTab[]>(() => {
    this.locale();
    const key = this.key();
    const keys = this.catalog().map(r => r.key);
    if (![EVALUATION_SUMMARY, EVALUATION_RESPONSES].includes(key) || !keys.includes(EVALUATION_RESPONSES)) return [];
    return [
      { id: EVALUATION_SUMMARY, label: this.t.instant('reports.view.tab_summary') },
      { id: EVALUATION_RESPONSES, label: this.t.instant('reports.view.tab_responses') },
    ];
  });

  constructor() {
    withLocaleReload(() => this.loadDefinition());
    effect(() => {
      this.key();
      untracked(() => this.loadDefinition());
    });
  }

  /* ── Filters ───────────────────────────────────────────────────── */

  value(key: string): FilterValue | null {
    return this.list.query().filters[key] ?? null;
  }

  dateValue(key: string): Date | null {
    const v = this.value(key);
    const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  optionsOf(f: ReportFilter): ReportFilterOption[] {
    return f.source ? this.remote().get(f.key)?.options() ?? [] : [...f.options];
  }

  placeholderOf(f: ReportFilter): string {
    const key = `reports.placeholders.${f.key}`;
    const text: string = this.t.instant(key);
    return text !== key ? text : this.t.instant('reports.placeholders.any');
  }

  searchOptions(f: ReportFilter, term: string | null | undefined): void {
    this.remote().get(f.key)?.search((term ?? '').trim());
  }

  setFilter(key: string, v: FilterValue | null | undefined): void {
    const next: Record<string, FilterValue> = { ...this.list.query().filters };
    if (v === null || v === undefined || v === '' || (isList(v) && v.length === 0)) {
      delete next[key];
    } else {
      next[key] = isList(v) ? [...v] : v;
      this.remote().get(key)?.remember(isList(v) ? v : [v]);
    }
    this.list.patch({ filters: next });
  }

  setDate(key: string, d: Date | null): void {
    const pad = (n: number) => String(n).padStart(2, '0');
    this.setFilter(key, d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null);
  }

  setNumber(key: string, raw: string): void {
    const n = raw.trim() === '' ? NaN : Number(raw);
    this.setFilter(key, Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null);
  }

  /* ── Export ────────────────────────────────────────────────────── */

  toggleExportMenu(): void {
    this.exportMenuOpen.update(v => !v);
  }

  onExport(format: string): void {
    const fmt = asFormat(format);
    const def = this.definition();
    this.exportMenuOpen.set(false);
    if (!fmt || !def || this.exporting()) return;
    this.exporting.set(true);
    this.api.export(def.key, this.list.query().filters, fmt).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: (err: unknown) => {
        this.exporting.set(false);
        if (err instanceof ReportExportError) this.toast.warn(err.reason ?? 'errors.validation');
      },
    });
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(e: MouseEvent): void {
    if (!this.exportMenuOpen()) return;
    const menu = this.host.nativeElement.querySelector('.rv-export');
    if (menu && e.target instanceof Node && !menu.contains(e.target)) this.exportMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.exportMenuOpen.set(false);
  }

  /* ── Table ─────────────────────────────────────────────────────── */

  openTab(id: string): void {
    if (id !== this.key()) void this.router.navigate(['/admin/reports', id]);
  }

  loadAgain(): void {
    this.loadDefinition();
  }

  toneOf(column: ReportPreviewColumn, value: ReportCell): ReportTone {
    return column.tones.find(t => t.label === value)?.tone ?? 'neutral';
  }

  display(column: ReportPreviewColumn, value: ReportCell): string {
    if (value === null || value === '') return '';
    switch (column.type) {
      case 'number': return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(value);
      case 'percent': return typeof value === 'number' ? `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%` : String(value);
      case 'yes_no': return this.t.instant(value ? 'reports.view.yes' : 'reports.view.no');
      default: return String(value);
    }
  }

  isNumeric(column: ReportPreviewColumn): boolean {
    return column.type === 'number' || column.type === 'percent';
  }

  /* ── Loading ───────────────────────────────────────────────────── */

  private loadDefinition(): void {
    this.definitionState.set('loading');
    const key = this.key();
    this.api.catalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.catalog.set(list);
        const def = list.find(r => r.key === key) ?? null;
        if (!def) { this.definition.set(null); this.definitionState.set('missing'); return; }
        const sameReport = this.loadedKey === key;
        this.loadedKey = key;
        if (!sameReport) {
          this.columns.set([]);
          this.remote.set(this.buildRemote(def));
        }
        this.definition.set(def);
        this.definitionState.set('ready');
        // The template's choices load at once, so the chosen one shows its name.
        for (const f of def.filters) if (f.required && f.source) this.remote().get(f.key)?.search('');
        this.list.patch({ filters: sameReport ? this.list.query().filters : {} });
      },
      error: () => this.definitionState.set('error'),
    });
  }

  /** The server's default choice (the template) becomes the field's value, without another load. */
  private adoptDefaults(applied: ReportFilterParams): void {
    const current = this.list.query();
    const missing = (this.definition()?.filters ?? [])
      .filter(f => f.required && current.filters[f.key] === undefined && applied[f.key] !== undefined);
    if (!missing.length) return;
    const filters: Record<string, FilterValue> = { ...current.filters };
    for (const f of missing) filters[f.key] = applied[f.key];
    this.list.adopt({ filters });
  }

  private buildRemote(def: ReportDefinition): ReadonlyMap<string, RemoteFilterOptions> {
    const remote = new Map<string, RemoteFilterOptions>();
    for (const f of def.filters) {
      if (!f.source) continue;
      const source = f.source;
      remote.set(f.key, runInInjectionContext(this.injector, () => new RemoteFilterOptions(term => {
        const parent = f.depends_on ? this.list.query().filters[f.depends_on] : undefined;
        const ids = isList(parent) ? parent.filter((c): c is number => typeof c === 'number') : [];
        return this.api.options(source, term, ids);
      })));
    }
    return remote;
  }
}
