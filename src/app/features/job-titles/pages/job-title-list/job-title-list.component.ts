import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import {
  NasFilterDialogComponent,
  NasFilterField,
  NasFilterFieldOption,
  NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasListStateComponent, NasSkeletonComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, pagedParams, toPaged, withList, type PagedQuery } from '../../../../shared/list/paged-list';
import {
  RemoteFilterOptions, activeFilterCount, appliedValues, filterNumbers, toFilterOptions,
} from '../../../../shared/list/filter-values';
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

/** A job title card with its compliance value and tone, worked out once per load. */
interface JobTitleCard extends JobTitle {
  readonly compliance: number;
  readonly tone: 'low' | 'mid' | 'high';
}

/** GET admin/job-titles/learner-options. */
interface LearnerOption {
  id: number;
  name: string;
  employee_id: string | null;
}

interface Query extends PagedQuery {
  readonly qualificationIds: readonly number[];
  readonly learnerId: number | null;
}

/**
 * Job Titles index - Figma 2078:102691 (D1b).
 *
 * A 3-column grid of role cards (name, employee pill, learners,
 * qualifications, compliance bar) under "Search by learner or job title"
 * and the Filter modal (2463:138054: Qualification multi-select, Learner
 * searched on the server). Everything comes from GET admin/job-titles.
 * The grid stays (the frame draws cards); the toolbar, loading, states and
 * pager are the Dashboard's shared list pieces (D-070).
 *
 * The per-card "Assign Qualification" button and its modal are gone
 * (D-059): qualifications are assigned to job titles from the
 * Qualification modal, one write path.
 */
@Component({
  selector: 'app-job-title-list',
  standalone: true,
  imports: [
    RouterLink, TranslateModule, NasFilterDialogComponent, NasPagerComponent,
    NasListToolbarComponent, NasListStateComponent, NasSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-list.component.html',
  styleUrl: './job-title-list.component.scss',
})
export class JobTitleListComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletons = [0, 1, 2, 3, 4, 5] as const;

  readonly list = createPagedList<Query, JobTitleCard>({
    // 12 = four rows of three cards.
    initial: { search: '', page: 1, perPage: 12, qualificationIds: [], learnerId: null },
    load: q => this.api.getPaginated<JobTitle>(API.ADMIN_JOB_TITLES, this.params(q)).pipe(toPaged(j => {
      const compliance = Number(j.compliance_percent ?? 0);
      return { ...j, compliance, tone: complianceTone(compliance) };
    })),
  });

  /* ── Filter modal ──────────────────────────────────────────────── */
  readonly filterOpen = signal(false);
  private readonly qualifications = signal<NasFilterFieldOption[]>([]);
  /** The employee ID is part of the label, so the dropdown's own filter matches it too. */
  private readonly learnerOptions = new RemoteFilterOptions(term =>
    this.api.get<LearnerOption[]>(`${API.ADMIN_JOB_TITLES}/learner-options`, term ? { search: term } : {}).pipe(
      map(res => (res.result ?? []).map(l => ({ id: l.id, label: l.employee_id ? `${l.name} (${l.employee_id})` : l.name }))),
    ));
  private lookupsLoaded = false;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({ qualification_ids: q.qualificationIds, learner_id: q.learnerId });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '');

  readonly filterFields = computed<readonly NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'qualification_ids', multiple: true,
        label: this.t.instant('job_titles.filter_qualification'),
        placeholder: this.t.instant('job_titles.filter_qualification_placeholder'),
        options: this.qualifications(),
      },
      {
        key: 'learner_id', remote: true,
        label: this.t.instant('job_titles.filter_learner'),
        placeholder: this.t.instant('job_titles.filter_learner_placeholder'),
        options: this.learnerOptions.options(),
      },
    ];
  });

  constructor() {
    // Names come back in the request language, so a language switch refetches.
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.list.reload();
    });
  }

  ngOnInit(): void {
    this.list.reload();
  }

  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    if (e.key === 'learner_id') this.learnerOptions.search(e.term);
  }

  onFilter(v: NasFilterValues): void {
    const learnerId = filterNumbers(v['learner_id'])[0] ?? null;
    this.learnerOptions.remember(learnerId === null ? [] : [learnerId]);
    this.list.patch({ qualificationIds: filterNumbers(v['qualification_ids']), learnerId });
  }

  private loadLookups(): void {
    this.learnerOptions.search('');
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.api
      .get<{ id: number; name: string }[]>(`${API.QUALIFICATIONS}/active`)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        // A failed list stays empty and is fetched again the next time.
        if (!res) { this.lookupsLoaded = false; return; }
        this.qualifications.set(toFilterOptions(res.result));
      });
  }

  private params(q: Query): ApiParams {
    const p = pagedParams(q);
    withList(p, 'qualification_ids', q.qualificationIds);
    if (q.learnerId !== null) p['learner_id'] = q.learnerId;
    return p;
  }
}

/**
 * Figma tone for the compliance bar (2078:102691): 91% green, 81% navy,
 * 21% red. "High" starts at 90, not 80, so 81% reads navy as drawn.
 */
function complianceTone(p: number): 'low' | 'mid' | 'high' {
  if (p >= 90) return 'high';
  if (p >= 40) return 'mid';
  return 'low';
}
