import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService, ApiParams } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { mapApiCourseListItem, type ApiCourseRaw } from '../../../../core/utils/course-mapper';
import { AuthService } from '../../../../core/services/auth.service';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasAvatarComponent } from '../../../../shared/nas/nas-avatar/nas-avatar.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
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
  RemoteFilterOptions, activeFilterCount, appliedValues, filterNumbers, filterOne, filterStrings, toFilterOptions,
} from '../../../../shared/list/filter-values';
import { NasDatePipe, NasRelativeTimePipe } from '../../../../shared/pipes/nas-date.pipes';
import { AssignQualificationDialogComponent } from '../../components/assign-qualification-dialog/assign-qualification-dialog.component';
import { LEARNER_TYPES, LearnerRow, LearnerType } from '../../models/learner.model';

interface Query extends PagedQuery {
  readonly instructorIds: readonly number[];
  readonly learnerTypes: readonly LearnerType[];
  readonly courseIds: readonly number[];
  readonly qualificationIds: readonly number[];
  /** Last activity range, local `YYYY-MM-DD`. */
  readonly activeFrom: string | null;
  readonly activeTo: string | null;
}

/** A learner with the qualification bar tone, worked out once per load. */
interface LearnerView extends LearnerRow {
  readonly tone: 'low' | 'mid' | 'full';
}

/**
 * Learners list - Figma 1986:74701 (D3).
 *
 * GET admin/learners (D-075) with the Learners filters (B2/D3, D-053):
 * instructors who teach the learner's courses, learner type, courses,
 * qualifications, and the last-activity range. They live in the Dashboard's
 * one Filter modal (D-070: the frame's chips and From / To pickers moved into
 * it, human 2026-09-30); the Course field searches the server.
 */
@Component({
  selector: 'app-learner-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    NasIconComponent,
    NasAvatarComponent,
    NasPagerComponent,
    NasFilterDialogComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasDatePipe,
    NasRelativeTimePipe,
    AssignQualificationDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './learner-list.component.html',
  styleUrl: './learner-list.component.scss',
})
export class LearnerListComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;
  private readonly auth       = inject(AuthService);

  /** UX only - POST admin/qualification-skills/{id}/learners enforces it. */
  readonly canAssign  = computed(() => this.auth.can('edit-qualifications'));
  readonly assignOpen = signal(false);

  readonly skeletons = SKELETON_ROWS;
  /** Name, id, courses earned, qualification, last certification, last activity, the eye. */
  readonly skeletonCells: readonly NasSkeletonCell[] = ['person', 'short', 'num', 'bar', 'short', 'text', 'action'];

  readonly list = createPagedList<Query, LearnerView>({
    // Figma: "1-15 of 109".
    initial: {
      search: '', page: 1, perPage: 15,
      instructorIds: [], learnerTypes: [], courseIds: [], qualificationIds: [], activeFrom: null, activeTo: null,
    },
    load: q => this.api.getPaginated<LearnerRow>(API.ADMIN_LEARNERS, this.params(q)).pipe(toPaged(r => ({ ...r, tone: tone(r.compliance_pct ?? 0) }))),
  });

  /* ── Filter modal ──────────────────────────────────────────────── */
  readonly filterOpen = signal(false);
  private readonly instructors    = signal<NasFilterFieldOption[]>([]);
  private readonly qualifications = signal<NasFilterFieldOption[]>([]);
  private readonly courseOptions = new RemoteFilterOptions(term =>
    this.api.getPaginated<ApiCourseRaw>(API.COURSES, { per_page: 20, ...(term ? { search: term } : {}) }).pipe(
      map(res => res.result.data.map(c => ({ id: c.id, label: mapApiCourseListItem(c).title }))),
    ));
  private lookupsLoaded = false;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({
      course_instructor_ids: q.instructorIds,
      learner_types: q.learnerTypes,
      course_ids: q.courseIds,
      qualification_ids: q.qualificationIds,
      active_from: q.activeFrom,
      active_to: q.activeTo,
    });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'course_instructor_ids', multiple: true,
        label: this.t.instant('learners.chip.instructors'),
        placeholder: this.t.instant('courses_list.select_instructor'),
        searchPlaceholder: this.t.instant('courses_list.search_instructors'),
        options: this.instructors(),
      },
      {
        // users.learner_type (Online / Offline / Hybrid learner), not a list of learners.
        key: 'learner_types', multiple: true,
        label: this.t.instant('learners.filter_learner_type'),
        placeholder: this.t.instant('learners.select_learner_type'),
        options: LEARNER_TYPES.map(type => ({ id: type, label: this.t.instant(`learners.type.${type}`) })),
      },
      {
        key: 'course_ids', multiple: true, remote: true,
        label: this.t.instant('learners.chip.courses'),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: this.courseOptions.options(),
      },
      {
        key: 'qualification_ids', multiple: true,
        label: this.t.instant('learners.chip.qualification'),
        placeholder: this.t.instant('common.select'),
        options: this.qualifications(),
      },
      {
        key: 'active_from', type: 'date', before: 'active_to', options: [],
        label: this.t.instant('learners.active_from'),
        placeholder: this.t.instant('learners.from'),
      },
      {
        key: 'active_to', type: 'date', after: 'active_from', options: [],
        label: this.t.instant('learners.active_to'),
        placeholder: this.t.instant('learners.to'),
      },
    ];
  });

  /** The current filters without paging, for "everyone matching" in the Assign dialog. */
  readonly filterParams = computed<ApiParams>(() => {
    const { page: _page, per_page: _perPage, ...rest } = this.params(this.list.query());
    return rest;
  });

  constructor() {
    withLocaleReload(() => {
      // Option labels (course titles, qualification names) are localised.
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.list.reload();
    });
  }

  ngOnInit(): void {
    this.list.reload();
  }

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
    const date = (x: string | number | null) => (typeof x === 'string' ? x : null);
    this.list.patch({
      instructorIds: filterNumbers(v['course_instructor_ids']),
      learnerTypes: filterStrings(v['learner_types'], LEARNER_TYPES),
      courseIds,
      qualificationIds: filterNumbers(v['qualification_ids']),
      activeFrom: date(filterOne(v['active_from'])),
      activeTo: date(filterOne(v['active_to'])),
    });
  }

  private loadLookups(): void {
    this.courseOptions.search('');
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    forkJoin({
      instructors: this.api.get<{ instructors: { id: number; name: string }[] }>(`${API.ADMIN_LEARNERS}/filter-options`).pipe(catchError(() => of(null))),
      qualifications: this.api.get<{ id: number; name: string }[]>(API.QUALIFICATIONS_ACTIVE).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ instructors, qualifications }) => {
        // A failed list stays empty and is fetched again the next time.
        if (!instructors || !qualifications) this.lookupsLoaded = false;
        this.instructors.set(toFilterOptions(instructors?.result?.instructors));
        this.qualifications.set(toFilterOptions(qualifications?.result));
      });
  }

  private params(q: Query): ApiParams {
    const p = pagedParams(q);
    withList(p, 'course_instructor_ids', q.instructorIds);
    withList(p, 'learner_types', q.learnerTypes);
    withList(p, 'course_ids', q.courseIds);
    withList(p, 'qualification_ids', q.qualificationIds);
    if (q.activeFrom) p['active_from'] = q.activeFrom;
    if (q.activeTo) p['active_to'] = q.activeTo;
    return p;
  }
}

/** Figma's bar colours: red below half, slate from half, green when complete. */
function tone(pct: number): 'low' | 'mid' | 'full' {
  if (pct >= 100) return 'full';
  if (pct >= 50) return 'mid';
  return 'low';
}
