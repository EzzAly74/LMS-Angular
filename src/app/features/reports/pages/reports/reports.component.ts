import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { SkeletonModule } from 'primeng/skeleton';
import { NasPageHeaderComponent } from '../../../../shared/nas/nas-page-header.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

type ReportFormat = 'csv' | 'xlsx';

interface ReportCard {
  key: string;
  label: string;
  description: string;
  icon: string;
  last_generated_at: string | null;
}

interface CompliancePreviewRow {
  role: string;
  department: string | null;
  learners: number;
  qualified: number;
  compliance_pct: number;
}

/** Maps backend icon slugs to PrimeIcons. */
const ICON_MAP: Record<string, string> = {
  'shield-check':   'pi pi-shield',
  'user':           'pi pi-user',
  'calendar-check': 'pi pi-calendar',
  'chart':          'pi pi-chart-line',
  'chart-bar':      'pi pi-chart-bar',
  'badge':          'pi pi-star',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, TranslateModule, SkeletonModule, NasPageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly cards          = signal<ReportCard[]>([]);
  readonly cardsLoading   = signal(true);
  readonly preview        = signal<CompliancePreviewRow[]>([]);
  readonly previewLoading = signal(true);

  /** Active export keys, keyed by `${type}:${format}` for per-card spinners. */
  readonly downloading = signal<Record<string, boolean>>({});
  readonly downloadingAll = signal(false);

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  ngOnInit(): void {
    this.refresh();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */

  refresh(): void {
    this.loadCards();
    this.loadPreview();
  }

  private loadCards(): void {
    this.cardsLoading.set(true);
    this.api.get<ReportCard[]>(`${API.ADMIN_REPORTS}/summary`).subscribe({
      next: res => {
        this.cards.set(Array.isArray(res.result) ? res.result : []);
        this.cardsLoading.set(false);
      },
      error: () => this.cardsLoading.set(false),
    });
  }

  private loadPreview(): void {
    this.previewLoading.set(true);
    this.api.get<{ rows: CompliancePreviewRow[] }>(`${API.ADMIN_REPORTS}/compliance-preview`).subscribe({
      next: res => {
        this.preview.set(res.result.rows ?? []);
        this.previewLoading.set(false);
      },
      error: () => this.previewLoading.set(false),
    });
  }

  /* ── Exports ─────────────────────────────────────────────────── */

  exportReport(type: string, format: ReportFormat): void {
    const key = `${type}:${format}`;
    this.downloading.update(d => ({ ...d, [key]: true }));

    const url = `${API.ADMIN_REPORTS}/${type}/export?format=${format}`;
    this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
      next: res => {
        const blob = res.body;
        if (blob) {
          const filename = this.parseFilename(res.headers.get('content-disposition'))
            ?? `${type}-report.${format}`;
          this.triggerDownload(blob, filename);
        }
        this.downloading.update(d => ({ ...d, [key]: false }));
        // Reload cards so the "Last generated" timestamp refreshes.
        this.loadCards();
      },
      error: () => this.downloading.update(d => ({ ...d, [key]: false })),
    });
  }

  exportAll(format: ReportFormat = 'csv'): void {
    if (this.downloadingAll()) return;
    this.downloadingAll.set(true);

    const url = `${API.ADMIN_REPORTS}/export-all?format=${format}`;
    this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
      next: res => {
        const blob = res.body;
        if (blob) {
          const filename = this.parseFilename(res.headers.get('content-disposition'))
            ?? `reports.zip`;
          this.triggerDownload(blob, filename);
        }
        this.downloadingAll.set(false);
        this.loadCards();
      },
      error: () => this.downloadingAll.set(false),
    });
  }

  /* ── Template helpers ────────────────────────────────────────── */

  iconFor(slug: string): string {
    return ICON_MAP[slug] ?? 'pi pi-file';
  }

  isDownloading(type: string, format: ReportFormat): boolean {
    return this.downloading()[`${type}:${format}`] === true;
  }

  /** Returns CSS variable / hex color based on compliance %. */
  complianceColor(pct: number): string {
    if (pct >= 80) return 'var(--nas-status-green-500, #16a34a)';
    if (pct >= 60) return 'var(--nas-status-amber-500, #f59e0b)';
    return 'var(--nas-status-red-500, #dc2626)';
  }

  /* ── Internal helpers ────────────────────────────────────────── */

  private triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }

  private parseFilename(header: string | null): string | null {
    if (!header) return null;
    const match = /filename\*?=(?:UTF-8''|")?([^;"\r\n]+)"?/i.exec(header);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
