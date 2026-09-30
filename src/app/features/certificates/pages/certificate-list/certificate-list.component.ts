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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header/nas-page-header.component';
import { NasIconComponent } from '../../../../shared/nas/nas-icon/nas-icon.component';
import { NasPagerComponent } from '../../../../shared/nas/nas-pager/nas-pager.component';
import { NasListToolbarComponent } from '../../../../shared/nas/nas-list-toolbar/nas-list-toolbar.component';
import { NasTableCardComponent } from '../../../../shared/nas/nas-table-card/nas-table-card.component';
import {
  NasListStateComponent, NasSkeletonRowComponent, SKELETON_ROWS, type NasSkeletonCell,
} from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { createPagedList, pagedParams, toPaged, type PagedQuery } from '../../../../shared/list/paged-list';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { LocaleService } from '../../../../core/services/locale.service';
import { AdminCertificatesApiService } from '../../services/admin-certificates-api.service';
import {
  CertificateTemplateOverview,
  IssuedCertificate,
} from '../../models/certificate.types';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES     = 8 * 1024 * 1024;
/** Characters a file name may not hold on Windows / macOS. */
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]+/g;

/** An issued-certificates row with its key and download name worked out once per load. */
interface IssuedRow extends IssuedCertificate {
  readonly key: string;
  readonly fileName: string;
}

/**
 * Certificates (Figma 377:10597 / 376:10149 template card, 377:11055 preview
 * drawer). The template card and drawer are this page's own; the Issued
 * Certificates table is the Dashboard's shared list (D-070): search-only
 * toolbar, table card, skeleton rows, empty / error states and pager.
 */
@Component({
  selector: 'app-certificate-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SkeletonModule,
    ToastModule,
    TranslateModule,
    NasPageHeaderComponent,
    NasIconComponent,
    NasPagerComponent,
    NasListToolbarComponent,
    NasTableCardComponent,
    NasListStateComponent,
    NasSkeletonRowComponent,
    NasDatePipe,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss',
})
export class CertificateListComponent implements OnInit, OnDestroy {
  private readonly api       = inject(AdminCertificatesApiService);
  private readonly toast     = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly t         = inject(TranslateService);
  protected readonly locale  = inject(LocaleService);

  /* ── Template card state ─────────────────────────────────── */
  readonly overviewLoading = signal(true);
  readonly overview        = signal<CertificateTemplateOverview | null>(null);
  readonly uploading       = signal(false);

  readonly template      = computed(() => this.overview()?.template ?? null);
  readonly stats         = computed(() => this.overview()?.stats ?? { total_issued: 0, last_issued_at: null });
  readonly autoFields    = computed(() => this.overview()?.fields ?? []);
  readonly hasTemplate   = computed(() => !!this.template()?.has_file);

  /**
   * Object-URL for the active template file, lazily loaded the first
   * time the user opens the preview drawer. Streamed through HttpClient
   * so the auth interceptor attaches the Bearer token (the
   * `storage:link` symlink is unreliable under `php artisan serve` on
   * Windows, so we never link to `/storage/...` directly).
   */
  readonly templateBlobUrl     = signal<string | null>(null);
  readonly templateSafeUrl     = signal<SafeResourceUrl | null>(null);
  readonly templateBlobLoading = signal(false);
  readonly templateBlobError   = signal(false);

  readonly isPdf = computed(() => {
    const t = this.template();
    if (!t) return false;
    if (t.mime_type === 'application/pdf') return true;
    return /\.pdf$/i.test(t.original_filename ?? '');
  });

  /* ── Issued list: the shared list pieces (D-070) ─────────── */
  readonly skeletons = SKELETON_ROWS;
  readonly skeletonCells: readonly NasSkeletonCell[] = ['short', 'person', 'text', 'short', 'action'];

  readonly list = createPagedList<PagedQuery, IssuedRow>({
    initial: { search: '', page: 1, perPage: 20 },
    load: q => this.api.listIssued(pagedParams(q)).pipe(toPaged(it => ({
      ...it,
      key: `${it.user_id}-${it.course_id}-${it.type}`,
      fileName: `${it.learner_name}_${it.course_title}.jpg`.replace(UNSAFE_FILE_CHARS, '-'),
    }))),
  });

  /* ── Preview drawer + download state ──────────────────────── */
  readonly previewOpen   = signal(false);
  readonly downloadingKey = signal<string | null>(null);

  constructor() {
    withLocaleReload(() => {
      this.loadOverview();
      this.list.reload();
    });
  }

  ngOnInit(): void {
    this.loadOverview();
    this.list.reload();
  }

  ngOnDestroy(): void {
    this.revokeTemplateBlob();
  }

  /* ────────────────────────────────────────────────────────── *
   |  Loaders                                                  |
   * ────────────────────────────────────────────────────────── */

  private loadOverview(): void {
    this.overviewLoading.set(true);
    this.api.getOverview().subscribe({
      next: ov => { this.overview.set(ov); this.overviewLoading.set(false); },
      error: () => this.overviewLoading.set(false),
    });
  }

  private loadTemplateBlob(): void {
    this.templateBlobError.set(false);
    this.templateBlobLoading.set(true);

    this.api.getTemplateFileBlob().subscribe({
      next: blob => {
        this.revokeTemplateBlob();
        const url = URL.createObjectURL(blob);
        this.templateBlobUrl.set(url);
        this.templateSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.templateBlobLoading.set(false);
      },
      error: () => {
        this.templateBlobLoading.set(false);
        this.templateBlobError.set(true);
      },
    });
  }

  private revokeTemplateBlob(): void {
    const prev = this.templateBlobUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.templateBlobUrl.set(null);
    this.templateSafeUrl.set(null);
  }

  /* ────────────────────────────────────────────────────────── *
   |  Template upload                                          |
   * ────────────────────────────────────────────────────────── */

  triggerUpload(input: HTMLInputElement): void {
    if (this.uploading()) return;
    input.value = '';
    input.click();
  }

  onFileChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadTemplateFile(file);
  }

  private uploadTemplateFile(file: File): void {
    if (!ALLOWED_MIMES.includes(file.type) && !/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) {
      this.toast.add({
        severity: 'error',
        summary:  this.t.instant('certificates_toasts.unsupported_type'),
        detail:   this.t.instant('certificates_toasts.upload_invalid_type'),
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      this.toast.add({
        severity: 'error',
        summary:  this.t.instant('certificates_toasts.file_too_large'),
        detail:   this.t.instant('certificates_toasts.upload_max_size'),
      });
      return;
    }

    this.uploading.set(true);
    this.api.uploadTemplate(file).subscribe({
      next: ov => {
        // Invalidate any stale blob — the next openPreview() will fetch
        // the freshly-uploaded file on demand.
        this.revokeTemplateBlob();
        this.overview.set(ov);

        this.uploading.set(false);
        this.toast.add({
          severity: 'success',
          summary:  this.t.instant('certificates_toasts.template_updated'),
          detail:   this.t.instant('certificates_toasts.template_active', { name: file.name }),
        });
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.add({
          severity: 'error',
          summary:  this.t.instant('certificates_toasts.upload_failed'),
          detail:   err?.error?.message || this.t.instant('certificates_toasts.upload_failed_detail'),
        });
      },
    });
  }

  /* ────────────────────────────────────────────────────────── *
   |  Preview drawer                                           |
   * ────────────────────────────────────────────────────────── */

  openPreview(): void {
    if (!this.hasTemplate()) return;
    if (!this.templateBlobUrl() && !this.templateBlobLoading()) {
      this.loadTemplateBlob();
    }
    this.previewOpen.set(true);
  }

  closePreview(): void {
    this.previewOpen.set(false);
  }

  /* ────────────────────────────────────────────────────────── *
   |  Per-row download                                         |
   * ────────────────────────────────────────────────────────── */

  downloadRow(it: IssuedRow): void {
    if (this.downloadingKey() === it.key) return;
    this.downloadingKey.set(it.key);

    this.api.downloadIssued(it.user_id, it.course_id, it.fileName).subscribe({
      next: () => this.downloadingKey.set(null),
      error: () => {
        this.downloadingKey.set(null);
        this.toast.add({
          severity: 'error',
          summary:  this.t.instant('certificates_toasts.download_failed_title'),
          detail:   this.t.instant('certificates_toasts.download_failed'),
        });
      },
    });
  }
}
