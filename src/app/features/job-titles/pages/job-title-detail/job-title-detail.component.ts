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
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { pluralKey } from '../../../../core/utils/plural-key';
import { CourseProgressStatus, JobTitleLearner, JobTitleSummary } from '../../models/job-title-learner.model';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Job title detail - Figma 2459:137558 (D1b; first built from 2325:117118, D1).
 *
 * A three-level tree table: one row per learner holding the job title
 * ("N of M qualifications"), expanding into one row per qualification the
 * job title requires ("N of M Courses"), expanding into one row per course of
 * that qualification with the learner's status (Completed / In Progress /
 * Unenrolled) and progress. Everything comes from
 * GET admin/job-titles/{id}/learners, computed in grouped queries per page.
 *
 * Figma opens the first learner and its first qualification. Each chevron is
 * a real button with aria-expanded. A search that matched a qualification
 * (not the learner) opens every row, so the match is visible at once.
 */
@Component({
  selector: 'app-job-title-detail',
  standalone: true,
  imports: [FormsModule, TranslateModule, SkeletonModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-detail.component.html',
  styleUrl: './job-title-detail.component.scss',
})
export class JobTitleDetailComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly locale     = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param, bound by withComponentInputBinding(). */
  readonly id = input.required<string>();

  /** Figma shows eight rows per page. */
  readonly perPage = 8;
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];

  readonly jobTitle = signal<JobTitleSummary | null>(null);
  readonly learners = signal<JobTitleLearner[]>([]);
  readonly total    = signal(0);
  readonly page     = signal(1);
  readonly search   = signal('');
  readonly state    = signal<LoadState>('loading');
  readonly expanded = signal<ReadonlySet<number>>(new Set());
  /** Open qualification rows, keyed "learnerId:qualificationId". */
  readonly expandedQuals = signal<ReadonlySet<string>>(new Set());

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage + 1));
  readonly rangeEnd   = computed(() => Math.min(this.page() * this.perPage, this.total()));

  private readonly search$ = new Subject<string>();
  /** Every learners fetch goes through here, so a newer one cancels an older one. */
  private readonly fetch$  = new Subject<void>();

  constructor() {
    // Learner and qualification names are localised by the API from the
    // Accept-Language header, so a language switch must refetch them.
    withLocaleReload(() => this.reload());
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          return this.api
            .getPaginated<JobTitleLearner>(`${API.ADMIN_JOB_TITLES}/${this.id()}/learners`, {
              page: this.page(),
              per_page: this.perPage,
              ...(this.search() ? { search: this.search() } : {}),
            })
            .pipe(
              map(res => ({ ok: true as const, res })),
              catchError((err: unknown) => of({ ok: false as const, err })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (!result.ok) {
          this.state.set(this.isNotFound(result.err) ? 'not-found' : 'error');
          return;
        }
        const rows = result.res.result.data;
        this.learners.set(rows);
        this.total.set(result.res.result.total);
        this.openInitial(rows);
        this.state.set('ready');
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term.trim());
        this.page.set(1);
        this.fetch$.next();
      });

    this.reload();
  }

  reload(): void {
    this.loadJobTitle();
    this.fetch$.next();
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.fetch$.next();
  }

  toggle(learnerId: number): void {
    const next = new Set(this.expanded());
    if (next.has(learnerId)) next.delete(learnerId);
    else next.add(learnerId);
    this.expanded.set(next);
  }

  isExpanded(learnerId: number): boolean {
    return this.expanded().has(learnerId);
  }

  toggleQual(learnerId: number, qualId: number): void {
    const key = `${learnerId}:${qualId}`;
    const next = new Set(this.expandedQuals());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expandedQuals.set(next);
  }

  isQualExpanded(learnerId: number, qualId: number): boolean {
    return this.expandedQuals().has(`${learnerId}:${qualId}`);
  }

  /** Pill and trailing text for a course row (FG-41: unenrolled reads "Not Yet"). */
  statusKey(status: CourseProgressStatus): string {
    return `job_titles.detail.status_${status}`;
  }

  stateKey(status: CourseProgressStatus): string {
    return `job_titles.detail.state_${status}`;
  }

  /**
   * Figma opens the first learner and its first qualification, so the tree
   * reads as a tree at once. Rows matched through a qualification open fully.
   */
  private openInitial(rows: JobTitleLearner[]): void {
    const learners = new Set<number>();
    const quals = new Set<string>();
    const first = rows[0];
    if (first) {
      learners.add(first.id);
      const q = first.qualification_breakdown[0];
      if (q) quals.add(`${first.id}:${q.id}`);
    }
    for (const r of rows) {
      if (!r.qualification_match) continue;
      learners.add(r.id);
      for (const q of r.qualification_breakdown) quals.add(`${r.id}:${q.id}`);
    }
    this.expanded.set(learners);
    this.expandedQuals.set(quals);
  }

  /** Translation key for a counted phrase, with the locale's plural form. */
  plural(base: string, count: number): string {
    return pluralKey(`job_titles.detail.${base}`, count, this.locale.locale());
  }

  private loadJobTitle(): void {
    this.api
      .get<JobTitleSummary>(`${API.JOB_TITLES}/${this.id()}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => this.jobTitle.set(res.result),
        error: (err: unknown) => {
          if (this.isNotFound(err)) this.state.set('not-found');
        },
      });
  }

  private isNotFound(err: unknown): boolean {
    return err instanceof HttpErrorResponse && err.status === 404;
  }
}
