import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';
import { NasTabsComponent, NasTab, NasStatusBadgeComponent } from '../../../../shared/nas';
import { NasStatTileComponent } from '../../../../shared/nas/nas-stat-tile/nas-stat-tile.component';
import type { NasStatusTone } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { CoursesApiService } from '../../services/courses-api.service';
import { CourseDialogComponent } from '../../components/course-dialog/course-dialog.component';
import { EnumsService } from '../../../../core/services/enums.service';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { pluralKey } from '../../../../core/utils/plural-key';
import type { CourseDetail, Cohort } from '../../../../core/models/course.types';
import {
  mapApiCourseDetail,
  mapApiCohort,
  type ApiCourseRaw,
  type ApiCohortRaw,
} from '../../../../core/utils/course-mapper';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { CourseOverviewTabComponent } from './tabs/overview/course-overview-tab.component';
import { CourseCohortsTabComponent } from './tabs/cohorts/course-cohorts-tab.component';
import { CourseLearnersTabComponent } from './tabs/learners/course-learners-tab.component';
import { CourseContentTabComponent } from './tabs/content/course-content-tab.component';
import { CourseSubmissionsTabComponent } from './tabs/submissions/course-submissions-tab.component';
import { CourseQualificationsTabComponent } from './tabs/qualifications/course-qualifications-tab.component';
import { CourseEvaluationsTabComponent } from './tabs/evaluations/course-evaluations-tab.component';

export type { CourseDetail, Cohort };

export type DetailTab =
  | 'overview'
  | 'cohort'
  | 'learners'
  | 'content'
  | 'quizzes'
  | 'assignments'
  | 'qualifications'
  | 'evaluations';

const TABS: readonly DetailTab[] = ['overview', 'cohort', 'learners', 'content', 'quizzes', 'assignments', 'qualifications', 'evaluations'];

/** The tabs that need a permission beyond view-courses, and which one. */
const TAB_VIEW_KEY: Partial<Record<DetailTab, string>> = {
  quizzes: 'view-quizzes',
  assignments: 'view-assignments',
  evaluations: 'view-evaluations',
};

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Course Details (D2, Figma 2266:128868): breadcrumb, header, the four stat
 * tiles, the tab pills and the active tab. Each tab is its own component that
 * loads its own data (DB-15: this page was a 1,400-line component). The page
 * keeps the course and its cohorts, which the header and several tabs share.
 *
 * The active tab is the `?tab=` query parameter, so a submission's back link
 * and a browser refresh return to it. Quizzes, Assignments and Evaluations
 * are listed only for an admin holding their view permission; the server
 * enforces the same permissions on their endpoints.
 */
@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    SkeletonModule,
    NasTabsComponent,
    NasStatusBadgeComponent,
    NasStatTileComponent,
    NasDatePipe,
    CourseDialogComponent,
    CourseOverviewTabComponent,
    CourseCohortsTabComponent,
    CourseLearnersTabComponent,
    CourseContentTabComponent,
    CourseSubmissionsTabComponent,
    CourseQualificationsTabComponent,
    CourseEvaluationsTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
})
export class CourseDetailComponent {
  private readonly coursesApi = inject(CoursesApiService);
  private readonly enums = inject(EnumsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  /** Route param and `?tab=`, bound by withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly tab = input<string | undefined>();

  readonly courseId = computed(() => {
    const n = Number(this.id());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  readonly state = signal<LoadState>('loading');
  readonly course = signal<CourseDetail | null>(null);
  readonly cohorts = signal<Cohort[]>([]);
  /** The Content tab's own count once it has loaded, fresher than the course's. */
  readonly modulesCount = signal<number | null>(null);

  readonly showEdit = signal(false);

  /** Bumped on every locale switch: `instant()` below is not signal-tracked. */
  private readonly langTick = signal(0);

  readonly visibleTabs = computed<DetailTab[]>(() =>
    TABS.filter(t => !TAB_VIEW_KEY[t] || this.auth.hasView(TAB_VIEW_KEY[t])),
  );

  readonly activeTab = computed<DetailTab>(() => {
    const wanted = this.tab() as DetailTab | undefined;
    return wanted && this.visibleTabs().includes(wanted) ? wanted : 'overview';
  });

  readonly tabs = computed<NasTab[]>(() => {
    this.langTick();
    const c = this.course();
    const counts: Record<DetailTab, number | string | null> = {
      overview: null,
      cohort: this.cohorts().length,
      learners: c?.enrolled_count ?? 0,
      content: this.modulesCount() ?? c?.modules_count ?? 0,
      quizzes: c?.quiz_submissions_count ?? 0,
      assignments: c?.assignment_submissions_count ?? 0,
      qualifications: c?.qualifications?.length ?? 0,
      evaluations: c?.evaluation_score != null ? c.evaluation_score.toFixed(1) : null,
    };
    return this.visibleTabs().map(id => ({ id, label: this.t.instant(`course_detail.tab_${id}`), count: counts[id] }));
  });

  readonly typeLabel = computed(() => this.enumLabel('course_type', this.course()?.type));
  readonly statusLabel = computed(() => this.enumLabel('course_status', this.course()?.status));

  /** "4.3", or null when nobody has evaluated the course. */
  readonly scoreValue = computed(() => {
    const s = this.course()?.evaluation_score;
    return s === null || s === undefined ? null : s.toFixed(1);
  });

  readonly completion = computed(() => Math.max(0, Math.min(100, this.course()?.completion_percent ?? 0)));

  constructor() {
    effect(() => {
      const id = this.courseId();
      untracked(() => (id === null ? this.state.set('not-found') : this.load(id)));
    }, { allowSignalWrites: true });

    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      const id = this.courseId();
      if (id !== null && this.state() === 'ready') this.load(id, true);
    });
  }

  load(id: number, quiet = false): void {
    if (!quiet) this.state.set('loading');
    forkJoin({
      course: this.coursesApi.getById(id),
      cohorts: this.coursesApi.listCohorts(id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ course, cohorts }) => {
          this.course.set(mapApiCourseDetail(course.result as unknown as ApiCourseRaw));
          this.cohorts.set(Array.isArray(cohorts.result) ? (cohorts.result as unknown as ApiCohortRaw[]).map(mapApiCohort) : []);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          if (quiet) return;
          this.state.set(err instanceof HttpErrorResponse && err.status === 404 ? 'not-found' : 'error');
        },
      });
  }

  retry(): void {
    const id = this.courseId();
    if (id !== null) this.load(id);
  }

  setTab(id: string): void {
    void this.router.navigate([], {
      queryParams: { tab: id === 'overview' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** A child tab changed data the header or other tabs show (cohorts, enrolment counts). */
  refresh(): void {
    const id = this.courseId();
    if (id !== null) this.load(id, true);
  }

  onCourseSaved(): void {
    this.refresh();
  }

  learnersActiveKey(): string {
    return pluralKey('course_detail.n_active', this.course()?.in_progress_count ?? 0, this.locale());
  }

  reviewsKey(): string {
    return pluralKey('course_detail.evaluation_reviews', this.course()?.evaluation_submissions ?? 0, this.locale());
  }

  typeTone(s?: string): NasStatusTone {
    return s === 'hybrid' ? 'success' : s === 'online' ? 'teal' : s === 'external_link' ? 'sky' : 'neutral';
  }

  statusTone(s?: string): NasStatusTone {
    switch (s) {
      case 'active':
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'upcoming':
        return 'info';
      case 'inactive':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  private enumLabel(name: 'course_type' | 'course_status', code: string | undefined): string {
    if (!code) return '';
    return this.enums.options(name)().find(o => o.code === code)?.value ?? code;
  }
}
