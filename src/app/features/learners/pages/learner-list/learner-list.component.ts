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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiService, ApiParams } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasAvatarComponent } from '../../../../shared/nas/nas-avatar/nas-avatar.component';
import { NasDatepickerComponent } from '../../../../shared/nas/nas-datepicker/nas-datepicker.component';
import {
  NasFilterOption,
  NasFilterPickerComponent,
} from '../../../../shared/nas/nas-filter-picker/nas-filter-picker.component';
import { NasDatePipe, NasRelativeTimePipe } from '../../../../shared/pipes/nas-date.pipes';
import {
  LEARNER_TYPES,
  LearnerFilterKey,
  LearnerFilters,
  LearnerRow,
  LearnerType,
} from '../../models/learner.model';

type LoadState = 'loading' | 'ready' | 'error';

interface Chip {
  key: LearnerFilterKey;
  labelKey: string;
}

const EMPTY_FILTERS: LearnerFilters = {
  course_instructor_ids: [],
  learner_types: [],
  course_ids: [],
  qualification_ids: [],
};

/**
 * Learners list - Figma 1986:74701 (D3).
 *
 * GET admin/users?role=learner, with the Learners filters added in B2/D3
 * (D-053): the chips pick the instructors who teach the learner's courses,
 * the learner type, courses and qualifications; From/To bound the last
 * activity. Each chip opens the shared "Filter your results" picker.
 */
@Component({
  selector: 'app-learner-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    SkeletonModule,
    NasIconComponent,
    NasAvatarComponent,
    NasDatepickerComponent,
    NasFilterPickerComponent,
    NasDatePipe,
    NasRelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './learner-list.component.html',
  styleUrl: './learner-list.component.scss',
})
export class LearnerListComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;

  /** Figma: "1-15 of 109". */
  readonly perPage   = 15;
  readonly skeletons = Array.from({ length: 6 }, (_, i) => i);

  readonly chips: Chip[] = [
    { key: 'course_instructor_ids', labelKey: 'learners.chip.instructors' },
    { key: 'learner_types',         labelKey: 'learners.chip.learners' },
    { key: 'course_ids',            labelKey: 'learners.chip.courses' },
    { key: 'qualification_ids',     labelKey: 'learners.chip.qualification' },
  ];

  readonly rows    = signal<LearnerRow[]>([]);
  readonly total   = signal(0);
  readonly page    = signal(1);
  readonly state   = signal<LoadState>('loading');
  readonly search  = signal('');
  readonly from    = signal<Date | null>(null);
  readonly to      = signal<Date | null>(null);
  readonly filters = signal<LearnerFilters>({ ...EMPTY_FILTERS });

  /**
   * One picker serves every chip. `pickerKey` is the chip it currently
   * belongs to and survives closing, so the dialog can animate out and
   * restore focus instead of being torn down mid-close.
   */
  readonly pickerKey     = signal<LearnerFilterKey>('course_instructor_ids');
  readonly pickerVisible = signal(false);
  readonly options = signal<Record<LearnerFilterKey, NasFilterOption[]>>({
    course_instructor_ids: [], learner_types: [], course_ids: [], qualification_ids: [],
  });
  readonly optionsLoading = signal(false);

  readonly anyFilter  = computed(() => Object.values(this.filters()).some(v => v.length > 0));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage + 1));
  readonly rangeEnd   = computed(() => Math.min(this.page() * this.perPage, this.total()));

  private readonly fetch$  = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly courseSearch$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => {
      this.fetch$.next();
      // Option labels (course titles, qualification names) are localised.
      this.options.set({ course_instructor_ids: [], learner_types: [], course_ids: [], qualification_ids: [] });
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          return this.api.getPaginated<LearnerRow>(API.ADMIN_USERS, this.params()).pipe(
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
        this.rows.set(result.res.result.data);
        this.total.set(result.res.result.total);
        this.state.set('ready');
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term.trim());
        this.reload();
      });

    // No distinctUntilChanged here: reopening the picker re-sends the same
    // (empty) term when the first load found nothing, and swallowing it would
    // leave the picker loading forever. switchMap already drops stale results.
    this.courseSearch$
      .pipe(
        debounceTime(300),
        switchMap(term => this.loadCourses(term)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(opts => this.setOptions('course_ids', opts));

    this.fetch$.next();
  }

  /** Back to page 1 and refetch: used by every filter change. */
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

  onFrom(d: Date | null): void {
    this.from.set(d);
    this.reload();
  }

  onTo(d: Date | null): void {
    this.to.set(d);
    this.reload();
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
    this.fetch$.next();
  }

  // ── Chips ──────────────────────────────────────────────────────────────
  clearFilters(): void {
    if (!this.anyFilter()) return;
    this.filters.set({ ...EMPTY_FILTERS });
    this.reload();
  }

  isActive(key: LearnerFilterKey): boolean {
    return this.filters()[key].length > 0;
  }

  count(key: LearnerFilterKey): number {
    return this.filters()[key].length;
  }

  selectedFor(key: LearnerFilterKey): readonly (number | string)[] {
    return this.filters()[key];
  }

  openPicker(key: LearnerFilterKey): void {
    this.pickerKey.set(key);
    this.pickerVisible.set(true);
    if (this.options()[key].length === 0) this.loadOptions(key);
  }

  onPick(key: LearnerFilterKey, ids: (number | string)[]): void {
    const nums = ids.filter((v): v is number => typeof v === 'number');
    this.filters.update((f): LearnerFilters => {
      switch (key) {
        case 'learner_types':         return { ...f, learner_types: ids.filter(isLearnerType) };
        case 'course_instructor_ids': return { ...f, course_instructor_ids: nums };
        case 'course_ids':            return { ...f, course_ids: nums };
        case 'qualification_ids':     return { ...f, qualification_ids: nums };
      }
    });
    this.reload();
  }

  onPickerSearch(key: LearnerFilterKey, term: string): void {
    // Courses can outgrow one page of options, so their search goes to the
    // server; the other lists are small and filtered in the picker.
    if (key === 'course_ids') this.courseSearch$.next(term);
  }

  pickerLabel(key: LearnerFilterKey): string {
    return this.t.instant(this.chips.find(c => c.key === key)?.labelKey ?? '');
  }

  // ── Cells ──────────────────────────────────────────────────────────────
  /** Figma's bar colours: red below half, slate from half, green when complete. */
  tone(pct: number): 'low' | 'mid' | 'full' {
    if (pct >= 100) return 'full';
    if (pct >= 50) return 'mid';
    return 'low';
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private params(): ApiParams {
    const f = this.filters();
    const p: ApiParams = { role: 'learner', page: this.page(), per_page: this.perPage };
    if (this.search()) p['search'] = this.search();
    for (const key of Object.keys(f) as LearnerFilterKey[]) {
      if (f[key].length) p[key] = f[key];
    }
    const from = this.from();
    const to = this.to();
    if (from) p['active_from'] = ymd(from);
    if (to) p['active_to'] = ymd(to);
    return p;
  }

  private loadOptions(key: LearnerFilterKey): void {
    if (key === 'learner_types') {
      this.setOptions(key, LEARNER_TYPES.map(type => ({ id: type, label: this.t.instant(`learners.type.${type}`) })));
      return;
    }
    if (key === 'course_ids') {
      this.courseSearch$.next('');
      this.optionsLoading.set(true);
      return;
    }
    this.optionsLoading.set(true);
    const source$ = key === 'course_instructor_ids'
      ? this.api.get<{ instructors: { id: number; name: string }[] }>(`${API.ADMIN_USERS}/filter-options`)
          .pipe(map(r => (r.result?.instructors ?? []).map(i => ({ id: i.id, label: i.name }))))
      : this.api.get<{ id: number; name: string }[]>(API.QUALIFICATIONS_ACTIVE)
          .pipe(map(r => (r.result ?? []).map(q => ({ id: q.id, label: q.name }))));
    source$
      .pipe(catchError(() => of([] as NasFilterOption[])), takeUntilDestroyed(this.destroyRef))
      .subscribe(opts => this.setOptions(key, opts));
  }

  private loadCourses(term: string) {
    this.optionsLoading.set(true);
    return this.api
      .getPaginated<{ id: number; title: string }>(API.COURSES, { per_page: 100, ...(term ? { search: term } : {}) })
      .pipe(
        map(r => r.result.data.map(c => ({ id: c.id, label: c.title }))),
        catchError(() => of([] as NasFilterOption[])),
      );
  }

  private setOptions(key: LearnerFilterKey, opts: NasFilterOption[]): void {
    this.options.update(o => ({ ...o, [key]: opts }));
    this.optionsLoading.set(false);
  }
}

function isLearnerType(v: number | string): v is LearnerType {
  return (LEARNER_TYPES as readonly (number | string)[]).includes(v);
}

/** A local calendar date as Y-m-d (not toISOString, which shifts by the UTC offset). */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
