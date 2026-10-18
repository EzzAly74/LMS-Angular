import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { NasActionMenuComponent, type NasActionMenuItem } from '../../../../shared/nas/nas-action-menu/nas-action-menu.component';
import { NasListStateComponent, NasSkeletonComponent } from '../../../../shared/nas/nas-list-state/nas-list-state.component';
import { NasDatePipe } from '../../../../shared/pipes/nas-date.pipes';
import { DEFAULT_REPORT_ICON, REPORT_ICONS } from '../../report-icons';
import { ReportExportError, ReportsApiService } from '../../services/reports-api.service';
import { asFormat, type ReportDefinition } from '../../models/report.model';

/**
 * Reports home (D-112): one card per NAS report, in the spec's order, with
 * its description, what one row is, when it was last exported, and a quick
 * export of the whole report. A report that needs a choice first (an
 * evaluation template) opens instead.
 */
@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [RouterLink, TranslateModule, NasActionMenuComponent, NasListStateComponent, NasSkeletonComponent, NasDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss',
})
export class ReportListComponent {
  private readonly api = inject(ReportsApiService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = inject(LocaleService).locale;

  readonly reports = signal<ReportDefinition[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  /** The report being exported, so only its menu shows "Exporting…". */
  readonly exporting = signal<string | null>(null);
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  readonly exportItems = computed<NasActionMenuItem[]>(() => {
    this.locale();
    return [
      { id: 'xlsx', label: this.t.instant('reports.export_excel'), icon: 'file-text' },
      { id: 'csv', label: this.t.instant('reports.export_csv'), icon: 'file-text' },
    ];
  });

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

  /** A required filter (an evaluation template) must be chosen on the report page first. */
  needsChoice(report: ReportDefinition): boolean {
    return report.filters.some(f => f.required);
  }

  missingCount(report: ReportDefinition): number {
    return report.columns.filter(c => !c.available).length;
  }

  onExport(report: ReportDefinition, format: string): void {
    const fmt = asFormat(format);
    if (this.exporting() !== null || fmt === null) return;
    this.exporting.set(report.key);
    this.api.export(report.key, {}, '', fmt).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.exporting.set(null);
        this.reports.update(list => list.map(r => (r.key === report.key ? { ...r, last_exported_at: new Date().toISOString() } : r)));
      },
      error: (err: unknown) => {
        this.exporting.set(null);
        if (err instanceof ReportExportError) this.toast.warn(err.reason ?? 'errors.validation');
      },
    });
  }
}
