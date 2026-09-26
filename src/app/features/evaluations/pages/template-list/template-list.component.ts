import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiParams, ApiService } from '../../../../core/services/api.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasDatepickerComponent } from '../../../../shared/nas/nas-datepicker/nas-datepicker.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasImportReportComponent } from '../../../../shared/nas/nas-import-report/nas-import-report.component';
import {
  NasFilterOption,
  NasFilterPickerComponent,
} from '../../../../shared/nas/nas-filter-picker/nas-filter-picker.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { pluralKey } from '../../../../core/utils/plural-key';
import { EvScoreComponent } from '../../components/ev-score/ev-score.component';
import {
  EVALUATION_RESULTS,
  EvaluationFilterOptions,
  EvaluationResult,
  EvaluationTemplateRow,
  ImportReport,
} from '../../models/evaluation.model';
import { ymd } from '../../evaluation-params';
import { EvaluationTemplatesApiService, TransferFormat } from '../../services/evaluation-templates-api.service';

type LoadState = 'loading' | 'ready' | 'error';
type ChipKey = 'instructor_ids' | 'course_ids';
type SortKey = 'created_at' | 'name';

/**
 * Evaluation Templates - Figma 2009:88432 (D4).
 *
 * GET admin/evaluations/templates. The Instructors and Courses chips narrow
 * the responses each row aggregates; the checkboxes filter on the template's
 * score against the pass threshold (D-054); From/To bound the last response.
 *
 * Create Template opens the builder (2409:132793). Import takes a whole file
 * or nothing and shows every problem by row (D-034); Export downloads the
 * list as currently filtered. Edit is offered only on templates nobody has
 * answered yet (decided 2026-09-26) - the API refuses it regardless.
 */
@Component({
  selector: 'app-evaluation-template-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslateModule,
    SkeletonModule,
    MenuModule,
    NasIconComponent,
    NasDatepickerComponent,
    NasPagerComponent,
    NasImportReportComponent,
    NasFilterPickerComponent,
    NasDatePipe,
    EvScoreComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class EvaluationTemplateListComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly t          = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale   = inject(LocaleService).locale;
  private readonly transfer   = inject(EvaluationTemplatesApiService);
  private readonly toast      = inject(MessageService);

  /** Figma: "Showing 1-8 of 8 templates". */
  readonly perPage   = 8;
  readonly skeletons = Array.from({ length: 5 }, (_, i) => i);
  readonly results   = EVALUATION_RESULTS;

  readonly chips: { key: ChipKey; labelKey: string }[] = [
    { key: 'instructor_ids', labelKey: 'evaluations.chip.instructors' },
    { key: 'course_ids',     labelKey: 'evaluations.chip.courses' },
  ];

  readonly rows     = signal<EvaluationTemplateRow[]>([]);
  readonly total    = signal(0);
  readonly page     = signal(1);
  readonly state    = signal<LoadState>('loading');
  readonly search   = signal('');
  readonly from     = signal<Date | null>(null);
  readonly to       = signal<Date | null>(null);
  readonly picked   = signal<Record<ChipKey, number[]>>({ instructor_ids: [], course_ids: [] });
  readonly result   = signal<EvaluationResult[]>([]);
  readonly sort     = signal<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' });

  readonly recent      = signal<EvaluationTemplateRow[]>([]);
  readonly recentState = signal<LoadState>('loading');

  readonly pickerKey      = signal<ChipKey>('instructor_ids');
  readonly pickerVisible  = signal(false);
  readonly options        = signal<Record<ChipKey, NasFilterOption[]> | null>(null);
  readonly optionsLoading = signal(false);

  readonly anyChip    = computed(() => this.picked().instructor_ids.length + this.picked().course_ids.length > 0);
  readonly narrowed   = computed(() => this.anyChip() || this.result().length > 0 || !!this.search() || !!this.from() || !!this.to());
  readonly lastPage   = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));

  /** Import / Export menus (Figma: outline buttons with a caret). */
  readonly importing    = signal(false);
  readonly exporting    = signal(false);
  readonly importReport = signal<ImportReport | null>(null);
  readonly reportOpen   = signal(false);
  readonly importItems  = computed<MenuItem[]>(() => {
    this.locale();
    return [
      { label: this.t.instant('evaluations.transfer.template_xlsx'), command: () => this.downloadTemplate('xlsx') },
      { label: this.t.instant('evaluations.transfer.template_csv'),  command: () => this.downloadTemplate('csv') },
      { separator: true },
      { label: this.t.instant('evaluations.transfer.upload'), command: () => this.pickFile() },
    ];
  });
  readonly exportItems = computed<MenuItem[]>(() => {
    this.locale();
    return [
      { label: this.t.instant('evaluations.transfer.export_xlsx'), command: () => this.exportList('xlsx') },
      { label: this.t.instant('evaluations.transfer.export_csv'),  command: () => this.exportList('csv') },
    ];
  });

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly fetch$  = new Subject<void>();
  private readonly search$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => {
      // Template, course and instructor names are localised by the API.
      this.fetch$.next();
      this.loadRecent();
      this.options.set(null);
    });
  }

  ngOnInit(): void {
    this.fetch$
      .pipe(
        switchMap(() => {
          this.state.set('loading');
          return this.api.getPaginated<EvaluationTemplateRow>(API.ADMIN_EVALUATION_TEMPLATES, this.params()).pipe(
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

    this.fetch$.next();
    this.loadRecent();
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

  onFrom(d: Date | null): void {
    this.from.set(d);
    this.reload();
  }

  onTo(d: Date | null): void {
    this.to.set(d);
    this.reload();
  }

  goTo(p: number): void {
    if (p < 1 || p > this.lastPage() || p === this.page()) return;
    this.page.set(p);
    this.fetch$.next();
  }

  toggleSortByName(): void {
    const s = this.sort();
    this.sort.set(s.key === 'name' ? { key: 'name', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'name', dir: 'asc' });
    this.reload();
  }

  ariaSort(): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    if (s.key !== 'name') return 'none';
    return s.dir === 'asc' ? 'ascending' : 'descending';
  }

  // ── Result checkboxes ("All" means none ticked) ────────────────────────
  isResult(r: EvaluationResult): boolean {
    return this.result().includes(r);
  }

  toggleResult(r: EvaluationResult): void {
    this.result.update(list => (list.includes(r) ? list.filter(x => x !== r) : [...list, r]));
    this.reload();
  }

  clearResults(): void {
    if (this.result().length === 0) return;
    this.result.set([]);
    this.reload();
  }

  // ── Chips ──────────────────────────────────────────────────────────────
  clearChips(): void {
    if (!this.anyChip()) return;
    this.picked.set({ instructor_ids: [], course_ids: [] });
    this.reload();
  }

  count(key: ChipKey): number {
    return this.picked()[key].length;
  }

  openPicker(key: ChipKey): void {
    this.pickerKey.set(key);
    this.pickerVisible.set(true);
    if (!this.options()) this.loadOptions();
  }

  onPick(key: ChipKey, ids: (number | string)[]): void {
    const nums = ids.filter((v): v is number => typeof v === 'number');
    this.picked.update(p => ({ ...p, [key]: nums }));
    this.reload();
  }

  responsesKey(n: number): string {
    return pluralKey('evaluations.templates.responses', n, this.locale());
  }

  pickerLabel(key: ChipKey): string {
    return this.t.instant(this.chips.find(c => c.key === key)?.labelKey ?? '');
  }

  // ── Import / Export ────────────────────────────────────────────────────
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be chosen again after a fix
    if (!file) return;

    this.importing.set(true);
    this.transfer.import(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: report => {
        this.importing.set(false);
        if (report.errors.length === 0) {
          this.toast.add({
            severity: 'success',
            summary: this.t.instant('common.success_title'),
            detail: this.t.instant('evaluations.transfer.imported', { templates: report.created, questions: report.questions }),
          });
          this.reload();
          this.loadRecent();
          return;
        }
        this.importReport.set(report);
        this.reportOpen.set(true);
      },
      error: (e: unknown) => {
        this.importing.set(false);
        this.toast.add({ severity: 'error', summary: this.t.instant('common.error_title'), detail: this.serverMessage(e) });
      },
    });
  }

  private pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  private downloadTemplate(format: TransferFormat): void {
    this.transfer.importTemplate(format).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: (e: unknown) => this.toast.add({ severity: 'error', summary: this.t.instant('common.error_title'), detail: this.serverMessage(e) }),
    });
  }

  private exportList(format: TransferFormat): void {
    const { page: _page, per_page: _perPage, ...filters } = this.params();
    this.exporting.set(true);
    this.transfer.export(format, filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: (e: unknown) => {
        this.exporting.set(false);
        this.toast.add({ severity: 'error', summary: this.t.instant('common.error_title'), detail: this.serverMessage(e) });
      },
    });
  }

  /** The API's message (422 / 429), else a generic one. */
  private serverMessage(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const first = Object.values((e.error?.errors ?? {}) as Record<string, string[]>).flat()[0];
      if (typeof first === 'string') return first;
      if (e.status === 429) return this.t.instant('evaluations.transfer.too_many');
    }
    return this.t.instant('common.operation_failed');
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private params(): ApiParams {
    const p: ApiParams = {
      page: this.page(),
      per_page: this.perPage,
      sort: this.sort().key,
      dir: this.sort().dir,
    };
    if (this.search()) p['search'] = this.search();
    const picked = this.picked();
    if (picked.instructor_ids.length) p['instructor_ids'] = picked.instructor_ids;
    if (picked.course_ids.length) p['course_ids'] = picked.course_ids;
    if (this.result().length) p['results'] = this.result();
    const from = this.from();
    const to = this.to();
    if (from) p['scored_from'] = ymd(from);
    if (to) p['scored_to'] = ymd(to);
    return p;
  }

  /** "Recently Created": the two newest templates, independent of the filters. */
  private loadRecent(): void {
    this.recentState.set('loading');
    this.api
      .getPaginated<EvaluationTemplateRow>(API.ADMIN_EVALUATION_TEMPLATES, { per_page: 2, sort: 'created_at', dir: 'desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.recent.set(res.result.data);
          this.recentState.set('ready');
        },
        error: () => this.recentState.set('error'),
      });
  }

  private loadOptions(): void {
    this.optionsLoading.set(true);
    this.api
      .get<EvaluationFilterOptions>(API.ADMIN_EVALUATION_FILTER_OPTIONS)
      .pipe(
        map(r => ({
          instructor_ids: (r.result?.instructors ?? []).map(o => ({ id: o.id, label: o.name ?? '' })),
          course_ids:     (r.result?.courses ?? []).map(o => ({ id: o.id, label: o.name ?? '' })),
        })),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(opts => {
        this.options.set(opts);
        this.optionsLoading.set(false);
      });
  }
}
