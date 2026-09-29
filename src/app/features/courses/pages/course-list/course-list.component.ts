import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewChild,
  computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OverlayPanelModule, OverlayPanel } from 'primeng/overlaypanel';
import { SkeletonModule } from 'primeng/skeleton';
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
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { CourseDialogComponent } from '../../components/course-dialog/course-dialog.component';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';
import type { LookupOption } from '../../models/course-form.model';
import type { Course, CourseStatus, CourseType } from '../../../../core/models/course.types';

/** Statuses the list filters on (the backend's derived course status). */
const FILTER_STATUSES = ['active', 'upcoming', 'inactive'] as const;
type FilterStatus = typeof FILTER_STATUSES[number];

/** Bands of the /5 evaluation score (CourseIndexRequest::EVALUATION_BANDS). */
const EVALUATION_BANDS = ['high', 'mid', 'low', 'none'] as const;
type EvaluationBand = typeof EVALUATION_BANDS[number];

/** Scores below this read as failing (config evaluations.pass_threshold). */
const PASS_THRESHOLD = 3;

interface Query {
  readonly search: string;
  readonly page: number;
  readonly perPage: number;
  readonly ids: readonly number[];
  readonly categoryIds: readonly number[];
  readonly instructorIds: readonly number[];
  readonly statuses: readonly FilterStatus[];
  readonly evaluation: readonly EvaluationBand[];
}

const PER_PAGE = 15;
/** "Show All" loads one page of up to the API's ceiling (B-21). */
const SHOW_ALL_PER_PAGE = 200;

const EMPTY_QUERY: Query = {
  search: '', page: 1, perPage: PER_PAGE,
  ids: [], categoryIds: [], instructorIds: [], statuses: [], evaluation: [],
};

type LoadState = 'loading' | 'ready' | 'error';

/**
 * All Courses (Figma 2393:123975): a search box and a Filter button over the
 * course table, the Figma pager with "Show All", and the Filter modal
 * (2430:135164) whose Course list searches the server (2430:134497).
 */
@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, RouterLink, TranslateModule, OverlayPanelModule, SkeletonModule,
    NasIconComponent, NasStatusBadgeComponent, NasPagerComponent, NasFilterDialogComponent,
    NasDatePipe, CourseDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit {
  @ViewChild('rowMenu') rowMenu!: OverlayPanel;

  private readonly api        = inject(ApiService);
  private readonly enums      = inject(EnumsService);
  private readonly router     = inject(Router);
  private readonly route      = inject(ActivatedRoute);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale             = inject(LocaleService).locale;

  readonly items   = signal<Course[]>([]);
  readonly total   = signal(0);
  readonly state   = signal<LoadState>('loading');
  readonly query   = signal<Query>(EMPTY_QUERY);
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  readonly activeRow = signal<Course | null>(null);

  /* Add / Edit Course modal (D6) - null course id = Add. */
  readonly dialogOpen     = signal(false);
  readonly dialogCourseId = signal<number | null>(null);

  /* Filter modal and its option lists (loaded the first time it opens). */
  readonly filterOpen = signal(false);
  private readonly categories  = signal<NasFilterFieldOption[]>([]);
  private readonly instructors = signal<NasFilterFieldOption[]>([]);
  /** The Course field's current server matches. */
  private readonly courseMatches = signal<NasFilterFieldOption[]>([]);
  /** Labels of chosen courses, so a choice keeps its name when a later search does not return it. */
  private readonly chosenCourses = signal<NasFilterFieldOption[]>([]);
  private lookupsLoaded = false;

  /** Bumps on every locale switch so translated field labels re-read. */
  private readonly langTick = signal(0);

  private readonly search$      = new Subject<string>();
  private readonly courseTerm$  = new Subject<string>();
  private readonly load$        = new Subject<Query>();

  readonly activeFilters = computed(() => {
    const q = this.query();
    return [q.ids, q.categoryIds, q.instructorIds, q.statuses, q.evaluation].filter(v => v.length > 0).length;
  });

  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const statusLabels = new Map(this.enums.options('course_status')().map(o => [o.code, o.value]));
    const chosen = this.chosenCourses();
    const matches = this.courseMatches().filter(m => !chosen.some(c => c.id === m.id));

    return [
      {
        key: 'ids', multiple: true, remote: true,
        label: this.t.instant('courses_list.filter_course'),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: [...chosen, ...matches],
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

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.query();
    return {
      ids: q.ids.length ? q.ids : null,
      category_ids: q.categoryIds.length ? q.categoryIds : null,
      instructor_ids: q.instructorIds.length ? q.instructorIds : null,
      evaluation: q.evaluation.length ? q.evaluation : null,
      statuses: q.statuses.length ? q.statuses : null,
    };
  });

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.load$.next(this.query());
    });

    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(search => this.update({ search: search.trim(), page: 1 }));

    // switchMap: a newer query cancels the older request, so a slow response
    // can never overwrite the rows of a later search or page.
    this.load$
      .pipe(
        switchMap(q => {
          this.state.set('loading');
          return this.api.getPaginated<ApiCourseRaw>(API.COURSES, this.params(q)).pipe(
            map(res => ({ ok: true as const, res })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(r => {
        if (!r.ok) { this.state.set('error'); return; }
        this.items.set(r.res.result.data.map(c => mapApiCourseListItem(c)));
        this.total.set(r.res.result.total);
        this.state.set('ready');
      });

    this.courseTerm$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(term => this.api.getPaginated<ApiCourseRaw>(API.COURSES, { per_page: 20, ...(term ? { search: term } : {}) }).pipe(
          map(res => res.result.data.map(c => ({ id: c.id, label: mapApiCourseListItem(c).title }))),
          catchError(() => of<NasFilterFieldOption[]>([])),
        )),
        takeUntilDestroyed(),
      )
      .subscribe(options => this.courseMatches.set(options));
  }

  ngOnInit(): void {
    this.load$.next(this.query());

    // The dashboard's "Add Course" lands here with ?new=1: open the modal,
    // then drop the flag so Back / refresh don't reopen it.
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.openAddCourse();
      this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, replaceUrl: true });
    }
  }

  /* ── Query ────────────────────────────────────────────────────────── */
  private update(patch: Partial<Query>): void {
    this.query.update(q => ({ ...q, ...patch }));
    this.load$.next(this.query());
  }

  private params(q: Query): ApiParams {
    const p: ApiParams = { page: q.page, per_page: q.perPage };
    if (q.search) p['search'] = q.search;
    if (q.ids.length) p['ids'] = [...q.ids];
    if (q.categoryIds.length) p['category_ids'] = [...q.categoryIds];
    if (q.instructorIds.length) p['instructor_ids'] = [...q.instructorIds];
    if (q.statuses.length) p['statuses'] = [...q.statuses];
    if (q.evaluation.length) p['evaluation'] = [...q.evaluation];
    return p;
  }

  onSearch(value: string): void { this.search$.next(value); }

  reload(): void { this.load$.next(this.query()); }

  goTo(page: number): void { this.update({ page }); }

  showAll(): void { this.update({ page: 1, perPage: SHOW_ALL_PER_PAGE }); }

  /* ── Filter ───────────────────────────────────────────────────────── */
  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    if (e.key === 'ids') this.courseTerm$.next(e.term);
  }

  onFilter(values: NasFilterValues): void {
    const ids = numbers(values['ids']);
    // Keep the names of the chosen courses for the next time the modal opens.
    const known = new Map([...this.chosenCourses(), ...this.courseMatches()].map(o => [o.id, o]));
    this.chosenCourses.set(ids.map(id => known.get(id)).filter((o): o is NasFilterFieldOption => !!o));

    this.update({
      page: 1,
      ids,
      categoryIds: numbers(values['category_ids']),
      instructorIds: numbers(values['instructor_ids']),
      statuses: strings(values['statuses']).filter((s): s is FilterStatus => (FILTER_STATUSES as readonly string[]).includes(s)),
      evaluation: strings(values['evaluation']).filter((s): s is EvaluationBand => (EVALUATION_BANDS as readonly string[]).includes(s)),
    });
  }

  private loadLookups(): void {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.courseTerm$.next('');
    forkJoin({
      categories: this.api.get<LookupOption[]>(API.CATEGORIES_ACTIVE).pipe(catchError(() => of(null))),
      instructors: this.api.get<LookupOption[]>(API.INSTRUCTORS_ALL).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, instructors }) => {
        // A failed list stays empty and is fetched again the next time.
        if (!categories || !instructors) this.lookupsLoaded = false;
        this.categories.set(toOptions(categories?.result));
        this.instructors.set(toOptions(instructors?.result));
      });
  }

  /* ── Row menu ─────────────────────────────────────────────────────── */
  openRowMenu(ev: Event, course: Course): void {
    ev.stopPropagation();
    this.activeRow.set(course);
    this.rowMenu.toggle(ev);
  }

  goToDetail(course: Course): void {
    this.rowMenu?.hide();
    this.router.navigate(['/admin/courses', course.id]);
  }

  /** Edit Course from the row menu: the same modal as Add, filled in. */
  editCourse(course: Course): void {
    this.rowMenu.hide();
    this.dialogCourseId.set(course.id);
    this.dialogOpen.set(true);
  }

  openAddCourse(): void {
    this.dialogCourseId.set(null);
    this.dialogOpen.set(true);
  }

  onCourseSaved(): void { this.reload(); }

  /* ── Cells ────────────────────────────────────────────────────────── */
  /** Completion bar colour (Figma: green from 80 %, blue from 50 %, red below). */
  completionBand(value: number): 'full' | 'mid' | 'low' {
    return value >= 80 ? 'full' : value >= 50 ? 'mid' : 'low';
  }

  isFailingScore(score: number): boolean { return score < PASS_THRESHOLD; }

  statusTone(status: CourseStatus | undefined): NasStatusTone {
    switch (status) {
      case 'active':   return 'success';
      case 'pending':  return 'info';
      case 'upcoming': return 'warning';
      case 'inactive': return 'danger';
      default:         return 'neutral';
    }
  }

  statusLabel(status: CourseStatus | undefined): string {
    switch (status) {
      case 'active':   return this.t.instant('common.active');
      case 'pending':  return this.t.instant('courses.status_pending');
      case 'upcoming': return this.t.instant('courses.status_upcoming');
      case 'inactive': return this.t.instant('common.inactive');
      default:         return '';
    }
  }

  /** Figma 2556:151385: Hybrid green, Online teal, Offline grey, External link orange. */
  typeTone(type: CourseType | undefined): NasStatusTone {
    switch (type) {
      case 'online':        return 'teal';
      case 'hybrid':        return 'success';
      case 'external_link': return 'warning';
      default:              return 'neutral';
    }
  }

  typeLabel(type: CourseType | undefined): string {
    switch (type) {
      case 'online':        return this.t.instant('courses.type_online');
      case 'offline':       return this.t.instant('courses.type_offline');
      case 'hybrid':        return this.t.instant('courses.type_hybrid');
      case 'external_link': return this.t.instant('courses.type_external_link');
      default:              return '';
    }
  }
}

function numbers(v: NasFilterValues[string]): number[] {
  const list = Array.isArray(v) ? v : v === null || v === undefined ? [] : [v];
  return list.filter((x): x is number => typeof x === 'number');
}

function strings(v: NasFilterValues[string]): string[] {
  const list = Array.isArray(v) ? v : v === null || v === undefined ? [] : [v];
  return list.map(x => String(x));
}

function toOptions(list: LookupOption[] | null | undefined): NasFilterFieldOption[] {
  return (list ?? []).map(o => ({ id: o.id, label: o.name }));
}
