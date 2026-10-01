import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, type ApiParams } from '../../../../core/services/api.service';
import { EnumsService } from '../../../../core/services/enums.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent, NasStatusBadgeComponent, NasStatusTone } from '../../../../shared/nas';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent,
  type NasFilterField,
  type NasFilterFieldOption,
  type NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import {
  NasRowMenuComponent, type NasRowAction, type NasRowActionPick,
} from '../../../../shared/nas/nas-row-menu/nas-row-menu.component';
import { createPagedList, pagedParams, toPaged, withList, type PagedQuery } from '../../../../shared/list/paged-list';
import {
  RemoteFilterOptions, activeFilterCount, appliedValues, filterNumbers, filterStrings, toFilterOptions,
} from '../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { CourseDialogComponent } from '../../components/course-dialog/course-dialog.component';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';
import type { LookupOption } from '../../models/course-form.model';
import type { Course, CourseStatus, CourseType } from '../../../../core/models/course.types';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { AuthService } from '../../../../core/services/auth.service';

/** Statuses the list filters on (the backend's derived course status). */
const FILTER_STATUSES = ['active', 'upcoming', 'inactive'] as const;
type FilterStatus = typeof FILTER_STATUSES[number];

/** Bands of the /5 evaluation score (CourseIndexRequest::EVALUATION_BANDS). */
const EVALUATION_BANDS = ['high', 'mid', 'low', 'none'] as const;
type EvaluationBand = typeof EVALUATION_BANDS[number];

/** Scores below this read as failing (config evaluations.pass_threshold). */
const PASS_THRESHOLD = 3;

interface Query extends PagedQuery {
  readonly ids: readonly number[];
  readonly categoryIds: readonly number[];
  readonly instructorIds: readonly number[];
  readonly statuses: readonly FilterStatus[];
  readonly evaluation: readonly EvaluationBand[];
}

/** A course with the cell values the table shows, worked out once per load. */
interface CourseRow extends Course {
  readonly typeTone: NasStatusTone;
  readonly typeLabel: string;
  readonly statusTone: NasStatusTone;
  readonly statusLabel: string;
  readonly completion: number;
  readonly completionBand: 'full' | 'mid' | 'low';
  readonly failing: boolean;
}

type RowActionId = 'view' | 'edit';

/**
 * All Courses (Figma 2393:123975): a search box and a Filter button over the
 * course table, the Figma pager with "Show All", and the Filter modal
 * (2430:135164) whose Course list searches the server (2430:134497).
 *
 * This is the reference list of the Dashboard: its toolbar, table card,
 * states, pager and row menu are the shared nas-list-toolbar, nas-table-card,
 * nas-list-state, nas-pager and nas-row-menu, and its loading is PagedList.
 */
@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [NasCanDirective, 
    DecimalPipe, RouterLink, TranslateModule,
    NasIconComponent, NasStatusBadgeComponent, NasPagerComponent, NasFilterDialogComponent,
    NasListToolbarComponent, NasTableCardComponent, NasListStateComponent, NasSkeletonRowComponent, NasRowMenuComponent,
    NasDatePipe, CourseDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api    = inject(ApiService);
  private readonly enums  = inject(EnumsService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);
  private readonly t      = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale         = inject(LocaleService).locale;

  readonly skeletons = SKELETON_ROWS;
  /** Course, category, instructor, cohorts, enrolled, completion, evaluation, status, actions. */
  readonly skeletonCells: readonly NasSkeletonCell[] = ['title', 'text', 'text', 'num', 'num', 'bar', 'short', 'pill', 'action'];

  readonly list = createPagedList<Query, CourseRow>({
    initial: { search: '', page: 1, perPage: 15, ids: [], categoryIds: [], instructorIds: [], statuses: [], evaluation: [] },
    load: q => this.api.getPaginated<ApiCourseRaw>(API.COURSES, this.params(q)).pipe(toPaged(c => this.toRow(mapApiCourseListItem(c)))),
  });

  /* Add / Edit Course modal (D6) - null course id = Add. */
  readonly dialogOpen     = signal(false);
  readonly dialogCourseId = signal<number | null>(null);

  /* Filter modal and its option lists (loaded the first time it opens). */
  readonly filterOpen = signal(false);
  private readonly categories  = signal<NasFilterFieldOption[]>([]);
  private readonly instructors = signal<NasFilterFieldOption[]>([]);
  /** The Course field searches the server (2430:134497). */
  private readonly courseOptions = new RemoteFilterOptions(term =>
    this.api.getPaginated<ApiCourseRaw>(API.COURSES, { per_page: 20, ...(term ? { search: term } : {}) }).pipe(
      map(res => res.result.data.map(c => ({ id: c.id, label: mapApiCourseListItem(c).title }))),
    ));
  private lookupsLoaded = false;

  /** Bumps on every locale switch so translated field labels re-read. */
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({
      ids: q.ids, category_ids: q.categoryIds, instructor_ids: q.instructorIds, evaluation: q.evaluation, statuses: q.statuses,
    });
  });

  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const statusLabels = new Map(this.enums.options('course_status')().map(o => [o.code, o.value]));

    return [
      {
        key: 'ids', multiple: true, remote: true,
        label: this.t.instant('courses_list.filter_course'),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: this.courseOptions.options(),
      },
      {
        key: 'category_ids', multiple: true,
        label: this.t.instant('courses_list.filter_category'),
        placeholder: this.t.instant('courses_list.select_category'),
        searchPlaceholder: this.t.instant('courses_list.search_categories'),
        options: this.categories(),
      },
      {
        key: 'instructor_ids', multiple: true,
        label: this.t.instant('courses_list.filter_instructor'),
        placeholder: this.t.instant('courses_list.select_instructor'),
        searchPlaceholder: this.t.instant('courses_list.search_instructors'),
        options: this.instructors(),
      },
      {
        key: 'evaluation', multiple: true,
        label: this.t.instant('courses_list.filter_evaluation'),
        placeholder: this.t.instant('courses_list.select_evaluation'),
        options: EVALUATION_BANDS.map(b => ({ id: b, label: this.t.instant(`courses_list.eval_${b}`) })),
      },
      {
        key: 'statuses', multiple: true, wide: true,
        label: this.t.instant('courses_list.filter_status'),
        placeholder: this.t.instant('courses_list.select_status'),
        options: FILTER_STATUSES.map(s => ({ id: s, label: statusLabels.get(s) ?? this.statusLabel(s) })),
      },
    ];
  });

  /** Row menu entries: the same for every course. */
  readonly rowActions = (_row: CourseRow): readonly NasRowAction<RowActionId>[] => [
    { id: 'view', label: this.t.instant('dashboard.view_details'), icon: 'eye' },
    ...(this.auth.can('edit-courses')
      ? [{ id: 'edit' as const, label: this.t.instant('dashboard.edit_course'), icon: 'assets/icons/figma/pencil-simple.svg' }]
      : []),
  ];

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.list.reload();
    });
  }

  ngOnInit(): void {
    this.list.reload();

    // The dashboard's "Add Course" lands here with ?new=1: open the modal,
    // then drop the flag so Back / refresh don't reopen it.
    if (this.route.snapshot.queryParamMap.get('new') === '1' && this.auth.can('create-courses')) {
      this.openAddCourse();
      this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, replaceUrl: true });
    }
  }

  private params(q: Query): ApiParams {
    const p = pagedParams(q);
    withList(p, 'ids', q.ids);
    withList(p, 'category_ids', q.categoryIds);
    withList(p, 'instructor_ids', q.instructorIds);
    withList(p, 'statuses', q.statuses);
    withList(p, 'evaluation', q.evaluation);
    return p;
  }

  /* ── Filter ───────────────────────────────────────────────────────── */
  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    if (e.key === 'ids') this.courseOptions.search(e.term);
  }

  onFilter(values: NasFilterValues): void {
    const ids = filterNumbers(values['ids']);
    this.courseOptions.remember(ids);
    this.list.patch({
      ids,
      categoryIds: filterNumbers(values['category_ids']),
      instructorIds: filterNumbers(values['instructor_ids']),
      statuses: filterStrings(values['statuses'], FILTER_STATUSES),
      evaluation: filterStrings(values['evaluation'], EVALUATION_BANDS),
    });
  }

  private loadLookups(): void {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.courseOptions.search('');
    forkJoin({
      categories: this.api.get<LookupOption[]>(API.CATEGORIES_ACTIVE).pipe(catchError(() => of(null))),
      instructors: this.api.get<LookupOption[]>(API.INSTRUCTORS_ALL).pipe(catchError(() => of(null))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ categories, instructors }) => {
      // A failed list stays empty and is fetched again the next time.
      if (!categories || !instructors) this.lookupsLoaded = false;
      this.categories.set(toFilterOptions(categories?.result));
      this.instructors.set(toFilterOptions(instructors?.result));
    });
  }

  /* ── Rows ─────────────────────────────────────────────────────────── */
  onRowAction(e: NasRowActionPick<CourseRow, RowActionId>): void {
    if (e.id === 'view') this.goToDetail(e.row);
    else this.editCourse(e.row);
  }

  goToDetail(course: Course): void {
    this.router.navigate(['/admin/courses', course.id]);
  }

  /** Edit Course from the row menu: the same modal as Add, filled in. */
  editCourse(course: Course): void {
    this.dialogCourseId.set(course.id);
    this.dialogOpen.set(true);
  }

  openAddCourse(): void {
    this.dialogCourseId.set(null);
    this.dialogOpen.set(true);
  }

  onCourseSaved(): void { this.list.reload(); }

  /* ── Cells ────────────────────────────────────────────────────────── */
  private toRow(c: Course): CourseRow {
    const completion = c.completion_percent ?? 0;
    return {
      ...c,
      typeTone: this.typeTone(c.type),
      typeLabel: this.typeLabel(c.type),
      statusTone: this.statusTone(c.status),
      statusLabel: this.statusLabel(c.status),
      completion,
      // Figma: green from 80 %, blue from 50 %, red below.
      completionBand: completion >= 80 ? 'full' : completion >= 50 ? 'mid' : 'low',
      failing: c.evaluation_score !== null && c.evaluation_score !== undefined && c.evaluation_score < PASS_THRESHOLD,
    };
  }

  private statusTone(status: CourseStatus | undefined): NasStatusTone {
    switch (status) {
      case 'active':   return 'success';
      case 'pending':  return 'info';
      case 'upcoming': return 'warning';
      case 'inactive': return 'danger';
      default:         return 'neutral';
    }
  }

  private statusLabel(status: CourseStatus | undefined): string {
    switch (status) {
      case 'active':   return this.t.instant('common.active');
      case 'pending':  return this.t.instant('courses.status_pending');
      case 'upcoming': return this.t.instant('courses.status_upcoming');
      case 'inactive': return this.t.instant('common.inactive');
      default:         return '';
    }
  }

  /** Figma 2556:151385: Hybrid green, Online teal, Offline grey, External link orange. */
  private typeTone(type: CourseType | undefined): NasStatusTone {
    switch (type) {
      case 'online':        return 'teal';
      case 'hybrid':        return 'success';
      case 'external_link': return 'warning';
      default:              return 'neutral';
    }
  }

  private typeLabel(type: CourseType | undefined): string {
    switch (type) {
      case 'online':        return this.t.instant('courses.type_online');
      case 'offline':       return this.t.instant('courses.type_offline');
      case 'hybrid':        return this.t.instant('courses.type_hybrid');
      case 'external_link': return this.t.instant('courses.type_external_link');
      default:              return '';
    }
  }
}
