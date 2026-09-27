import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, map } from 'rxjs';
import { NasAvatarComponent, NasIconComponent, NasStatusBadgeComponent } from '../../../../../../shared/nas';
import type { NasStatusTone } from '../../../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasPagerComponent } from '../../../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterValues,
} from '../../../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
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

type LoadState = 'loading' | 'ready' | 'error';

interface Query {
  page: number;
  search: string;
  group_id: number | null;
  status: LearnerProgressStatus | null;
}

const PER_PAGE = 10;
const STATUSES: LearnerProgressStatus[] = ['completed', 'in_progress', 'not_started'];

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
    FormsModule,
    RouterLink,
    TranslateModule,
    NasAvatarComponent,
    NasIconComponent,
    NasStatusBadgeComponent,
    NasPagerComponent,
    NasFilterDialogComponent,
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly courseId = input.required<number>();
  readonly cohorts = input<Cohort[]>([]);

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<CourseLearnerRow[]>([]);
  readonly total = signal(0);
  readonly query = signal<Query>({ page: 1, search: '', group_id: null, status: null });
  readonly filterOpen = signal(false);
  private readonly langTick = signal(0);

  readonly perPage = PER_PAGE;
  readonly canOpenLearner = computed(() => this.auth.hasView('view-learners'));

  readonly activeFilters = computed(() => {
    const q = this.query();
    return (q.group_id !== null ? 1 : 0) + (q.status !== null ? 1 : 0);
  });

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

  readonly appliedFilters = computed<NasFilterValues>(() => ({
    group_id: this.query().group_id,
    status: this.query().status,
  }));

  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<Query>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(search => this.update({ search: search.trim(), page: 1 }));

    this.load$
      .pipe(
        switchMap(q =>
          this.api
            .listLearners(this.courseId(), {
              page: q.page,
              per_page: PER_PAGE,
              search: q.search || undefined,
              group_id: q.group_id ?? undefined,
              status: q.status ?? undefined,
            })
            .pipe(
              map(res => ({ ok: true as const, res })),
              catchError(() => of({ ok: false as const })),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(out => {
        if (!out.ok) {
          this.state.set('error');
          return;
        }
        this.rows.set(out.res.result.data);
        this.total.set(out.res.result.total);
        this.state.set('ready');
      });

    // Names and cohort names come localized from the server.
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.reload();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  onFilter(values: NasFilterValues): void {
    this.update({
      page: 1,
      group_id: typeof values['group_id'] === 'number' ? values['group_id'] : null,
      status: (values['status'] as LearnerProgressStatus | null) ?? null,
    });
  }

  goTo(page: number): void {
    this.update({ page });
  }

  reload(): void {
    this.state.set('loading');
    this.load$.next(this.query());
  }

  band(progress: number): string {
    return progressBand(progress);
  }

  statusTone(s: LearnerProgressStatus): NasStatusTone {
    return s === 'completed' ? 'sky' : s === 'in_progress' ? 'teal' : 'neutral';
  }

  hasQuery(): boolean {
    const q = this.query();
    return !!q.search || q.group_id !== null || q.status !== null;
  }

  private update(patch: Partial<Query>): void {
    this.query.update(q => ({ ...q, ...patch }));
    this.reload();
  }
}
