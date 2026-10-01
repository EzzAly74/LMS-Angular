import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasAvatarComponent, NasStatusBadgeComponent } from '../../../../../../shared/nas';
import type { NasStatusTone } from '../../../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasPagerComponent } from '../../../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterValues,
} from '../../../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../../../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, toPaged, type PagedQuery } from '../../../../../../shared/list/paged-list';
import { activeFilterCount, appliedValues, filterNumbers, filterStrings } from '../../../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../../../shared/pipes/nas-date.pipes';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { Cohort } from '../../../../../../core/models/course.types';
import {
  CourseLearnerRow,
  LearnerProgressStatus,
  progressBand,
} from '../../../../models/course-detail.model';

interface Query extends PagedQuery {
  readonly groupId: number | null;
  readonly status: LearnerProgressStatus | null;
}

/** A learner row with its progress band and status tone, worked out once per load. */
interface LearnerRow extends CourseLearnerRow {
  readonly band: string;
  readonly statusTone: NasStatusTone;
}

const STATUSES: readonly LearnerProgressStatus[] = ['completed', 'in_progress', 'not_started'];

/**
 * Course Details - Learners tab (Figma 2266:129915).
 *
 * Server-side search (name or employee id), filter and paging. Figma's Filter
 * note lists "Learner, Cohort, Status": the learner is the search box beside
 * it, so the dialog holds Cohort and Status. The eye opens the learner profile
 * (Figma note: "Goes to learner profile"), shown only to admins who may open
 * it. The avatar dot is the account status (Q-054).
 */
@Component({
  selector: 'app-course-learners-tab',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    NasAvatarComponent,
    NasStatusBadgeComponent,
    NasPagerComponent,
    NasFilterDialogComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-learners-tab.component.html',
  styleUrl: './course-learners-tab.component.scss',
})
export class CourseLearnersTabComponent implements OnInit {
  private readonly api = inject(CoursesApiService);
  private readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);
  protected readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  readonly cohorts = input<Cohort[]>([]);

  readonly skeletons = SKELETON_ROWS;
  readonly filterOpen = signal(false);
  private readonly langTick = signal(0);

  readonly list = createPagedList<Query, LearnerRow>({
    initial: { search: '', page: 1, perPage: 10, groupId: null, status: null },
    load: q => this.api
      .listLearners(this.courseId(), {
        page: q.page,
        per_page: q.perPage,
        search: q.search || undefined,
        group_id: q.groupId ?? undefined,
        status: q.status ?? undefined,
      })
      .pipe(toPaged(r => ({ ...r, band: progressBand(r.progress), statusTone: statusTone(r.status) }))),
  });

  // Same key the /admin/learners route is gated on (admin-layout.routes.ts).
  readonly canOpenLearner = computed(() => this.auth.hasView('view-learners'));
  readonly columns = computed(() => (this.canOpenLearner() ? 6 : 5));
  /** Learner, cohort, progress, status, enrolled (+ the eye). */
  readonly skeletonCells = computed<readonly NasSkeletonCell[]>(() =>
    this.canOpenLearner() ? ['person', 'text', 'bar', 'pill', 'short', 'action'] : ['person', 'text', 'bar', 'pill', 'short']);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({ group_id: q.groupId, status: q.status });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'group_id',
        label: this.t.instant('course_detail.cohort'),
        placeholder: this.t.instant('course_detail.select_cohort'),
        options: this.cohorts().map(c => ({ id: c.id, label: c.name || this.t.instant('course_detail.unnamed_cohort') })),
      },
      {
        key: 'status',
        label: this.t.instant('course_detail.status'),
        placeholder: this.t.instant('course_detail.select_status'),
        options: STATUSES.map(s => ({ id: s, label: this.t.instant(`course_detail.learner_status.${s}`) })),
      },
    ];
  });

  constructor() {
    // Names and cohort names come localized from the server.
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.list.reload();
    });
  }

  ngOnInit(): void {
    this.list.reload();
  }

  onFilter(values: NasFilterValues): void {
    this.list.patch({
      groupId: filterNumbers(values['group_id'])[0] ?? null,
      status: filterStrings(values['status'], STATUSES)[0] ?? null,
    });
  }
}

function statusTone(s: LearnerProgressStatus): NasStatusTone {
  return s === 'completed' ? 'sky' : s === 'in_progress' ? 'teal' : 'neutral';
}
