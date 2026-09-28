import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterFieldOption,
  NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface JobTitle {
  id: number;
  name: string;
  employees_count?: number;
  learners_count?: number;
  qualifications_count?: number;
  /** 0-100, computed by the API; renders as the compliance bar. */
  compliance_percent?: number;
}

interface Qualification {
  id: number;
  name: string;
}

/** GET admin/job-titles/learner-options. */
interface LearnerOption {
  id: number;
  name: string;
  employee_id: string | null;
}

interface Filters {
  qualificationIds: readonly number[];
  learner: NasFilterFieldOption | null;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Job Titles index - Figma 2078:102691 (D1b).
 *
 * A 3-column grid of role cards (name, employee pill, learners,
 * qualifications, compliance bar) under "Search by learner or job title"
 * and a Filter button that opens the shared Filter modal (2463:138054:
 * Qualification multi-select, Learner). Everything comes from
 * GET admin/job-titles.
 *
 * The per-card "Assign Qualification" button and its modal are gone
 * (D-059): qualifications are assigned to job titles from the
 * Qualification modal, one write path.
 */
@Component({
  selector: 'app-job-title-list',
  standalone: true,
  imports: [FormsModule, RouterLink, SkeletonModule, TranslateModule, NasIconComponent, NasFilterDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-list.component.html',
  styleUrl: './job-title-list.component.scss',
})
export class JobTitleListComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items  = signal<JobTitle[]>([]);
  readonly total  = signal(0);
  readonly state  = signal<LoadState>('loading');
  readonly search = signal('');
  readonly page   = signal(1);

  /** 12 = four rows of three cards. */
  readonly perPage = 12;
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  readonly filterOpen     = signal(false);
  readonly filters        = signal<Filters>({ qualificationIds: [], learner: null });
  readonly qualifications = signal<Qualification[]>([]);
  readonly learnerOptions = signal<NasFilterFieldOption[]>([]);

  readonly activeFilters = computed(() => {
    const f = this.filters();
    return (f.qualificationIds.length ? 1 : 0) + (f.learner ? 1 : 0);
  });

  readonly filterFields = computed<readonly NasFilterField[]>(() => {
    // Keep the chosen learner in the list so its label shows before any search.
    const chosen = this.filters().learner;
    const learners = this.learnerOptions();
    return [
      {
        key: 'qualification_ids',
        label: this.t.instant('job_titles.filter_qualification'),
        placeholder: this.t.instant('job_titles.filter_qualification_placeholder'),
        options: this.qualifications().map(q => ({ id: q.id, label: q.name })),
        multiple: true,
      },
      {
        key: 'learner_id',
        label: this.t.instant('job_titles.filter_learner'),
        placeholder: this.t.instant('job_titles.filter_learner_placeholder'),
        options: chosen && !learners.some(o => o.id === chosen.id) ? [chosen, ...learners] : learners,
        remote: true,
      },
    ];
  });

  readonly appliedFilters = computed<NasFilterValues>(() => ({
    qualification_ids: this.filters().qualificationIds.length ? this.filters().qualificationIds : null,
    learner_id: this.filters().learner?.id ?? null,
  }));

  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage + 1));
  readonly rangeEnd   = computed(() => Math.min(this.page() * this.perPage, this.total()));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  readonly filtered   = computed(() => this.search() !== '' || this.activeFilters() > 0);

  private readonly search$        = new Subject<string>();
  private readonly learnerSearch$ = new Subject<string>();
  /** Every list fetch goes through here, so a newer one cancels an older one. */
  private readonly fetch$ = new Subject<void>();

  constructor() {
    // Names come back in the request language, so a language switch refetches.
    withLocaleReload(() => {
      this.fetch$.next();
      this.loadQualifications();
      this.learnerSearch$.next('');
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          return this.api.getPaginated<JobTitle>(API.ADMIN_JOB_TITLES, this.params()).pipe(
            map(res => ({ ok: true as const, res })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (!result.ok) {
          this.state.set('error');
          return;
        }
        this.items.set(result.res.result.data);
        this.total.set(result.res.result.total);
        this.state.set('ready');
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term.trim());
        this.page.set(1);
        this.fetch$.next();
      });

    this.learnerSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(term =>
          this.api
            .get<LearnerOption[]>(`${API.ADMIN_JOB_TITLES}/learner-options`, term ? { search: term } : {})
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => {
        if (res === null) return;
        this.learnerOptions.set((res.result ?? []).map(l => ({ id: l.id, label: this.learnerLabel(l) })));
      });

    this.fetch$.next();
    this.loadQualifications();
    this.learnerSearch$.next('');
  }

  reload(): void {
    this.fetch$.next();
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  onLearnerSearch(e: { key: string; term: string }): void {
    if (e.key === 'learner_id') this.learnerSearch$.next(e.term);
  }

  onFilter(v: NasFilterValues): void {
    const ids = v['qualification_ids'];
    const learnerId = typeof v['learner_id'] === 'number' ? v['learner_id'] : null;
    const learner = learnerId === null
      ? null
      : this.filterFields()[1].options.find(o => o.id === learnerId) ?? { id: learnerId, label: String(learnerId) };
    this.filters.set({
      qualificationIds: Array.isArray(ids) ? ids.filter((x): x is number => typeof x === 'number') : [],
      learner,
    });
    this.page.set(1);
    this.fetch$.next();
  }

  onPage(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
    this.fetch$.next();
  }

  /**
   * Figma tone for the compliance bar (2078:102691): 91% green, 81% navy,
   * 21% red. "High" starts at 90, not 80, so 81% reads navy as drawn.
   */
  complianceTone(percent: number | undefined | null): 'low' | 'mid' | 'high' {
    const p = Number(percent ?? 0);
    if (p >= 90) return 'high';
    if (p >= 40) return 'mid';
    return 'low';
  }

  private params(): ApiParams {
    const f = this.filters();
    return {
      page: this.page(),
      per_page: this.perPage,
      ...(this.search() ? { search: this.search() } : {}),
      ...(f.qualificationIds.length ? { qualification_ids: [...f.qualificationIds] } : {}),
      ...(f.learner ? { learner_id: f.learner.id } : {}),
    };
  }

  private loadQualifications(): void {
    this.api
      .get<Qualification[]>(`${API.QUALIFICATIONS}/active`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: res => this.qualifications.set(res.result ?? []) });
  }

  /** The employee ID is part of the label, so the dropdown's own filter matches it too. */
  private learnerLabel(l: LearnerOption): string {
    return l.employee_id ? `${l.name} (${l.employee_id})` : l.name;
  }
}
