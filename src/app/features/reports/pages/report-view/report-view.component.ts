import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, tap } from 'rxjs';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasActionMenuComponent, type NasActionMenuItem } from '../../../../shared/nas/nas-action-menu/nas-action-menu.component';
import {
  NasFilterDialogComponent, type NasFilterField, type NasFilterSelection, type NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import { createPagedList, type PagedQuery } from '../../../../shared/list/paged-list';
import { RemoteFilterOptions, activeFilterCount } from '../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { ReportExportError, ReportsApiService } from '../../services/reports-api.service';
import {
  asFormat,
  type ReportCell, type ReportColumn, type ReportDefinition, type ReportFilterParams, type ReportRow,
} from '../../models/report.model';

interface Query extends PagedQuery {
  readonly filters: ReportFilterParams;
}

/** A header group: consecutive columns of one spec group ("Employee", "Dates"). */
interface ColumnGroup {
  readonly key: string;
  readonly label: string;
  readonly span: number;
}

/**
 * One NAS report (D-112): its columns in the spec's order, its filters in the
 * shared Filter modal, a paged table and the export (Excel / CSV, with the
 * same filters and search). Columns the system does not capture yet keep
 * their place, empty, and are named above the table. A report that needs a
 * choice (an evaluation template) starts on the most answered one.
 */
@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    NasActionMenuComponent,
    NasFilterDialogComponent,
    NasListToolbarComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasPagerComponent,
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
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  /** Route param, bound by withComponentInputBinding. */
  readonly key = input.required<string>();

  readonly definition = signal<ReportDefinition | null>(null);
  /** `no_choice`: the report needs an evaluation template and none exists yet. */
  readonly definitionState = signal<'loading' | 'ready' | 'missing' | 'no_choice' | 'error'>('loading');
  /** Columns of the last page (evaluation reports add one per template question). */
  readonly columns = signal<readonly ReportColumn[]>([]);
  readonly exporting = signal(false);
  readonly skeletons = SKELETON_ROWS;

  readonly list = createPagedList<Query, ReportRow>({
    initial: { search: '', page: 1, perPage: 25, filters: {} },
    load: q => this.api.page(this.key(), q.filters, q.page, q.perPage, q.search).pipe(
      tap(p => this.columns.set(p.columns)),
      map(p => ({ items: p.rows, total: p.total })),
    ),
  });

  /* ── Columns ───────────────────────────────────────────────────── */
  readonly shownColumns = computed(() => (this.columns().length ? this.columns() : this.definition()?.columns ?? []));
  readonly missingColumns = computed(() => this.shownColumns().filter(c => !c.available));
  readonly groups = computed<ColumnGroup[]>(() => {
    const out: ColumnGroup[] = [];
    for (const c of this.shownColumns()) {
      const last = out[out.length - 1];
      if (last && last.key === c.group) out[out.length - 1] = { ...last, span: last.span + 1 };
      else out.push({ key: c.group, label: c.group_label, span: 1 });
    }
    return out;
  });
  readonly skeletonCells = computed<readonly NasSkeletonCell[]>(() =>
    this.shownColumns().slice(0, 12).map(c => (c.type === 'text' ? 'text' : 'short')));

  /* ── Filters ───────────────────────────────────────────────────── */
  readonly filterOpen = signal(false);
  /** One server-searched option list per source filter, built when the definition loads. */
  private readonly remote = signal<ReadonlyMap<string, RemoteFilterOptions>>(new Map());
  /** The report the current filters belong to: another report starts clean. */
  private loadedKey: string | null = null;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const out: Record<string, NasFilterSelection> = {};
    for (const [k, v] of Object.entries(this.list.query().filters)) out[k] = isList(v) ? [...v] : v;
    return out;
  });
  /** Required choices (the evaluation template) are the report's scope, not a filter to count. */
  readonly activeFilters = computed(() => {
    const required = new Set(this.definition()?.filters.filter(f => f.required).map(f => f.key) ?? []);
    const counted: Record<string, NasFilterSelection> = {};
    for (const [k, v] of Object.entries(this.appliedFilters())) if (!required.has(k)) counted[k] = v;
    return activeFilterCount(counted);
  });
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const def = this.definition();
    if (!def) return [];
    const any = this.t.instant('reports.view.any');
    const fields: NasFilterField[] = [];
    for (const f of def.filters) {
      switch (f.type) {
        case 'multi':
        case 'select':
          fields.push({
            key: f.key, label: f.label, placeholder: any, remote: true, multiple: f.type === 'multi',
            wide: f.required, options: this.remote().get(f.key)?.options() ?? [], searchPlaceholder: this.t.instant('common.search'),
          });
          break;
        case 'status':
          fields.push({ key: f.key, label: f.label, placeholder: any, multiple: true, options: [...f.options] });
          break;
        case 'date_range':
          fields.push(
            { key: `${f.key}_from`, label: this.t.instant('reports.view.range_from', { label: f.label }), placeholder: this.t.instant('reports.view.pick_date'), options: [], type: 'date', before: `${f.key}_to` },
            { key: `${f.key}_to`, label: this.t.instant('reports.view.range_to', { label: f.label }), placeholder: this.t.instant('reports.view.pick_date'), options: [], type: 'date', after: `${f.key}_from` },
          );
          break;
        case 'date':
          fields.push({ key: f.key, label: f.label, placeholder: this.t.instant('reports.view.pick_date'), options: [], type: 'date' });
          break;
        case 'number':
          fields.push({ key: f.key, label: f.label, placeholder: this.t.instant('reports.view.percent_placeholder'), options: [], type: 'number', min: 0, max: 100 });
          break;
      }
    }
    return fields;
  });

  /** The chosen evaluation template's name, shown as the report's scope. */
  readonly scopeLabel = computed(() => {
    const required = this.definition()?.filters.find(f => f.required);
    if (!required) return null;
    const value = this.list.query().filters[required.key];
    const option = this.remote().get(required.key)?.options().find(o => o.id === value);
    return option ? { label: required.label, value: option.label } : null;
  });

  readonly exportItems = computed<NasActionMenuItem[]>(() => {
    this.locale();
    return [
      { id: 'xlsx', label: this.t.instant('reports.export_excel'), icon: 'file-text' },
      { id: 'csv', label: this.t.instant('reports.export_csv'), icon: 'file-text' },
    ];
  });

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.loadDefinition();
    });
    // A new report (a link, Back): start again from its definition.
    effect(() => {
      this.key();
      untracked(() => this.loadDefinition());
    });
  }

  openFilter(): void {
    for (const options of this.remote().values()) options.search('');
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    this.remote().get(e.key)?.search(e.term);
  }

  onFilter(values: NasFilterValues): void {
    const def = this.definition();
    if (!def) return;
    const current = this.list.query().filters;
    const next: Record<string, string | number | readonly (string | number)[]> = {};
    for (const [k, v] of Object.entries(values)) {
      if (isList(v)) { if (v.length) next[k] = [...v]; }
      else if (v !== null && v !== '') next[k] = v;
    }
    for (const f of def.filters) {
      // The template stays chosen: clearing it would leave nothing to report on.
      if (f.required && next[f.key] === undefined && current[f.key] !== undefined) next[f.key] = current[f.key];
      const chosen = next[f.key];
      if (chosen !== undefined) this.remote().get(f.key)?.remember(isList(chosen) ? chosen : [chosen]);
    }
    this.list.patch({ filters: next });
  }

  /** Retry after the definition failed to load. */
  loadAgain(): void {
    this.loadDefinition();
  }

  onExport(format: string): void {
    const fmt = asFormat(format);
    const def = this.definition();
    if (!fmt || !def || this.exporting()) return;
    this.exporting.set(true);
    const q = this.list.query();
    this.api.export(def.key, q.filters, q.search, fmt).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: (err: unknown) => {
        this.exporting.set(false);
        if (err instanceof ReportExportError) this.toast.warn(err.reason ?? 'errors.validation');
      },
    });
  }

  /** A cell as text, by its column type; empty cells show nothing. */
  display(column: ReportColumn, value: ReportCell): string {
    if (value === null || value === '') return '';
    switch (column.type) {
      case 'number': return typeof value === 'number' ? number(value) : String(value);
      case 'percent': return typeof value === 'number' ? `${number(value, 1)}%` : String(value);
      case 'yes_no': return this.t.instant(value ? 'reports.view.yes' : 'reports.view.no');
      default: return String(value);
    }
  }

  isNumeric(column: ReportColumn): boolean {
    return column.type === 'number' || column.type === 'percent';
  }

  private loadDefinition(): void {
    this.definitionState.set('loading');
    const key = this.key();
    this.api.catalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
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
        this.start(def, sameReport ? this.list.query().filters : {}, sameReport ? this.list.query().search : '');
      },
      error: () => this.definitionState.set('error'),
    });
  }

  /** Load the first page; a required choice gets its first option (the most answered template). */
  private start(def: ReportDefinition, filters: ReportFilterParams, search: string): void {
    const required = def.filters.find(f => f.required && f.source);
    if (!required || filters[required.key] !== undefined) {
      this.list.patch({ filters, search });
      return;
    }
    this.api.options(required.source ?? '', '').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: options => {
        const first = options[0];
        if (!first) { this.definitionState.set('no_choice'); return; }
        this.remote().get(required.key)?.seed(options, [first.id]);
        this.list.patch({ filters: { ...filters, [required.key]: first.id }, search });
      },
      error: () => this.definitionState.set('error'),
    });
  }

  /** A server-searched option list for each filter with a source, in this component's injection context. */
  private buildRemote(def: ReportDefinition): ReadonlyMap<string, RemoteFilterOptions> {
    const map = new Map<string, RemoteFilterOptions>();
    for (const f of def.filters) {
      if (!f.source) continue;
      const source = f.source;
      map.set(f.key, runInInjectionContext(this.injector, () => new RemoteFilterOptions(term => {
        const parent = f.depends_on ? this.list.query().filters[f.depends_on] : undefined;
        const ids = isList(parent) ? parent.filter((c): c is number => typeof c === 'number') : [];
        return this.api.options(source, term, ids);
      })));
    }
    return map;
  }
}

/** A multi-value filter (a list), as opposed to one value. */
function isList(v: unknown): v is readonly (string | number)[] {
  return Array.isArray(v);
}

function number(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}
