import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasAvatarComponent } from '../../../../shared/nas/nas-avatar/nas-avatar.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasStatusBadgeComponent, NasStatusTone } from '../../../../shared/nas/nas-status-badge/nas-status-badge.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
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
 * Figma repeats the list page's search + From/To above the cards; on one
 * learner's page it is unclear what they would filter, so they are left out
 * pending the designer (FG-24) rather than wired to a guess.
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

  constructor() {
    // Course, cohort, quiz and qualification names are localised server-side.
    withLocaleReload(() => this.loadAll());
  }

  ngOnInit(): void {
    this.table(this.courses$, 'courses', this.courses);
    this.table(this.performance$, 'performance', this.performance);
    this.loadAll();
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
            .getPaginated<T>(`${API.ADMIN_LEARNERS}/${this.id()}/${path}`, { page, per_page: this.perPage })
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
