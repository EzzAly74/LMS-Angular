import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { NasIconComponent } from '../../../../shared/nas/nas-icon.component';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminCertificatesApiService } from '../../services/admin-certificates-api.service';
import {
  CertificateTemplateOverview,
  IssuedCertificate,
} from '../../models/certificate.types';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES     = 8 * 1024 * 1024;

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
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss',
})
export class CertificateListComponent implements OnInit, OnDestroy {
  private readonly api       = inject(AdminCertificatesApiService);
  private readonly toast     = inject(MessageService);
  private readonly destroyR  = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly t         = inject(TranslateService);

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

  /* ── Issued list state ───────────────────────────────────── */
  readonly issuedLoading = signal(true);
  readonly items         = signal<IssuedCertificate[]>([]);
  readonly total         = signal(0);

  readonly perPage   = 20;
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  page   = 1;
  search = '';

  /* ── Preview drawer + download state ──────────────────────── */
  readonly previewOpen   = signal(false);
  readonly downloadingKey = signal<string | null>(null);

  private readonly search$ = new Subject<string>();

  constructor() {
    withLocaleReload(() => {
      this.loadOverview();
      this.loadIssued();
    });
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyR))
      .subscribe(q => {
        this.search = q;
        this.page   = 1;
        this.loadIssued();
      });

    this.loadOverview();
    this.loadIssued();
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

  private loadIssued(): void {
    this.issuedLoading.set(true);
    this.api.listIssued({
      page: this.page,
      per_page: this.perPage,
      search: this.search || undefined,
    }).subscribe({
      next: res => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.issuedLoading.set(false);
      },
      error: () => this.issuedLoading.set(false),
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
   |  Pagination + search                                      |
   * ────────────────────────────────────────────────────────── */

  onPage(p: number): void { this.page = p; this.loadIssued(); }

  onSearch(term: string): void { this.search$.next(term); }

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

  rowKey(it: IssuedCertificate): string { return `${it.user_id}-${it.course_id}-${it.type}`; }

  downloadRow(it: IssuedCertificate): void {
    const key = this.rowKey(it);
    if (this.downloadingKey() === key) return;
    this.downloadingKey.set(key);

    const suggested = `${it.learner_name}_${it.course_title}.jpg`
      .replace(/[\\/:*?"<>|]+/g, '-');

    this.api.downloadIssued(it.user_id, it.course_id, suggested).subscribe({
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
