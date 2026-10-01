import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { catchError, of } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasImportReportComponent } from '../../../../shared/nas/nas-import-report/nas-import-report.component';
import {
  NasFilterDialogComponent, type NasFilterField, type NasFilterFieldOption, type NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, pagedParams, toPaged, withList, type PagedQuery } from '../../../../shared/list/paged-list';
import {
  activeFilterCount, appliedValues, filterNumbers, filterOne, filterStrings, toFilterOptions,
} from '../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { pluralKey } from '../../../../core/utils/plural-key';
import { EvScoreComponent } from '../../components/ev-score/ev-score.component';
import {
  EVALUATION_RESULTS,
  EvaluationFilterOptions,
  EvaluationResult,
  EvaluationTemplateRow,
  ImportReport,
} from '../../models/evaluation.model';
import { EvaluationTemplatesApiService, TransferFormat } from '../../services/evaluation-templates-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { AuthService } from '../../../../core/services/auth.service';

type SortKey = 'created_at' | 'name';

interface Query extends PagedQuery {
  readonly sort: SortKey;
  readonly dir: 'asc' | 'desc';
  readonly instructorIds: readonly number[];
  readonly courseIds: readonly number[];
  readonly results: readonly EvaluationResult[];
  /** Last response range, local `YYYY-MM-DD`. */
  readonly scoredFrom: string | null;
  readonly scoredTo: string | null;
}

/**
 * Evaluation Templates - Figma 2009:88432 (D4).
 *
 * GET admin/evaluations/templates. Instructors and Courses narrow the
 * responses each row aggregates; Result filters on the template's score
 * against the pass threshold (D-054); the date range bounds the last
 * response. They live in the Dashboard's one Filter modal (D-070: the frame's
 * chips, checkboxes and From / To pickers moved into it, human 2026-09-30).
 *
 * Create Template opens the builder (2409:132793). Import takes a whole file
 * or nothing and shows every problem by row (D-034); Export downloads the
 * list as currently filtered. Edit is offered only on templates nobody has
 * answered yet (decided 2026-09-26) - the API refuses it regardless.
 */
@Component({
  selector: 'app-evaluation-template-list',
  standalone: true,
  imports: [NasCanDirective, 
    RouterLink,
    TranslateModule,
    SkeletonModule,
    MenuModule,
    NasIconComponent,
    NasPagerComponent,
    NasImportReportComponent,
    NasFilterDialogComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasDatePipe,
    EvScoreComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class EvaluationTemplateListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;
  private readonly transfer   = inject(EvaluationTemplatesApiService);
  private readonly toast      = inject(ToastService);

  readonly skeletons = SKELETON_ROWS;
  /** Template, course, questions, average score, last scored, learners, the eye. */
  readonly skeletonCells: readonly NasSkeletonCell[] = ['title', 'text', 'num', 'short', 'short', 'short', 'action'];

  readonly list = createPagedList<Query, EvaluationTemplateRow>({
    // Figma: "Showing 1-8 of 8 templates".
    initial: {
      search: '', page: 1, perPage: 8, sort: 'created_at', dir: 'desc',
      instructorIds: [], courseIds: [], results: [], scoredFrom: null, scoredTo: null,
    },
    load: q => this.api.getPaginated<EvaluationTemplateRow>(API.ADMIN_EVALUATION_TEMPLATES, this.params(q)).pipe(toPaged(r => r)),
  });

  readonly recent      = signal<EvaluationTemplateRow[]>([]);
  readonly recentState = signal<'loading' | 'ready' | 'error'>('loading');

  /* ── Filter modal ──────────────────────────────────────────────── */
  readonly filterOpen = signal(false);
  private readonly instructors = signal<NasFilterFieldOption[]>([]);
  private readonly courses     = signal<NasFilterFieldOption[]>([]);
  private lookupsLoaded = false;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({
      instructor_ids: q.instructorIds, course_ids: q.courseIds, results: q.results, scored_from: q.scoredFrom, scored_to: q.scoredTo,
    });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'instructor_ids', multiple: true,
        label: this.t.instant('evaluations.chip.instructors'),
        placeholder: this.t.instant('courses_list.select_instructor'),
        searchPlaceholder: this.t.instant('courses_list.search_instructors'),
        options: this.instructors(),
      },
      {
        key: 'course_ids', multiple: true,
        label: this.t.instant('evaluations.chip.courses'),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: this.courses(),
      },
      {
        key: 'results', multiple: true, wide: true,
        label: this.t.instant('evaluations.result.legend'),
        placeholder: this.t.instant('common.all'),
        options: EVALUATION_RESULTS.map(r => ({ id: r, label: this.t.instant(`evaluations.result.${r}`) })),
      },
      {
        key: 'scored_from', type: 'date', before: 'scored_to', options: [],
        label: this.t.instant('evaluations.scored_from'),
        placeholder: this.t.instant('evaluations.from'),
      },
      {
        key: 'scored_to', type: 'date', after: 'scored_from', options: [],
        label: this.t.instant('evaluations.scored_to'),
        placeholder: this.t.instant('evaluations.to'),
      },
    ];
  });

  readonly nameSort = computed<'ascending' | 'descending' | 'none'>(() => {
    const q = this.list.query();
    return q.sort !== 'name' ? 'none' : q.dir === 'asc' ? 'ascending' : 'descending';
  });

  /** Import / Export menus (Figma: outline buttons with a caret). */
  readonly importing    = signal(false);
  readonly exporting    = signal(false);
  readonly importReport = signal<ImportReport | null>(null);
  readonly reportOpen   = signal(false);
  readonly importItems  = computed<MenuItem[]>(() => {
    this.locale();
    return [
      { label: this.t.instant('evaluations.transfer.template_xlsx'), command: () => this.downloadTemplate('xlsx') },
      { label: this.t.instant('evaluations.transfer.template_csv'),  command: () => this.downloadTemplate('csv') },
      // Uploading creates templates; the blank files are for anyone.
      ...(this.auth.can('create-evaluations')
        ? [{ separator: true }, { label: this.t.instant('evaluations.transfer.upload'), command: () => this.pickFile() }]
        : []),
    ];
  });
  readonly exportItems = computed<MenuItem[]>(() => {
    this.locale();
    return [
      { label: this.t.instant('evaluations.transfer.export_xlsx'), command: () => this.exportList('xlsx') },
      { label: this.t.instant('evaluations.transfer.export_csv'),  command: () => this.exportList('csv') },
    ];
  });

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    withLocaleReload(() => {
      // Template, course and instructor names are localised by the API.
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.list.reload();
      this.loadRecent();
    });
  }

  ngOnInit(): void {
    this.list.reload();
    this.loadRecent();
  }

  toggleSortByName(): void {
    const q = this.list.query();
    this.list.patch(q.sort === 'name' ? { dir: q.dir === 'asc' ? 'desc' : 'asc' } : { sort: 'name', dir: 'asc' });
  }

  responsesKey(n: number): string {
    return pluralKey('evaluations.templates.responses', n, this.locale());
  }

  /* ── Filter ────────────────────────────────────────────────────── */
  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilter(v: NasFilterValues): void {
    const date = (x: string | number | null) => (typeof x === 'string' ? x : null);
    this.list.patch({
      instructorIds: filterNumbers(v['instructor_ids']),
      courseIds: filterNumbers(v['course_ids']),
      results: filterStrings(v['results'], EVALUATION_RESULTS),
      scoredFrom: date(filterOne(v['scored_from'])),
      scoredTo: date(filterOne(v['scored_to'])),
    });
  }

  private loadLookups(): void {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.api
      .get<EvaluationFilterOptions>(API.ADMIN_EVALUATION_FILTER_OPTIONS)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(r => {
        // A failed list stays empty and is fetched again the next time.
        if (!r) { this.lookupsLoaded = false; return; }
        this.instructors.set(toFilterOptions((r.result?.instructors ?? []).map(o => ({ id: o.id, name: o.name ?? '' }))));
        this.courses.set(toFilterOptions((r.result?.courses ?? []).map(o => ({ id: o.id, name: o.name ?? '' }))));
      });
  }

  // ── Import / Export ────────────────────────────────────────────────────
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be chosen again after a fix
    if (!file) return;

    this.importing.set(true);
    this.transfer.import(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: report => {
        this.importing.set(false);
        if (report.errors.length === 0) {
          this.toast.success('evaluations.transfer.imported', { params: { templates: report.created, questions: report.questions } });
          this.list.patch({});
          this.loadRecent();
          return;
        }
        this.importReport.set(report);
        this.reportOpen.set(true);
      },
      error: (e: unknown) => {
        this.importing.set(false);
        this.toast.error(this.serverMessage(e));
      },
    });
  }

  private pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  private downloadTemplate(format: TransferFormat): void {
    this.transfer.importTemplate(format).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: (e: unknown) => this.toast.error(this.serverMessage(e)),
    });
  }

  private exportList(format: TransferFormat): void {
    const { page: _page, per_page: _perPage, ...filters } = this.params(this.list.query());
    this.exporting.set(true);
    this.transfer.export(format, filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: (e: unknown) => {
        this.exporting.set(false);
        this.toast.error(this.serverMessage(e));
      },
    });
  }

  /** The API's message (422 / 429), else a generic one. */
  private serverMessage(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const first = Object.values((e.error?.errors ?? {}) as Record<string, string[]>).flat()[0];
      if (typeof first === 'string') return first;
      if (e.status === 429) return this.t.instant('evaluations.transfer.too_many');
    }
    return this.t.instant('common.operation_failed');
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private params(q: Query): ApiParams {
    const p = pagedParams(q);
    p['sort'] = q.sort;
    p['dir'] = q.dir;
    withList(p, 'instructor_ids', q.instructorIds);
    withList(p, 'course_ids', q.courseIds);
    withList(p, 'results', q.results);
    if (q.scoredFrom) p['scored_from'] = q.scoredFrom;
    if (q.scoredTo) p['scored_to'] = q.scoredTo;
    return p;
  }

  /** "Recently Created": the two newest templates, independent of the filters. */
  private loadRecent(): void {
    this.recentState.set('loading');
    this.api
      .getPaginated<EvaluationTemplateRow>(API.ADMIN_EVALUATION_TEMPLATES, { per_page: 2, sort: 'created_at', dir: 'desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.recent.set(res.result.data);
          this.recentState.set('ready');
        },
        error: () => this.recentState.set('error'),
      });
  }
}
