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
import { NasIconComponent, NasStatusBadgeComponent } from '../../../../../../shared/nas';
import { NasPagerComponent } from '../../../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterValues,
} from '../../../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasDatePipe } from '../../../../../../shared/pipes/nas-date.pipes';
import { ApiService } from '../../../../../../core/services/api.service';
import { API } from '../../../../../../core/constants/api.constants';
import { CoursesApiService } from '../../../../services/courses-api.service';
import { LocaleService } from '../../../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../../../core/utils/with-locale-reload';
import type { Cohort } from '../../../../../../core/models/course.types';
import type { CourseSubmissionRow, IdName } from '../../../../models/course-detail.model';

export type SubmissionKind = 'quiz' | 'assignment';

type LoadState = 'loading' | 'ready' | 'error';

interface Query {
  page: number;
  search: string;
  section_id: number | null;
  learner_id: number | null;
  instructor_id: number | null;
  item_id: number | null;
  status: 'graded' | 'pending' | null;
}

interface FilterOptions {
  learners: IdName[];
  instructors: IdName[];
  items: IdName[];
}

const PER_PAGE = 10;
const EMPTY: Query = { page: 1, search: '', section_id: null, learner_id: null, instructor_id: null, item_id: null, status: null };

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
    FormsModule,
    RouterLink,
    TranslateModule,
    NasIconComponent,
    NasStatusBadgeComponent,
    NasPagerComponent,
    NasFilterDialogComponent,
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

  readonly state = signal<LoadState>('loading');
  readonly rows = signal<CourseSubmissionRow[]>([]);
  readonly total = signal(0);
  readonly query = signal<Query>({ ...EMPTY });
  readonly options = signal<FilterOptions>({ learners: [], instructors: [], items: [] });
  readonly filterOpen = signal(false);
  private readonly langTick = signal(0);

  readonly perPage = PER_PAGE;
  readonly isQuiz = computed(() => this.kind() === 'quiz');

  readonly activeFilters = computed(() => {
    const q = this.query();
    return [q.section_id, q.learner_id, q.instructor_id, q.item_id, q.status].filter(v => v !== null).length;
  });

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
      options: (['graded', 'pending'] as const).map(s => ({ id: s, label: this.t.instant(`course_detail.submission_status.${s}`) })),
    };
    return [learner, instructor, item, cohort, status];
  });

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.query();
    return { learner_id: q.learner_id, section_id: q.section_id, instructor_id: q.instructor_id, item_id: q.item_id, status: q.status };
  });

  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<Query>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(search => this.update({ search: search.trim(), page: 1 }));

    this.load$
      .pipe(
        switchMap(q => {
          const params = {
            page: q.page,
            per_page: PER_PAGE,
            search: q.search || undefined,
            section_id: q.section_id ?? undefined,
            learner_ids: q.learner_id !== null ? [q.learner_id] : undefined,
            instructor_ids: q.instructor_id !== null ? [q.instructor_id] : undefined,
            status: q.status ?? undefined,
            ...(this.isQuiz() ? { quiz_id: q.item_id ?? undefined } : { assignment_id: q.item_id ?? undefined }),
          };
          const req$ = this.isQuiz()
            ? this.courses.quizSubmissions(this.courseId(), params)
            : this.courses.assignmentSubmissions(this.courseId(), params);
          return req$.pipe(
            map(res => ({ ok: true as const, res })),
            catchError(() => of({ ok: false as const })),
          );
        }),
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

    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.reload();
      this.loadOptions();
    });
  }

  ngOnInit(): void {
    this.reload();
    this.loadOptions();
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  onFilter(v: NasFilterValues): void {
    const num = (x: unknown) => (typeof x === 'number' ? x : null);
    this.update({
      page: 1,
      learner_id: num(v['learner_id']),
      section_id: num(v['section_id']),
      instructor_id: num(v['instructor_id']),
      item_id: num(v['item_id']),
      status: v['status'] === 'graded' || v['status'] === 'pending' ? v['status'] : null,
    });
  }

  goTo(page: number): void {
    this.update({ page });
  }

  reload(): void {
    this.state.set('loading');
    this.load$.next(this.query());
  }

  hasQuery(): boolean {
    const q = this.query();
    return !!q.search || this.activeFilters() > 0;
  }

  detailLink(row: CourseSubmissionRow): string[] {
    return [this.isQuiz() ? '/admin/quizzes/submissions' : '/admin/assignments/submissions', String(row.id)];
  }

  title(row: CourseSubmissionRow): string {
    return (this.isQuiz() ? row.quiz_title : row.assignment_title) ?? '-';
  }

  scoreClass(row: CourseSubmissionRow): string {
    return row.passed === true ? 'cl-pass' : row.passed === false ? 'cl-fail' : 'cl-neutral-score';
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

  private update(patch: Partial<Query>): void {
    this.query.update(q => ({ ...q, ...patch }));
    this.reload();
  }
}
