import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasListStateComponent, NasSkeletonComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { DEFAULT_REPORT_ICON, EVALUATION_RESPONSES, EVALUATION_SUMMARY, REPORT_ICONS } from '../../report-icons';
import { ReportExportError, ReportsApiService } from '../../services/reports-api.service';
import type { ReportDefinition, ReportFormat } from '../../models/report.model';

/**
 * Reports (Figma 2201:81876, "Report Picker"): one card per report with its
 * description, when it was last generated, Export CSV / Export Excel and the
 * arrow that opens it; "Export All" in the header zips every report. The two
 * evaluation reports are one "Evaluation Scores" card.
 */
@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [RouterLink, TranslateModule, NasListStateComponent, NasSkeletonComponent, NasDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss',
})
export class ReportListComponent {
  private readonly api = inject(ReportsApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly reports = signal<ReportDefinition[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  /** `<key>:<format>` of the export running, or `all`. */
  readonly exporting = signal<string | null>(null);
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /** The cards: the response detail opens from the evaluation card's page. */
  readonly cards = computed(() => this.reports().filter(r => r.key !== EVALUATION_RESPONSES));

  constructor() {
    withLocaleReload(() => this.load());
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api.catalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.reports.set(list); this.state.set('ready'); },
      error: () => this.state.set('error'),
    });
  }

  iconOf(key: string): string {
    return REPORT_ICONS[key] ?? DEFAULT_REPORT_ICON;
  }

  isEvaluation(report: ReportDefinition): boolean {
    return report.key === EVALUATION_SUMMARY;
  }

  isExporting(key: string, format: ReportFormat): boolean {
    return this.exporting() === `${key}:${format}`;
  }

  onExport(report: ReportDefinition, format: ReportFormat): void {
    if (this.exporting() !== null) return;
    this.exporting.set(`${report.key}:${format}`);
    this.api.export(report.key, {}, format).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.exporting.set(null); this.markExported([report.key]); },
      error: (err: unknown) => this.failed(err),
    });
  }

  onExportAll(): void {
    if (this.exporting() !== null) return;
    this.exporting.set('all');
    this.api.exportAll('xlsx').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.exporting.set(null); this.markExported(this.reports().map(r => r.key)); },
      error: (err: unknown) => this.failed(err),
    });
  }

  private markExported(keys: readonly string[]): void {
    const now = new Date().toISOString();
    this.reports.update(list => list.map(r => (keys.includes(r.key) ? { ...r, last_exported_at: now } : r)));
  }

  private failed(err: unknown): void {
    this.exporting.set(null);
    if (err instanceof ReportExportError) this.toast.warn(err.reason ?? 'errors.validation');
  }
}
