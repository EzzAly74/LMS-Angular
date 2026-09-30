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
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { NasStatusBadgeComponent } from '../../../../../../shared/nas';
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
import { ApiService } from '../../../../../../core/services/api.service';
import { API } from '../../../../../../core/constants/api.constants';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { Cohort } from '../../../../../../core/models/course.types';
import type { CourseSubmissionRow, IdName } from '../../../../models/course-detail.model';

export type SubmissionKind = 'quiz' | 'assignment';

const STATUSES = ['graded', 'pending'] as const;
type SubmissionStatus = typeof STATUSES[number];

interface Query extends PagedQuery {
  readonly sectionId: number | null;
  readonly learnerId: number | null;
  readonly instructorId: number | null;
  readonly itemId: number | null;
  readonly status: SubmissionStatus | null;
}

interface FilterOptions {
  learners: IdName[];
  instructors: IdName[];
  items: IdName[];
}

/** A submission with its title, score colour and link, worked out once per load. */
interface SubmissionRow extends CourseSubmissionRow {
  readonly title: string;
  readonly scoreClass: 'cl-pass' | 'cl-fail' | 'cl-neutral-score';
  readonly link: string[];
  readonly submitted: string | null;
}

/**
 * Course Details - Quizzes (Figma 2295:53311, filter 2295:52815) and
 * Assignments (2294:51575) tabs: the admin submission lists for one course
 * (D-028). The eye opens the existing submission page.
 *
 * Filters follow the Figma notes - Quizzes: Learner, Cohort, Instructor,
 * Quiz; Assignments: Learner, Instructor, Assignment, Cohort, Status (the
 * Course field is dropped inside one course, Q-050). The choices come from
 * the course's own submissions, so none can return nothing. The score is
 * green when it meets the item's pass score, red when it does not (Q-031),
 * and neutral when the item sets none.
 */
@Component({
  selector: 'app-course-submissions-tab',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
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
  templateUrl: './course-submissions-tab.component.html',
  styleUrl: './course-submissions-tab.component.scss',
})
export class CourseSubmissionsTabComponent implements OnInit {
  private readonly courses = inject(CoursesApiService);
  private readonly api = inject(ApiService);
  private readonly t = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly kind = input.required<SubmissionKind>();
  readonly courseId = input.required<number>();
  readonly cohorts = input<Cohort[]>([]);

  readonly skeletons = SKELETON_ROWS;
  /** Learner, three text columns, submitted, score, attempts / status, the eye. */
  readonly skeletonCells: readonly NasSkeletonCell[] = ['text', 'text', 'text', 'text', 'short', 'short', 'num', 'action'];
  readonly options = signal<FilterOptions>({ learners: [], instructors: [], items: [] });
  readonly filterOpen = signal(false);
  private readonly langTick = signal(0);

  readonly isQuiz = computed(() => this.kind() === 'quiz');

  readonly list = createPagedList<Query, SubmissionRow>({
    initial: { search: '', page: 1, perPage: 10, sectionId: null, learnerId: null, instructorId: null, itemId: null, status: null },
    load: q => {
      const quiz = this.isQuiz();
      const params = {
        page: q.page,
        per_page: q.perPage,
        search: q.search || undefined,
        section_id: q.sectionId ?? undefined,
        learner_ids: q.learnerId !== null ? [q.learnerId] : undefined,
        instructor_ids: q.instructorId !== null ? [q.instructorId] : undefined,
        status: q.status ?? undefined,
        ...(quiz ? { quiz_id: q.itemId ?? undefined } : { assignment_id: q.itemId ?? undefined }),
      };
      const req$ = quiz
        ? this.courses.quizSubmissions(this.courseId(), params)
        : this.courses.assignmentSubmissions(this.courseId(), params);
      return req$.pipe(toPaged(r => toRow(r, quiz)));
    },
  });

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({ learner_id: q.learnerId, section_id: q.sectionId, instructor_id: q.instructorId, item_id: q.itemId, status: q.status });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    const o = this.options();
    const opts = (list: IdName[]) => list.map(x => ({ id: x.id, label: x.name ?? `#${x.id}` }));
    const learner: NasFilterField = { key: 'learner_id', label: this.t.instant('course_detail.learner'), placeholder: this.t.instant('course_detail.select_learner'), options: opts(o.learners) };
    const cohort: NasFilterField = {
      key: 'section_id',
      label: this.t.instant('course_detail.cohort'),
      placeholder: this.t.instant('course_detail.select_cohort'),
      options: this.cohorts().map(c => ({ id: c.id, label: c.name || this.t.instant('course_detail.unnamed_cohort') })),
    };
    const instructor: NasFilterField = { key: 'instructor_id', label: this.t.instant('course_detail.instructor'), placeholder: this.t.instant('course_detail.select_instructor'), options: opts(o.instructors) };
    const item: NasFilterField = this.isQuiz()
      ? { key: 'item_id', label: this.t.instant('course_detail.quiz'), placeholder: this.t.instant('course_detail.select_quiz'), options: opts(o.items) }
      : { key: 'item_id', label: this.t.instant('course_detail.assignment'), placeholder: this.t.instant('course_detail.select_assignment'), options: opts(o.items) };
    if (this.isQuiz()) return [learner, cohort, instructor, item];
    const status: NasFilterField = {
      key: 'status',
      label: this.t.instant('course_detail.status'),
      placeholder: this.t.instant('course_detail.select_status'),
      options: STATUSES.map(s => ({ id: s, label: this.t.instant(`course_detail.submission_status.${s}`) })),
    };
    return [learner, instructor, item, cohort, status];
  });

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.list.reload();
      this.loadOptions();
    });
  }

  ngOnInit(): void {
    this.list.reload();
    this.loadOptions();
  }

  onFilter(v: NasFilterValues): void {
    this.list.patch({
      learnerId: filterNumbers(v['learner_id'])[0] ?? null,
      sectionId: filterNumbers(v['section_id'])[0] ?? null,
      instructorId: filterNumbers(v['instructor_id'])[0] ?? null,
      itemId: filterNumbers(v['item_id'])[0] ?? null,
      status: filterStrings(v['status'], STATUSES)[0] ?? null,
    });
  }

  private loadOptions(): void {
    const base = this.isQuiz() ? API.ADMIN_QUIZZES : API.ADMIN_ASSIGNMENTS;
    this.api
      .get<FilterOptions>(`${base}/submissions/filter-options`, { course_id: this.courseId() })
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        if (res?.result) this.options.set(res.result);
      });
  }
}

function toRow(r: CourseSubmissionRow, quiz: boolean): SubmissionRow {
  return {
    ...r,
    title: (quiz ? r.quiz_title : r.assignment_title) ?? '-',
    scoreClass: r.passed === true ? 'cl-pass' : r.passed === false ? 'cl-fail' : 'cl-neutral-score',
    link: [quiz ? '/admin/quizzes/submissions' : '/admin/assignments/submissions', String(r.id)],
    submitted: r.submitted_at ?? r.created_at ?? null,
  };
}
