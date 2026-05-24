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
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { NasIconComponent } from '../../../../shared/nas/nas-icon.component';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';

interface JobTitle {
  id: number;
  name: string;
  /** Optional because counts are only included when relation is loaded. */
  employees_count?: number;
  learners_count?: number;
  qualifications_count?: number;
  /** 0-100 — backend-computed; renders as the inline compliance bar. */
  compliance_percent?: number;
  qualifications?: Qualification[];
}

interface Qualification {
  id: number;
  name: string;
}

/**
 * Job Titles screen — Figma node 359:14969.
 *
 * Renders a 3-column grid of role cards (name • employee pill • learners
 * stat • qualifications stat • compliance bar • assign-qualification CTA)
 * with a paired "Filter your results" modal (Figma 364:8735 / 364:10066)
 * for managing each role's required qualifications.
 *
 * All data is API-driven. Compliance percent comes pre-computed from the
 * backend so the bar never lies about the underlying training state.
 */
@Component({
  selector: 'app-job-title-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, SkeletonModule, TranslateModule, NasIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-title-list.component.html',
  styleUrl: './job-title-list.component.scss',
})
export class JobTitleListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly t        = inject(TranslateService);

  /* ── List state ───────────────────────────────────────────────────── */
  items   = signal<JobTitle[]>([]);
  total   = signal(0);
  loading = signal(true);

  /** Server-side search term — debounced + sent as the `search` query param. */
  search = signal('');

  /**
   * Page size = 12 (4 rows × 3 columns) so the grid stays visually
   * dense without ever overflowing the visible viewport on a 1366×768
   * dashboard. Server pagination is mandatory now that the HR-synced
   * catalogue can grow past 200 rows.
   */
  readonly perPage = 12;
  page = signal(1);

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  /* ── Dialog state ─────────────────────────────────────────────────── */
  dialogVisible    = signal(false);
  saving           = signal(false);
  selectedJobTitle = signal<JobTitle | null>(null);

  allQualifications  = signal<Qualification[]>([]);
  selectedQualIds    = signal<Set<number>>(new Set());
  /** Initial set captured when the dialog opens — used to detect "no change". */
  initialQualIds     = signal<Set<number>>(new Set());

  modalSearch$ = new Subject<string>();
  modalSearch  = signal('');

  /** Debounced search input for the page header. */
  private readonly search$ = new Subject<string>();

  /* ── Derived ──────────────────────────────────────────────────────── */
  rangeStart = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * this.perPage + 1);
  rangeEnd   = computed(() => Math.min(this.page() * this.perPage, this.total()));
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage)));

  filteredQuals = computed(() => {
    const q = this.modalSearch().trim().toLowerCase();
    const all = this.allQualifications();
    if (!q) return all;
    return all.filter(x => x.name.toLowerCase().includes(q));
  });

  /** Save-Assignments button only lights up when the selection actually changed. */
  canSave = computed(() => {
    if (this.saving()) return false;
    const a = this.selectedQualIds();
    const b = this.initialQualIds();
    if (a.size !== b.size) return true;
    for (const id of a) if (!b.has(id)) return true;
    return false;
  });

  private readonly destroy$ = new Subject<void>();

  constructor() {
    withLocaleReload(() => {
      this.load();
      this.loadQualifications();
    });
  }

  ngOnInit(): void {
    this.modalSearch$
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this.modalSearch.set(q));

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => {
        this.search.set(q);
        this.page.set(1);
        this.load();
      });

    this.load();
    this.loadQualifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Data ─────────────────────────────────────────────────────────── */
  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page:     this.page(),
      per_page: this.perPage,
    };
    if (this.search()) {
      params['search'] = this.search();
    }

    this.api.getPaginated<JobTitle>(API.JOB_TITLES, params).subscribe({
      next: res => {
        this.items.set(res.result.data);
        this.total.set(res.result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadQualifications(): void {
    this.api.get<Qualification[]>(`${API.QUALIFICATIONS}/active`).subscribe({
      next: res => this.allQualifications.set(res.result ?? []),
    });
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  onPage(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }

  /* ── UI handlers ──────────────────────────────────────────────────── */
  /** Pick a Figma tone for the compliance bar based on the percent. */
  complianceTone(percent: number | undefined | null): 'low' | 'mid' | 'high' {
    const p = Number(percent ?? 0);
    if (p >= 80) return 'high';
    if (p >= 40) return 'mid';
    return 'low';
  }

  openDialog(jobTitle: JobTitle): void {
    this.selectedJobTitle.set(jobTitle);
    this.modalSearch.set('');
    this.selectedQualIds.set(new Set());
    this.initialQualIds.set(new Set());
    this.dialogVisible.set(true);

    /**
     * Fetch the per-role qualification map so the checkbox state reflects
     * the current backend truth — not whatever was cached from the list
     * call (which doesn't include the qualifications relation).
     */
    this.api.get<JobTitle>(`${API.JOB_TITLES}/${jobTitle.id}`).subscribe({
      next: res => {
        const ids = new Set((res.result.qualifications ?? []).map(q => q.id));
        this.selectedQualIds.set(ids);
        this.initialQualIds.set(new Set(ids));
      },
    });
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogVisible.set(false);
    this.selectedJobTitle.set(null);
    this.selectedQualIds.set(new Set());
    this.initialQualIds.set(new Set());
    this.modalSearch.set('');
  }

  onModalSearch(term: string): void {
    this.modalSearch$.next(term);
  }

  toggleQual(id: number): void {
    const next = new Set(this.selectedQualIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedQualIds.set(next);
  }

  isSelected(id: number): boolean {
    return this.selectedQualIds().has(id);
  }

  saveQualifications(): void {
    const jt = this.selectedJobTitle();
    if (!jt || !this.canSave()) return;
    this.saving.set(true);
    this.api
      .put(`${API.JOB_TITLES}/${jt.id}/qualifications`, {
        qualification_skill_ids: Array.from(this.selectedQualIds()),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messages.add({
            severity: 'success',
            summary:  this.t.instant('common.saved'),
            detail:   this.t.instant('job_titles_toasts.qualifications_updated'),
          });
          this.closeDialog();
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
