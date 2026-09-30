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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterDialogComponent, type NasFilterField, type NasFilterFieldOption, type NasFilterValues,
} from '../../../../shared/nas/nas-filter-dialog/nas-filter-dialog.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, pagedParams, toPaged, withList, type PagedQuery } from '../../../../shared/list/paged-list';
import {
  RemoteFilterOptions, activeFilterCount, appliedValues, filterNumbers, toFilterOptions,
} from '../../../../shared/list/filter-values';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { EvScoreComponent } from '../../components/ev-score/ev-score.component';
import {
  EvaluationFilterOptions,
  EvaluationLearnerOption,
  EvaluationScoreRow,
} from '../../models/evaluation.model';

interface Query extends PagedQuery {
  readonly dir: 'asc' | 'desc';
  readonly instructorIds: readonly number[];
  readonly learnerIds: readonly number[];
  readonly courseIds: readonly number[];
}

/** A score row with its link and track key, worked out once per load. */
interface ScoreView extends EvaluationScoreRow {
  readonly key: string;
  /** The submission detail is addressed by its natural key. */
  readonly link: (string | number)[];
}

/**
 * View Learners scores - Figma 2017:52260 (D4).
 *
 * GET admin/evaluations/scores: one row per submission, keyed by (learner,
 * course, template) because a submission has no id. Scores are the API's
 * /5 score and verdict (D-054; the frame's "/105" is sample data, FG-12).
 * Instructors, Learners (searched on the server) and Courses are the
 * Dashboard's one Filter modal (D-070: the frame's chips moved into it).
 *
 * `?template=<id>` narrows the list to one template, as linked from its
 * results page; it shows as a removable scope pill. "Create Template" is not
 * drawn: see D-054.
 */
@Component({
  selector: 'app-evaluation-score-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    NasPagerComponent,
    NasFilterDialogComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasDatePipe,
    EvScoreComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-list.component.html',
  styleUrl: './score-list.component.scss',
})
export class EvaluationScoreListComponent {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  /** Query param, bound by withComponentInputBinding. */
  readonly template = input<string | undefined>(undefined);
  readonly templateId = computed(() => {
    const n = Number(this.template());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  readonly skeletons = SKELETON_ROWS;
  /** Learner, template, questions, score, course, last scored, the eye. */
  readonly skeletonCells: readonly NasSkeletonCell[] = ['title', 'title', 'num', 'short', 'text', 'short', 'action'];

  readonly list = createPagedList<Query, ScoreView>({
    // Figma: "Showing 1-8 of 8".
    initial: { search: '', page: 1, perPage: 8, dir: 'desc', instructorIds: [], learnerIds: [], courseIds: [] },
    load: q => this.api.getPaginated<EvaluationScoreRow>(API.ADMIN_EVALUATION_SCORES, this.params(q)).pipe(toPaged(r => ({
      ...r,
      key: `${r.learner.id}-${r.course.id}-${r.template.id}`,
      link: [r.learner.id, r.course.id],
    }))),
  });

  /** The template the list is narrowed to, named from its rows. */
  readonly templateName = computed(() => (this.templateId() === null ? null : this.list.items()[0]?.template.name ?? null));
  readonly dateSort = computed(() => (this.list.query().dir === 'asc' ? 'ascending' : 'descending'));

  /* ── Filter modal ──────────────────────────────────────────────── */
  readonly filterOpen = signal(false);
  private readonly instructors = signal<NasFilterFieldOption[]>([]);
  private readonly courses     = signal<NasFilterFieldOption[]>([]);
  /** Learners can be many: their field searches the server. */
  private readonly learnerOptions = new RemoteFilterOptions(term =>
    this.api
      .getPaginated<EvaluationLearnerOption>(API.ADMIN_EVALUATION_LEARNER_OPTIONS, { per_page: 50, ...(term ? { search: term } : {}) })
      .pipe(map(res => res.result.data.map(l => ({ id: l.id, label: l.employee_id ? `${l.name ?? ''} · ${l.employee_id}` : (l.name ?? '') })))));
  private lookupsLoaded = false;
  private readonly langTick = signal(0);

  readonly appliedFilters = computed<NasFilterValues>(() => {
    const q = this.list.query();
    return appliedValues({ instructor_ids: q.instructorIds, learner_ids: q.learnerIds, course_ids: q.courseIds });
  });
  readonly activeFilters = computed(() => activeFilterCount(this.appliedFilters()));
  readonly hasQuery = computed(() => this.activeFilters() > 0 || this.list.query().search !== '' || this.templateId() !== null);

  readonly filterFields = computed<NasFilterField[]>(() => {
    this.langTick();
    return [
      {
        key: 'instructor_ids', multiple: true,
        label: this.t.instant('evaluations.chip.instructors'),
        placeholder: this.t.instant('courses_list.select_instructor'),
        searchPlaceholder: this.t.instant('courses_list.search_instructors'),
        options: this.instructors(),
      },
      {
        key: 'learner_ids', multiple: true, remote: true,
        label: this.t.instant('evaluations.chip.learners'),
        placeholder: this.t.instant('course_detail.select_learner'),
        searchPlaceholder: this.t.instant('common.search_learners'),
        options: this.learnerOptions.options(),
      },
      {
        key: 'course_ids', multiple: true, wide: true,
        label: this.t.instant('evaluations.chip.courses'),
        placeholder: this.t.instant('courses_list.select_course'),
        searchPlaceholder: this.t.instant('courses_list.search_courses'),
        options: this.courses(),
      },
    ];
  });

  constructor() {
    withLocaleReload(() => {
      this.langTick.update(v => v + 1);
      this.lookupsLoaded = false;
      if (this.filterOpen()) this.loadLookups();
      this.list.reload();
    });
    // The first load, and again from page 1 when ?template= changes (a link, Back).
    effect(() => {
      this.templateId();
      untracked(() => this.list.patch({}));
    });
  }

  toggleSort(): void {
    this.list.patch({ dir: this.list.query().dir === 'desc' ? 'asc' : 'desc' });
  }

  clearTemplate(): void {
    void this.router.navigate([], { queryParams: { template: null }, queryParamsHandling: 'merge' });
  }

  openFilter(): void {
    this.loadLookups();
    this.filterOpen.set(true);
  }

  onFilterSearch(e: { key: string; term: string }): void {
    if (e.key === 'learner_ids') this.learnerOptions.search(e.term);
  }

  onFilter(v: NasFilterValues): void {
    const learnerIds = filterNumbers(v['learner_ids']);
    this.learnerOptions.remember(learnerIds);
    this.list.patch({
      instructorIds: filterNumbers(v['instructor_ids']),
      learnerIds,
      courseIds: filterNumbers(v['course_ids']),
    });
  }

  private loadLookups(): void {
    this.learnerOptions.search('');
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.api
      .get<EvaluationFilterOptions>(API.ADMIN_EVALUATION_FILTER_OPTIONS)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(r => {
        // A failed list stays empty and is fetched again the next time.
        if (!r) { this.lookupsLoaded = false; return; }
        this.instructors.set(toFilterOptions((r.result?.instructors ?? []).map(o => ({ id: o.id, name: o.name ?? '' }))));
        this.courses.set(toFilterOptions((r.result?.courses ?? []).map(o => ({ id: o.id, name: o.name ?? '' }))));
      });
  }

  private params(q: Query): ApiParams {
    const p = pagedParams(q);
    p['dir'] = q.dir;
    const id = this.templateId();
    if (id !== null) p['template_id'] = id;
    withList(p, 'instructor_ids', q.instructorIds);
    withList(p, 'learner_ids', q.learnerIds);
    withList(p, 'course_ids', q.courseIds);
    return p;
  }
}
