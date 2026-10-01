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
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import {
  NasRowMenuComponent, type NasRowAction, type NasRowActionPick,
} from '../../../../shared/nas/nas-row-menu/nas-row-menu.component';
import { createPagedList, pagedParams, toPaged, type PagedQuery } from '../../../../shared/list/paged-list';
import { QualificationDialogComponent } from '../../components/qualification-dialog/qualification-dialog.component';
import { QualificationImportError, QualificationRow } from '../../models/qualification.model';
import { QualificationsApiService, TransferFormat } from '../../services/qualifications-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { AuthService } from '../../../../core/services/auth.service';

type Tone = 'high' | 'mid' | 'low';
type RowActionId = 'edit' | 'delete';

/** A table row: its plural keys and completion tone, worked out once per load. */
interface QualificationListRow extends QualificationRow {
  readonly coursesKey: string;
  readonly titlesKey: string;
  readonly learnersKey: string;
  readonly tone: Tone | null;
}

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
 * The toolbar (search only: the frame has no filters), table card, states,
 * row menu and pager are the Dashboard's shared list pieces (D-070).
 */
@Component({
  selector: 'app-qualification-list',
  standalone: true,
  imports: [NasCanDirective, 
    TranslateModule,
    NasIconComponent,
    NasPagerComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasRowMenuComponent,
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
  protected readonly auth = inject(AuthService);
  private readonly api        = inject(QualificationsApiService);
  private readonly toast      = inject(ToastService);
  private readonly t          = inject(TranslateService);
  private readonly locale     = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletons = SKELETON_ROWS;
  readonly skeletonCells: readonly NasSkeletonCell[] = ['title', 'pill', 'num', 'short', 'bar', 'pill', 'pill', 'action'];

  readonly list = createPagedList<PagedQuery, QualificationListRow>({
    initial: { search: '', page: 1, perPage: 15 },
    load: q => this.api.list(pagedParams(q)).pipe(toPaged(r => this.toRow(r))),
    // AdminQualificationListRequest caps per_page at 100.
    showAllPerPage: 100,
  });

  readonly dialogOpen = signal(false);
  readonly editingId  = signal<number | null>(null);

  readonly deleting     = signal<QualificationListRow | null>(null);
  readonly deleteBusy   = signal(false);

  readonly importing    = signal(false);
  readonly exporting    = signal(false);
  readonly reportErrors = signal<QualificationImportError[]>([]);
  readonly reportOpen   = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** Rebuilt on language change so the labels follow it. */
  readonly importItems = computed<NasActionMenuItem[]>(() => {
    this.locale.locale();
    // Uploading creates qualifications; the blank template is for anyone.
    const upload = this.auth.can('create-qualifications');
    return [
      { id: 'template', label: this.t.instant('qualifications.transfer.template'), icon: 'download-simple' },
      ...(upload ? [
        { id: 'xlsx', label: this.t.instant('qualifications.transfer.import_xlsx'), icon: 'file-text' },
        { id: 'csv', label: this.t.instant('qualifications.transfer.import_csv'), icon: 'file-text' },
      ] : []),
    ];
  });

  readonly exportItems = computed<NasActionMenuItem[]>(() => {
    this.locale.locale();
    return [
      { id: 'xlsx', label: this.t.instant('qualifications.transfer.export_xlsx'), icon: 'file-text' },
      { id: 'csv', label: this.t.instant('qualifications.transfer.export_csv'), icon: 'file-text' },
    ];
  });

  /** Row menu entries: the same for every qualification. */
  readonly rowActions = (_row: QualificationListRow): readonly NasRowAction<RowActionId>[] => [
    ...(this.auth.can('edit-qualifications')
      ? [{ id: 'edit' as const, label: this.t.instant('common.edit'), icon: 'assets/icons/figma/pencil-simple.svg' }]
      : []),
    ...(this.auth.can('delete-qualifications')
      ? [{ id: 'delete' as const, label: this.t.instant('common.delete'), icon: 'trash', danger: true }]
      : []),
  ];

  /** Accept attribute for the picker, set just before it opens. */
  readonly accept = signal('.xlsx');

  constructor() {
    // Names and plural keys follow the language, so a switch refetches.
    withLocaleReload(() => this.list.reload());
  }

  ngOnInit(): void {
    this.list.reload();
  }

  private toRow(q: QualificationRow): QualificationListRow {
    const locale = this.locale.locale();
    const key = (base: string, n: number) => pluralKey(`qualifications.count.${base}`, n, locale);
    return {
      ...q,
      coursesKey: key('courses', q.courses_count),
      titlesKey: key('titles', q.job_titles_count),
      learnersKey: key('learners', q.learners_count),
      tone: q.completion_percent === null ? null : completionTone(q.completion_percent),
    };
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

  onRowAction(e: NasRowActionPick<QualificationListRow, RowActionId>): void {
    if (e.id === 'edit') this.openEdit(e.row);
    else this.deleting.set(e.row);
  }

  /** A new one lands on page 1 (newest first); an edit stays where it is. */
  onSaved(): void {
    if (this.editingId() === null) this.list.goTo(1);
    else this.list.reload();
  }

  confirmDelete(): void {
    const row = this.deleting();
    if (!row) return;
    this.deleteBusy.set(true);
    this.api.delete(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.deleting.set(null);
        this.toast.success('qualifications.deleted');
        // Deleting the last row of a page steps back to the one before.
        const page = this.list.query().page;
        if (this.list.items().length === 1 && page > 1) this.list.goTo(page - 1);
        else this.list.reload();
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
          this.toast.success('qualifications.transfer.imported', { params: { count: report.created } });
          this.list.goTo(1);
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
    this.api.export(format, this.list.query().search).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.toast.error(detail);
  }
}

/** Figma: green 90%, slate 55%, red 41%. */
function completionTone(percent: number): Tone {
  if (percent >= 80) return 'high';
  if (percent >= 50) return 'mid';
  return 'low';
}
