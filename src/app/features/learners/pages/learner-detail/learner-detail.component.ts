import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasAvatarComponent } from '../../../../shared/nas/nas-avatar/nas-avatar.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasStatusBadgeComponent, NasStatusTone } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasDatepickerComponent } from '../../../../shared/nas/nas-datepicker/nas-datepicker.component';
import { dateToApi } from '../../../../core/utils/assessment-question';
import {
  LearnerCourseRow,
  LearnerPerformanceRow,
  LearnerProfile,
} from '../../models/learner.model';

type LoadState = 'loading' | 'ready' | 'error';

/** One independently paginated table on the page. */
interface TableState<T> {
  rows: T[];
  total: number;
  page: number;
  state: LoadState;
}

const EMPTY_TABLE = { rows: [], total: 0, page: 1, state: 'loading' as LoadState };

/**
 * Learner detail - Figma 2181:115043 (D3).
 *
 * Profile card and the five Summary tiles (GET admin/learners/{id}), then
 * two tables with their own pagers (…/courses, …/performance): the design
 * gives each "1–4 of 6", which is why B2 made them separate endpoints.
 *
 * The search + From/To above the cards (NEW2B-6226, closing FG-24 a) filter
 * both tables: course and quiz / assignment names in either language; a
 * cohort whose dates overlap the range, and results updated within it.
 */
@Component({
  selector: 'app-learner-detail',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    SkeletonModule,
    NasIconComponent,
    NasAvatarComponent,
    NasPagerComponent,
    NasStatusBadgeComponent,
    NasDatePipe,
    FormsModule,
    NasListToolbarComponent,
    NasDatepickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './learner-detail.component.html',
  styleUrl: './learner-detail.component.scss',
})
export class LearnerDetailComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  /** Route param, bound by withComponentInputBinding(). */
  readonly id = input.required<string>();

  /** Figma: "1–4 of 6" under each table. */
  readonly perPage = 4;
  readonly skeletons = [0, 1, 2, 3];

  readonly profile      = signal<LearnerProfile | null>(null);
  readonly profileState = signal<LoadState | 'not-found'>('loading');
  readonly courses      = signal<TableState<LearnerCourseRow>>({ ...EMPTY_TABLE });
  readonly performance  = signal<TableState<LearnerPerformanceRow>>({ ...EMPTY_TABLE });

  private readonly courses$     = new Subject<number>();
  private readonly performance$ = new Subject<number>();

  /* ── Search + From / To (both tables) ── */
  readonly search = signal('');
  readonly from   = signal<Date | null>(null);
  readonly to     = signal<Date | null>(null);
  readonly filtered = computed(() => this.search() !== '' || this.from() !== null || this.to() !== null);
  private readonly search$ = new Subject<string>();

  constructor() {
    // Course, cohort, quiz and qualification names are localised server-side.
    withLocaleReload(() => this.loadAll());
  }

  ngOnInit(): void {
    this.table(this.courses$, 'courses', this.courses);
    this.table(this.performance$, 'performance', this.performance);
    this.search$
      .pipe(map(v => v.trim()), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term);
        this.reloadTables();
      });
    this.loadAll();
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  setRange(edge: 'from' | 'to', value: Date | null): void {
    (edge === 'from' ? this.from : this.to).set(value);
    this.reloadTables();
  }

  /** A filter changed: both tables start again at page 1. */
  private reloadTables(): void {
    this.courses$.next(1);
    this.performance$.next(1);
  }

  loadAll(): void {
    this.loadProfile();
    this.courses$.next(this.courses().page);
    this.performance$.next(this.performance().page);
  }

  coursesPage(page: number): void {
    this.courses$.next(page);
  }

  performancePage(page: number): void {
    this.performance$.next(page);
  }

  // ── Cell helpers ─────────────────────────────────────────────────────
  /**
   * The API reports a course as completed or active. Figma adds "Not
   * started"; it labels completion "Certified", but a completed course is
   * not proof a certificate was issued, so it says "Completed".
   */
  courseStatus(row: LearnerCourseRow): { key: string; tone: NasStatusTone } {
    if (row.status === 'completed') return { key: 'learners.detail.status.completed', tone: 'success' };
    // The cohort has not started yet / is over without a pass (NEW2B-6228).
    if (row.status === 'upcoming') return { key: 'learners.detail.status.upcoming', tone: 'neutral' };
    if (row.status === 'ended') return { key: 'learners.detail.status.ended', tone: 'danger' };
    if (row.attended === 0 && !row.progress_percent) return { key: 'learners.detail.status.not_started', tone: 'neutral' };
    return { key: 'learners.detail.status.in_progress', tone: 'info' };
  }

  resultTone(status: LearnerPerformanceRow['status']): NasStatusTone {
    return status === 'pass' ? 'success' : status === 'failed' ? 'danger' : 'neutral';
  }

  /** The list page's bar colours: red below half, slate from half, green at 100. */
  tone(pct: number): 'low' | 'mid' | 'full' {
    if (pct >= 100) return 'full';
    if (pct >= 50) return 'mid';
    return 'low';
  }

  qualificationNames(row: LearnerCourseRow): string {
    return row.qualifications.map(q => q.name).filter(Boolean).join(', ');
  }

  previewLink(row: LearnerPerformanceRow): string[] {
    return row.kind === 'quiz'
      ? ['/admin/quizzes/submissions', String(row.id)]
      : ['/admin/assignments/submissions', String(row.id)];
  }

  // ── Internals ────────────────────────────────────────────────────────
  private loadProfile(): void {
    this.profileState.set('loading');
    this.api
      .get<LearnerProfile>(`${API.ADMIN_LEARNERS}/${this.id()}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.profile.set(res.result);
          this.profileState.set('ready');
        },
        error: (err: unknown) =>
          this.profileState.set(err instanceof HttpErrorResponse && err.status === 404 ? 'not-found' : 'error'),
      });
  }

  private tableParams(page: number): Record<string, string | number> {
    const params: Record<string, string | number> = { page, per_page: this.perPage };
    const from = dateToApi(this.from());
    const to = dateToApi(this.to());
    if (this.search()) params['search'] = this.search();
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return params;
  }

  /** Wire one table: each page request cancels the previous one. */
  private table<T>(
    trigger$: Subject<number>,
    path: 'courses' | 'performance',
    target: WritableSignal<TableState<T>>,
  ): void {
    trigger$
      .pipe(
        switchMap((page): Observable<TableState<T>> => {
          target.update(t => ({ ...t, page, state: 'loading' }));
          return this.api
            .getPaginated<T>(`${API.ADMIN_LEARNERS}/${this.id()}/${path}`, this.tableParams(page))
            .pipe(
              map(res => ({ rows: res.result.data, total: res.result.total, page, state: 'ready' as LoadState })),
              catchError(() => of({ rows: [], total: 0, page, state: 'error' as LoadState })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(next => target.set(next));
  }
}
