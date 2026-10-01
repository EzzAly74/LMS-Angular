import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, timer } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, type ApiParams } from '../../core/services/api.service';
import { API } from '../../core/constants/api.constants';
import { LocaleService } from '../../core/services/locale.service';
import { pluralKey } from '../../core/utils/plural-key';
import { withLocaleReload } from '../../core/utils/with-locale-reload';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../core/utils/course-mapper';
import { NasIconComponent } from '../nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent, type NasFilterField, type NasFilterFieldOption, type NasFilterValues,
} from '../nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../nas/nas-list-state/nas-list-state.component';
import { NasDatePipe } from '../pipes/nas-date.pipes';
import { createPagedList, pagedParams, toPaged, withList, type PagedQuery } from '../list/paged-list';
import {
  RemoteFilterOptions, activeFilterCount, appliedValues, filterNumbers, filterStrings,
} from '../list/filter-values';
import type {
  AssessmentAttemptRow, AssessmentItemRow, AssessmentListSource, AssessmentOptionRow, AssessmentType,
} from './assessment-list.source';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

/** Passed / Failed (D-065); no choice is "all". */
const RESULTS = ['passed', 'failed'] as const;
type Result = typeof RESULTS[number];

interface AttemptsQuery extends PagedQuery {
  readonly result: Result | null;
  readonly types: readonly AssessmentType[];
  readonly instructorIds: readonly number[];
  readonly learnerIds: readonly number[];
  readonly courseIds: readonly number[];
}

interface ItemView extends AssessmentItemRow {
  readonly cohortLabel: string;
}

interface AttemptView extends AssessmentAttemptRow {
  readonly typeLabel: string;
  readonly submitted: string | null;
}

/**
 * Keys shared by both kinds but living in one kind's namespace: the Pre / Mid
 * / Post labels and Passed / Failed are in `quizzes`, the cohort scope pill in
 * `assignments`. They name the same thing for both, so they are kept once.
 */
const SHARED_KEYS = {
  passed: 'quizzes.passed',
  failed: 'quizzes.failed',
  scopeAll: 'assignments.cohort_scope_all',
  scopeSpecific: 'assignments.cohort_scope_specific',
  type: (t: AssessmentType) => `quizzes.type_${t}`,
  typeLong: (t: AssessmentType) => `quizzes.type_long_${t}`,
} as const;

/**
 * The Quizzes landing (Figma 1983:42584) and the Assignments list, which
 * follows the same frame (there is no separate Assignments list design,
 * Q-046). One component for both, configured by an AssessmentListSource: the
 * two pages used to be line-for-line copies.
 *
 * - "Created" table: the five newest, with Edit / Delete, and "View All".
 * - Attempts table: the shared list (PagedList: debounced search, stale
 *   requests cancelled, error + Retry) with the Dashboard's one filter
 *   pattern, the All Courses Filter button and modal (D-070; the frame's
 *   chips and Passed / Failed checks are replaced, human 2026-09-30): Course
 *   (searched on the server), Instructor, Learner, Type and Result.
 * - The filter lists load the first time the modal opens, not with the page.
 */
@Component({
  selector: 'app-assessment-list',
  standalone: true,
  imports: [
    RouterLink, DialogModule, ConfirmDialogModule, TranslateModule,
    NasIconComponent, NasPagerComponent, NasFilterDialogComponent,
    NasListToolbarComponent, NasTableCardComponent, NasListStateComponent, NasSkeletonRowComponent,
    NasDatePipe,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assessment-list.component.html',
  styleUrl: './assessment-list.component.scss',
})
export class AssessmentListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api        = inject(ApiService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly toast      = inject(ToastService);
  private readonly router     = inject(Router);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  /** Dates follow the UI language (D-051). */
  protected readonly locale   = inject(LocaleService).locale;

  readonly source = input.required<AssessmentListSource>();

  protected readonly shared = SHARED_KEYS;
  protected readonly skeletons = SKELETON_ROWS;
  protected readonly miniSkeletons = [0, 1] as const;
  protected readonly itemCells: readonly NasSkeletonCell[] = ['text', 'text', 'pill', 'num', 'num', 'short', 'action'];
  protected readonly attemptCells: readonly NasSkeletonCell[] = ['text', 'text', 'text', 'text', 'short', 'short', 'short', 'action'];

  /* ── "Created" table: the five newest ──────────────────────────── */
  readonly items = createPagedList<PagedQuery, ItemView>({
    initial: { search: '', page: 1, perPage: 5 },
    load: q => this.source().items({ page: 1, per_page: q.perPage }).pipe(toPaged(r => this.toItem(r))),
  });
  readonly summary = signal<{ items: number; courses: number }>({ items: 0, courses: 0 });
  readonly createdCount = computed(() => {
    const s = this.summary();
    const ns = this.source().ns;
    return {
      itemsKey: pluralKey(`${ns}.count_created`, s.items, this.locale()),
      coursesKey: pluralKey(`${ns}.count_courses`, s.courses, this.locale()),
      items: s.items,
      courses: s.courses,
    };
  });

  /* ── Attempts table ────────────────────────────────────────────── */
  readonly attempts = createPagedList<AttemptsQuery, AttemptView>({
    // Figma 1983:42584 draws ten rows a page.
    initial: { search: '', page: 1, perPage: 10, result: null, types: [], instructorIds: [], learnerIds: [], courseIds: [] },
    load: q => this.source().attempts(this.attemptParams(q)).pipe(toPaged(r => this.toAttempt(r))),
  });

  /* ── Filter modal (the All Courses pattern) ────────────────────── */
  readonly filterOpen = signal(false);
  private readonly instructors = signal<NasFilterFieldOption[]>([]);
  private readonly learners    = signal<NasFilterFieldOption[]>([]);
  /** The Course field searches the server, as on All Courses. */
  private readonly courseOptions = new RemoteFilterOptions(term =>
    this.api.getPaginated<ApiCourseRaw>(API.COURSES, { per_page: 20, ...(term ? { search: term } : {}) }).pipe(
      map(res => res.result.data.map(c => ({ id: c.id, label: mapApiCourseListItem(c).title }))),
    ));
  private peopleLoaded = false;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.attempts.query();
    return appliedValues({
      course_ids: q.courseIds, instructor_ids: q.instructorIds, learner_ids: q.learnerIds, types: q.types, result: q.result,
    });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.attempts.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const ns = this.source().ns;
    return [
      {
        key: 'course_ids', multiple: true, remote: true,
        label: this.t.instant(`${ns}.filter_courses`),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: this.courseOptions.options(),
      },
      {
        key: 'instructor_ids', multiple: true,
        label: this.t.instant(`${ns}.filter_instructors`),
        placeholder: this.t.instant('courses_list.select_instructor'),
        searchPlaceholder: this.t.instant('courses_list.search_instructors'),
        options: this.instructors(),
      },
      {
        key: 'learner_ids', multiple: true,
        label: this.t.instant(`${ns}.filter_learners`),
        placeholder: this.t.instant('course_detail.select_learner'),
        searchPlaceholder: this.t.instant('common.search_learners'),
        options: this.learners(),
      },
      {
        key: 'types', multiple: true,
        label: this.t.instant(`${ns}.filter_type`),
        placeholder: this.t.instant('common.select'),
        options: this.source().types.map(t => ({ id: t, label: this.t.instant(SHARED_KEYS.typeLong(t)) })),
      },
      {
        key: 'result', wide: true,
        label: this.t.instant(`${ns}.result`),
        placeholder: this.t.instant('common.all'),
        options: RESULTS.map(r => ({ id: r, label: this.t.instant(SHARED_KEYS[r]) })),
      },
    ];
  });

  /* ── "View All" dialog: a debounced, stale-safe search ─────────── */
  readonly viewAllOpen     = signal(false);
  readonly viewAllLoading  = signal(false);
  readonly viewAllItems    = signal<readonly AssessmentOptionRow[]>([]);
  readonly viewAllSelected = signal<number | null>(null);
  /** `now`: load at once (the dialog opening); otherwise after the typing pause. */
  private readonly viewAll$ = new Subject<{ term: string; now: boolean }>();

  constructor() {
    // One stream for the opening load and every search: a newer term cancels
    // both the pending pause and the request in flight, so an older answer
    // never replaces a newer one.
    this.viewAll$
      .pipe(
        switchMap(e => timer(e.now ? 0 : 250).pipe(
          switchMap(() => {
            this.viewAllLoading.set(true);
            return this.source().options(e.term || undefined).pipe(catchError(() => of<readonly AssessmentOptionRow[]>([])));
          }),
        )),
        takeUntilDestroyed(),
      )
      .subscribe(list => {
        this.viewAllItems.set(list);
        this.viewAllLoading.set(false);
      });

    // Titles, names and labels come localized: reload what is on screen and
    // drop the filter lists so they are fetched again in the new language.
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.peopleLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.refresh();
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.items.reload();
    this.attempts.reload();
    this.source().summary()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(s => { if (s) this.summary.set({ items: s.items, courses: s.courses }); });
  }

  private attemptParams(q: AttemptsQuery): ApiParams {
    const p = pagedParams(q);
    if (q.result) p['result'] = q.result;
    withList(p, 'types', q.types);
    withList(p, 'instructor_ids', q.instructorIds);
    withList(p, 'learner_ids', q.learnerIds);
    withList(p, 'course_ids', q.courseIds);
    return p;
  }

  /* ── Filter ────────────────────────────────────────────────────── */
  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    if (e.key === 'course_ids') this.courseOptions.search(e.term);
  }

  onFilter(v: NasFilterValues): void {
    const courseIds = filterNumbers(v['course_ids']);
    this.courseOptions.remember(courseIds);
    this.attempts.patch({
      courseIds,
      instructorIds: filterNumbers(v['instructor_ids']),
      learnerIds: filterNumbers(v['learner_ids']),
      types: filterStrings(v['types'], this.source().types),
      result: filterStrings(v['result'], RESULTS)[0] ?? null,
    });
  }

  private loadLookups(): void {
    this.courseOptions.search('');
    if (this.peopleLoaded) return;
    this.peopleLoaded = true;
    forkJoin({
      instructors: this.source().instructors().pipe(catchError(() => of(null))),
      learners: this.source().learners().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ instructors, learners }) => {
        // A failed list stays empty and is fetched again the next time.
        if (!instructors || !learners) this.peopleLoaded = false;
        const opt = (list: readonly { id: number; name: string | null }[] | null) => (list ?? []).map(x => ({ id: x.id, label: x.name ?? `#${x.id}` }));
        this.instructors.set(opt(instructors));
        this.learners.set(opt(learners));
      });
  }

  /* ── Attempts ──────────────────────────────────────────────────── */
  openAttempt(row: AssessmentAttemptRow): void {
    this.router.navigate([this.source().route, 'submissions', row.id]);
  }

  /* ── Permissions (D-073) ───────────────────────────────────────── */
  private readonly section = computed(() => (this.source().kind === 'quiz' ? 'quizzes' : 'assignments'));
  readonly canCreate = computed(() => this.auth.canDo(this.section(), 'create'));
  readonly canEdit = computed(() => this.auth.canDo(this.section(), 'edit'));
  readonly canDelete = computed(() => this.auth.canDo(this.section(), 'delete'));

  /* ── "Created" table ───────────────────────────────────────────── */
  editItem(row: AssessmentItemRow, event?: Event): void {
    event?.stopPropagation();
    if (!this.canEdit()) return;
    this.router.navigate([this.source().route, row.id, 'edit']);
  }

  confirmDelete(row: AssessmentItemRow, event: Event): void {
    event.stopPropagation();
    if (!this.canDelete()) return;
    const toastNs = this.source().toastNs;
    this.confirm.confirm({
      message: this.t.instant('confirm.delete_message_title', { title: row.title }),
      header: this.t.instant(`${toastNs}.delete_title`),
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-secondary p-button-sm',
      accept: () => {
        this.source().remove(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.toast.success(this.t.instant(`${toastNs}.deleted`));
            this.refresh();
          },
        });
      },
    });
  }

  /* ── "View All" ────────────────────────────────────────────────── */
  openViewAll(): void {
    this.viewAllSelected.set(null);
    this.viewAllOpen.set(true);
    this.viewAll$.next({ term: '', now: true });
  }

  onViewAllSearch(term: string): void { this.viewAll$.next({ term: term.trim(), now: false }); }

  selectViewAllItem(row: AssessmentOptionRow): void {
    this.viewAllSelected.set(this.viewAllSelected() === row.id ? null : row.id);
  }

  confirmViewAll(): void {
    const id = this.viewAllSelected();
    if (!id) return;
    this.viewAllOpen.set(false);
    this.router.navigate([this.source().route, id, 'edit']);
  }

  /* ── Rows ──────────────────────────────────────────────────────── */
  private toItem(r: AssessmentItemRow): ItemView {
    let cohortLabel: string;
    if (r.cohort_scope === 'all') cohortLabel = this.t.instant(SHARED_KEYS.scopeAll);
    else {
      const titles = r.cohorts.map(c => c.title).filter((x): x is string => !!x);
      cohortLabel = titles.length ? titles.join(', ') : this.t.instant(SHARED_KEYS.scopeSpecific);
    }
    return { ...r, cohortLabel };
  }

  private toAttempt(r: AssessmentAttemptRow): AttemptView {
    return {
      ...r,
      typeLabel: r.item_type ? this.t.instant(SHARED_KEYS.type(r.item_type)) : '—',
      submitted: r.submitted_at ?? r.created_at,
    };
  }
}
