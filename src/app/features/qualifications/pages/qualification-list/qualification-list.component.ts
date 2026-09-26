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
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LocaleService } from '../../../../core/services/locale.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { pluralKey } from '../../../../core/utils/plural-key';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasConfirmModalComponent } from '../../../../shared/nas/nas-confirm-modal/nas-confirm-modal.component';
import { NasImportReportComponent } from '../../../../shared/nas/nas-import-report/nas-import-report.component';
import {
  NasActionMenuComponent,
  NasActionMenuItem,
} from '../../../../shared/nas/nas-action-menu/nas-action-menu.component';
import { QualificationDialogComponent } from '../../components/qualification-dialog/qualification-dialog.component';
import { QualificationImportError, QualificationRow } from '../../models/qualification.model';
import { QualificationsApiService, TransferFormat } from '../../services/qualifications-api.service';

type LoadState = 'loading' | 'ready' | 'error';
type Tone = 'high' | 'mid' | 'low';

/**
 * Qualifications - Figma 2066:100159 (D5).
 *
 * GET admin/qualification-skills. Every figure is measured against the
 * people the qualification applies to (D-056): Certified is holders out of
 * them, Completion their average progress through the linked courses.
 *
 * New Qualification / the row's Edit open the modal (2066:100876). Import
 * (1983:44634) takes a whole file or nothing and lists every problem by row
 * (D-034); Export (2066:99852) downloads the list as currently searched.
 */
@Component({
  selector: 'app-qualification-list',
  standalone: true,
  imports: [
    TranslateModule,
    SkeletonModule,
    MenuModule,
    NasIconComponent,
    NasPagerComponent,
    NasConfirmModalComponent,
    NasImportReportComponent,
    NasActionMenuComponent,
    QualificationDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qualification-list.component.html',
  styleUrl: './qualification-list.component.scss',
})
export class QualificationListComponent implements OnInit {
  private readonly api        = inject(QualificationsApiService);
  private readonly toast      = inject(MessageService);
  private readonly t          = inject(TranslateService);
  private readonly locale     = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly perPage = 15;
  readonly skeletons = [1, 2, 3, 4, 5];

  readonly rows    = signal<QualificationRow[]>([]);
  readonly total   = signal(0);
  readonly page    = signal(1);
  readonly search  = signal('');
  readonly state   = signal<LoadState>('loading');

  readonly dialogOpen = signal(false);
  readonly editingId  = signal<number | null>(null);

  readonly deleting     = signal<QualificationRow | null>(null);
  readonly deleteBusy   = signal(false);

  readonly importing    = signal(false);
  readonly exporting    = signal(false);
  readonly reportErrors = signal<QualificationImportError[]>([]);
  readonly reportOpen   = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly search$ = new Subject<string>();
  private rowMenuTarget: QualificationRow | null = null;

  /** Rebuilt on language change so the labels follow it. */
  readonly importItems = computed<NasActionMenuItem[]>(() => {
    this.locale.locale();
    return [
      { id: 'template', label: this.t.instant('qualifications.transfer.template'), icon: 'download-simple' },
      { id: 'xlsx', label: this.t.instant('qualifications.transfer.import_xlsx'), icon: 'file-text' },
      { id: 'csv', label: this.t.instant('qualifications.transfer.import_csv'), icon: 'file-text' },
    ];
  });

  readonly exportItems = computed<NasActionMenuItem[]>(() => {
    this.locale.locale();
    return [
      { id: 'xlsx', label: this.t.instant('qualifications.transfer.export_xlsx'), icon: 'file-text' },
      { id: 'csv', label: this.t.instant('qualifications.transfer.export_csv'), icon: 'file-text' },
    ];
  });

  readonly rowMenu = computed<MenuItem[]>(() => {
    this.locale.locale();
    return [
      { label: this.t.instant('common.edit'), command: () => this.rowMenuTarget && this.openEdit(this.rowMenuTarget) },
      {
        label: this.t.instant('common.delete'),
        styleClass: 'ql__menu-danger',
        command: () => this.rowMenuTarget && this.deleting.set(this.rowMenuTarget),
      },
    ];
  });

  /** Accept attribute for the picker, set just before it opens. */
  readonly accept = signal('.xlsx');

  constructor() {
    withLocaleReload(() => this.load());
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.search.set(term);
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  load(): void {
    this.state.set('loading');
    const params: Record<string, string | number> = { page: this.page(), per_page: this.perPage };
    if (this.search()) params['search'] = this.search();
    this.api.list(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.rows.set(res.result.data);
        this.total.set(res.result.total);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  onSearch(term: string): void {
    this.search$.next(term.trim());
  }

  onPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  // ── Row figures ─────────────────────────────────────────────────────────
  countKey(base: string, n: number): string {
    return pluralKey(`qualifications.count.${base}`, n, this.locale.locale());
  }

  /** Figma: green 90%, slate 55%, red 41%. */
  tone(percent: number): Tone {
    if (percent >= 80) return 'high';
    if (percent >= 50) return 'mid';
    return 'low';
  }

  // ── Create / edit / delete ───────────────────────────────────────────────
  openCreate(): void {
    this.editingId.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(row: QualificationRow): void {
    this.editingId.set(row.id);
    this.dialogOpen.set(true);
  }

  openRowMenu(menu: { toggle: (e: Event) => void }, row: QualificationRow, event: Event): void {
    this.rowMenuTarget = row;
    menu.toggle(event);
  }

  onSaved(): void {
    if (this.editingId() === null) this.page.set(1);
    this.load();
  }

  confirmDelete(): void {
    const row = this.deleting();
    if (!row) return;
    this.deleteBusy.set(true);
    this.api.delete(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.deleting.set(null);
        this.toast.add({ severity: 'success', summary: this.t.instant('common.success_title'), detail: this.t.instant('qualifications.deleted') });
        if (this.rows().length === 1 && this.page() > 1) this.page.update(p => p - 1);
        this.load();
      },
      // The error interceptor toasts the reason.
      error: () => this.deleteBusy.set(false),
    });
  }

  // ── Import / Export ──────────────────────────────────────────────────────
  onImportPick(id: string): void {
    if (id === 'template') {
      this.api.importTemplate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        error: (e: unknown) => this.fail(e),
      });
      return;
    }
    this.accept.set(id === 'csv' ? '.csv,text/csv' : '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Let the new accept attribute render before the picker opens.
    queueMicrotask(() => this.fileInput()?.nativeElement.click());
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be chosen again after a fix
    if (!file) return;

    this.importing.set(true);
    this.api.import(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: report => {
        this.importing.set(false);
        if (report.errors.length === 0) {
          this.toast.add({
            severity: 'success',
            summary: this.t.instant('common.success_title'),
            detail: this.t.instant('qualifications.transfer.imported', { count: report.created }),
          });
          this.page.set(1);
          this.load();
          return;
        }
        this.reportErrors.set(report.errors);
        this.reportOpen.set(true);
      },
      error: (e: unknown) => {
        this.importing.set(false);
        this.fail(e);
      },
    });
  }

  onExportPick(id: string): void {
    const format: TransferFormat = id === 'csv' ? 'csv' : 'xlsx';
    this.exporting.set(true);
    this.api.export(format, this.search()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: (e: unknown) => {
        this.exporting.set(false);
        this.fail(e);
      },
    });
  }

  /** The API's message (422 / 429), else a generic one. */
  private fail(e: unknown): void {
    let detail = this.t.instant('common.operation_failed');
    if (e instanceof HttpErrorResponse) {
      const first = Object.values((e.error?.errors ?? {}) as Record<string, string[]>).flat()[0];
      if (typeof first === 'string') detail = first;
      else if (e.status === 429) detail = this.t.instant('qualifications.transfer.too_many');
    }
    this.toast.add({ severity: 'error', summary: this.t.instant('common.error_title'), detail });
  }
}
