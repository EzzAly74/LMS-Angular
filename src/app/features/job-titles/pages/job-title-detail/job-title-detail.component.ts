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
import { JobTitleLearner, JobTitleSummary } from '../../models/job-title-learner.model';

type LoadState = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Job title detail - Figma 2325:117118 (D1).
 *
 * A tree table: one parent row per learner holding the job title
 * ("N of M qualifications", overall course completion), expanding into one
 * child row per qualification the job title requires ("N of M Courses").
 * Everything comes from GET admin/job-titles/{id}/learners (backend B1),
 * which computes the whole grid in grouped queries for the page.
 *
 * Figma shows the first row expanded and no expand control, so the learner
 * cell is the toggle: a real button with aria-expanded, reachable by keyboard.
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
        // Figma opens the first learner, so the tree reads as a tree at once.
        this.expanded.set(new Set(rows.length ? [rows[0].id] : []));
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
