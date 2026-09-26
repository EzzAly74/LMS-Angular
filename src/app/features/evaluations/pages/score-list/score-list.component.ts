import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import {
  NasFilterOption,
  NasFilterPickerComponent,
} from '../../../../shared/nas/nas-filter-picker/nas-filter-picker.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { EvScoreComponent } from '../../components/ev-score/ev-score.component';
import {
  EvaluationFilterOptions,
  EvaluationLearnerOption,
  EvaluationScoreRow,
} from '../../models/evaluation.model';

type LoadState = 'loading' | 'ready' | 'error';
type ChipKey = 'instructor_ids' | 'learner_ids' | 'course_ids';

/**
 * View Learners scores - Figma 2017:52260 (D4).
 *
 * GET admin/evaluations/scores: one row per submission, keyed by (learner,
 * course, template) because a submission has no id. Scores are the API's
 * /5 score and verdict (D-054; the frame's "/105" is sample data, FG-12).
 *
 * `?template=<id>` narrows the list to one template, as linked from its
 * results page. "Create Template" is not drawn: see D-054.
 */
@Component({
  selector: 'app-evaluation-score-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslateModule,
    SkeletonModule,
    NasIconComponent,
    NasPagerComponent,
    NasFilterPickerComponent,
    NasDatePipe,
    EvScoreComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-list.component.html',
  styleUrl: './score-list.component.scss',
})
export class EvaluationScoreListComponent implements OnInit {
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

  /** Figma: "Showing 1-8 of 8". */
  readonly perPage   = 8;
  readonly skeletons = Array.from({ length: 5 }, (_, i) => i);

  readonly chips: { key: ChipKey; labelKey: string }[] = [
    { key: 'instructor_ids', labelKey: 'evaluations.chip.instructors' },
    { key: 'learner_ids',    labelKey: 'evaluations.chip.learners' },
    { key: 'course_ids',     labelKey: 'evaluations.chip.courses' },
  ];

  readonly rows   = signal<EvaluationScoreRow[]>([]);
  readonly total  = signal(0);
  readonly page   = signal(1);
  readonly state  = signal<LoadState>('loading');
  readonly search = signal('');
  readonly dir    = signal<'asc' | 'desc'>('desc');
  readonly picked = signal<Record<ChipKey, number[]>>({ instructor_ids: [], learner_ids: [], course_ids: [] });

  readonly pickerKey      = signal<ChipKey>('instructor_ids');
  readonly pickerVisible  = signal(false);
  readonly options        = signal<Record<ChipKey, NasFilterOption[]>>({ instructor_ids: [], learner_ids: [], course_ids: [] });
  readonly optionsLoaded  = signal(false);
  readonly optionsLoading = signal(false);

  readonly anyChip  = computed(() => Object.values(this.picked()).some(v => v.length > 0));
  readonly narrowed = computed(() => this.anyChip() || !!this.search() || this.templateId() !== null);
  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  /** The template the list is narrowed to, named from its rows. */
  readonly templateName = computed(() => (this.templateId() === null ? null : this.rows()[0]?.template.name ?? null));

  private readonly fetch$         = new Subject<void>();
  private readonly search$        = new Subject<string>();
  private readonly learnerSearch$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => {
      this.fetch$.next();
      this.options.set({ instructor_ids: [], learner_ids: [], course_ids: [] });
      this.optionsLoaded.set(false);
    });
    // The first load, and again when ?template= changes (a link, Back).
    effect(() => {
      this.templateId();
      untracked(() => this.reload());
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          return this.api.getPaginated<EvaluationScoreRow>(API.ADMIN_EVALUATION_SCORES, this.params()).pipe(
            map(res => ({ ok: true as const, res })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(r => {
        if (!r.ok) {
          this.state.set('error');
          return;
        }
        this.rows.set(r.res.result.data);
        this.total.set(r.res.result.total);
        this.state.set('ready');
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term.trim());
        this.reload();
      });

    // Learners can be many, so their picker searches on the server. No
    // distinctUntilChanged: reopening re-sends the same term (see D3).
    this.learnerSearch$
      .pipe(
        debounceTime(300),
        switchMap(term => {
          this.optionsLoading.set(true);
          return this.api
            .getPaginated<EvaluationLearnerOption>(API.ADMIN_EVALUATION_LEARNER_OPTIONS, { per_page: 100, ...(term ? { search: term } : {}) })
            .pipe(
              map(res => res.result.data.map(l => ({ id: l.id, label: l.employee_id ? `${l.name ?? ''} · ${l.employee_id}` : (l.name ?? '') }))),
              catchError(() => of([] as NasFilterOption[])),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(opts => {
        this.options.update(o => ({ ...o, learner_ids: opts }));
        this.optionsLoading.set(false);
      });
  }

  reload(): void {
    this.page.set(1);
    this.fetch$.next();
  }

  retry(): void {
    this.fetch$.next();
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  goTo(p: number): void {
    if (p < 1 || p > this.lastPage() || p === this.page()) return;
    this.page.set(p);
    this.fetch$.next();
  }

  toggleSort(): void {
    this.dir.update(d => (d === 'desc' ? 'asc' : 'desc'));
    this.reload();
  }

  clearTemplate(): void {
    void this.router.navigate([], { queryParams: { template: null }, queryParamsHandling: 'merge' });
  }

  // ── Chips ──────────────────────────────────────────────────────────────
  clearChips(): void {
    if (!this.anyChip()) return;
    this.picked.set({ instructor_ids: [], learner_ids: [], course_ids: [] });
    this.reload();
  }

  count(key: ChipKey): number {
    return this.picked()[key].length;
  }

  openPicker(key: ChipKey): void {
    this.pickerKey.set(key);
    this.pickerVisible.set(true);
    if (key === 'learner_ids') {
      if (this.options().learner_ids.length === 0) this.learnerSearch$.next('');
      return;
    }
    if (!this.optionsLoaded()) this.loadOptions();
  }

  onPick(key: ChipKey, ids: (number | string)[]): void {
    const nums = ids.filter((v): v is number => typeof v === 'number');
    this.picked.update(p => ({ ...p, [key]: nums }));
    this.reload();
  }

  onPickerSearch(key: ChipKey, term: string): void {
    if (key === 'learner_ids') this.learnerSearch$.next(term);
  }

  pickerLabel(key: ChipKey): string {
    return this.t.instant(this.chips.find(c => c.key === key)?.labelKey ?? '');
  }

  /** The submission detail is addressed by its natural key. */
  detailLink(row: EvaluationScoreRow): (string | number)[] {
    return [row.learner.id, row.course.id];
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private params(): ApiParams {
    const p: ApiParams = { page: this.page(), per_page: this.perPage, dir: this.dir() };
    if (this.search()) p['search'] = this.search();
    const id = this.templateId();
    if (id !== null) p['template_id'] = id;
    const picked = this.picked();
    for (const key of Object.keys(picked) as ChipKey[]) {
      if (picked[key].length) p[key] = picked[key];
    }
    return p;
  }

  private loadOptions(): void {
    this.optionsLoading.set(true);
    this.api
      .get<EvaluationFilterOptions>(API.ADMIN_EVALUATION_FILTER_OPTIONS)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(r => {
        const result = r?.result;
        if (result) {
          this.options.update(o => ({
            ...o,
            instructor_ids: result.instructors.map(i => ({ id: i.id, label: i.name ?? '' })),
            course_ids:     result.courses.map(c => ({ id: c.id, label: c.name ?? '' })),
          }));
          this.optionsLoaded.set(true);
        }
        this.optionsLoading.set(false);
      });
  }
}
