import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { RatingsApiService } from '../../services/ratings-api.service';
import type {
  RatingCourseOption,
  RatingInstructorOption,
  RatingLearnerOption,
  RatingListItem,
  RatingSummary,
} from '../../models/rating.types';

type FilterKind = 'instructors' | 'learners' | 'courses';

interface FilterModalState {
  open: boolean;
  kind: FilterKind | null;
  query: string;
}

@Component({
  selector: 'app-ratings-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    SkeletonModule,
    TranslateModule,
    NasPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ratings-list.component.html',
  styleUrl: './ratings-list.component.scss',
})
export class RatingsListComponent implements OnInit, OnDestroy {
  private readonly api = inject(RatingsApiService);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  readonly skeletons = [1, 2, 3, 4, 5, 6, 7];
  readonly starsTrack = [0, 1, 2, 3, 4];
  readonly min = Math.min;

  constructor() {
    // Reload primary list AND filter-modal lookups (instructors,
    // learners, courses) on EN ↔ AR switch so the filter modal
    // doesn't keep old-language names cached.
    withLocaleReload(() => {
      this.refresh();
      this.loadLookups();
    });
  }

  /* ── Data ────────────────────────────────────────────────────── */
  readonly items   = signal<RatingListItem[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(true);
  readonly summary = signal<RatingSummary>({
    total_ratings:   0,
    average_score:   0,
    five_star_count: 0,
    low_count:       0,
  });
  readonly summaryLoading = signal(true);

  /* ── List state ──────────────────────────────────────────────── */
  page    = 1;
  perPage = 20;
  search  = '';
  instructorIds: number[] = [];
  learnerIds:    number[] = [];
  courseIds:     number[] = [];

  /* ── Filter lookups ──────────────────────────────────────────── */
  readonly instructors = signal<RatingInstructorOption[]>([]);
  readonly learners    = signal<RatingLearnerOption[]>([]);
  readonly courses     = signal<RatingCourseOption[]>([]);
  readonly lookupsLoaded = signal(false);

  /* ── Filter modal ────────────────────────────────────────────── */
  readonly filter = signal<FilterModalState>({ open: false, kind: null, query: '' });
  readonly selectedInstructorSet = signal<Set<number>>(new Set());
  readonly selectedLearnerSet    = signal<Set<number>>(new Set());
  readonly selectedCourseSet     = signal<Set<number>>(new Set());

  readonly filterPillCounts = computed(() => ({
    instructors: this.instructorIds.length,
    learners:    this.learnerIds.length,
    courses:     this.courseIds.length,
  }));

  readonly hasAnyFilter = computed(
    () => this.filterPillCounts().instructors > 0
       || this.filterPillCounts().learners    > 0
       || this.filterPillCounts().courses     > 0,
  );

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        this.search = v;
        this.page = 1;
        this.loadList();
      });

    this.loadLookups();
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */

  refresh(): void {
    this.loadSummary();
    this.loadList();
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.api.summary().subscribe({
      next: res => {
        this.summary.set(res.result);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  private loadList(): void {
    this.loading.set(true);
    this.api.list({
      page:     this.page,
      per_page: this.perPage,
      ...(this.search          ? { search:         this.search }         : {}),
      ...(this.instructorIds.length ? { instructor_ids: this.instructorIds } : {}),
      ...(this.learnerIds.length    ? { learner_ids:    this.learnerIds }    : {}),
      ...(this.courseIds.length     ? { course_ids:     this.courseIds }     : {}),
    }).subscribe({
      next: res => {
        this.items.set(res.result.data ?? []);
        this.total.set(res.result.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLookups(): void {
    this.api.filterOptions().subscribe({
      next: res => {
        this.instructors.set(res.result.instructors ?? []);
        this.learners.set(res.result.learners ?? []);
        this.courses.set(res.result.courses ?? []);
        this.lookupsLoaded.set(true);
      },
    });
  }

  /* ── Interactions ────────────────────────────────────────────── */

  onSearch(v: string): void { this.search$.next(v); }

  onPage(p: number): void {
    if (p < 1) return;
    this.page = p;
    this.loadList();
  }

  /* ── Filter modal ────────────────────────────────────────────── */

  openFilter(kind: FilterKind): void {
    this.filter.set({ open: true, kind, query: '' });
    if (kind === 'instructors') this.selectedInstructorSet.set(new Set(this.instructorIds));
    else if (kind === 'learners') this.selectedLearnerSet.set(new Set(this.learnerIds));
    else                          this.selectedCourseSet.set(new Set(this.courseIds));
  }

  closeFilter(): void {
    this.filter.update(s => ({ ...s, open: false }));
  }

  onFilterQuery(v: string): void {
    this.filter.update(s => ({ ...s, query: v }));
  }

  toggleFilterItem(id: number): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.toggleInSet(this.selectedInstructorSet, id);
    else if (kind === 'learners') this.toggleInSet(this.selectedLearnerSet, id);
    else if (kind === 'courses')  this.toggleInSet(this.selectedCourseSet, id);
  }

  private toggleInSet(s: ReturnType<typeof signal<Set<number>>>, id: number): void {
    s.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isFilterSelected(id: number): boolean {
    const kind = this.filter().kind;
    if (kind === 'instructors') return this.selectedInstructorSet().has(id);
    if (kind === 'learners')    return this.selectedLearnerSet().has(id);
    if (kind === 'courses')     return this.selectedCourseSet().has(id);
    return false;
  }

  filterItems(): { id: number; name: string }[] {
    const q = this.filter().query.trim().toLowerCase();
    const kind = this.filter().kind;
    let source: { id: number; name: string }[] = [];
    if (kind === 'instructors') {
      source = this.instructors().map(i => ({ id: i.id, name: i.name ?? '—' }));
    } else if (kind === 'learners') {
      source = this.learners().map(l => ({ id: l.id, name: l.name ?? '—' }));
    } else if (kind === 'courses') {
      source = this.courses().map(c => ({ id: c.id, name: c.title ?? '—' }));
    }
    if (!q) return source;
    return source.filter(x => x.name.toLowerCase().includes(q));
  }

  clearFilterSelection(): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.selectedInstructorSet.set(new Set());
    else if (kind === 'learners') this.selectedLearnerSet.set(new Set());
    else if (kind === 'courses')  this.selectedCourseSet.set(new Set());
  }

  applyFilter(): void {
    const kind = this.filter().kind;
    if (kind === 'instructors') this.instructorIds = [...this.selectedInstructorSet()];
    else if (kind === 'learners') this.learnerIds  = [...this.selectedLearnerSet()];
    else if (kind === 'courses')  this.courseIds   = [...this.selectedCourseSet()];
    this.closeFilter();
    this.page = 1;
    this.loadList();
  }

  clearAllFilters(): void {
    this.instructorIds = [];
    this.learnerIds    = [];
    this.courseIds     = [];
    this.selectedInstructorSet.set(new Set());
    this.selectedLearnerSet.set(new Set());
    this.selectedCourseSet.set(new Set());
    this.page = 1;
    this.loadList();
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  /** Returns the formatted average e.g. "3.6". */
  averageDisplay(): string {
    const v = this.summary().average_score;
    if (!v) return '0.0';
    return v.toFixed(1);
  }
}
