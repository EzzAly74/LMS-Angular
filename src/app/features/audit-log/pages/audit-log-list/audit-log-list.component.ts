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
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

import { NasPageHeaderComponent } from '../../../../shared/nas';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminAuditLogApiService } from '../../services/admin-audit-log-api.service';
import type {
  AdminAuditActorRole,
  AdminAuditLogAdminOption,
  AdminAuditLogFilterOptions,
  AdminAuditLogInstructorOption,
  AdminAuditLogItem,
  AdminAuditLogRoleOption,
} from '../../models/audit-log.types';

type RoleTab = 'all' | 'admin' | 'instructor';

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    SkeletonModule,
    ToastModule,
    TranslateModule,
    NasPageHeaderComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log-list.component.html',
  styleUrl: './audit-log-list.component.scss',
})
export class AuditLogListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(AdminAuditLogApiService);
  private readonly messages = inject(MessageService);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly min = Math.min;

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  /* ── Data ────────────────────────────────────────────────────── */
  readonly items   = signal<AdminAuditLogItem[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(true);

  /* ── List state ──────────────────────────────────────────────── */
  page        = 1;
  perPage     = 25;
  search      = '';
  exporting   = signal(false);

  readonly activeTab = signal<RoleTab>('all');
  instructorIds: number[] = [];

  /* ── Lookups ─────────────────────────────────────────────────── */
  readonly roleOptions       = signal<AdminAuditLogRoleOption[]>([]);
  readonly lookupInstructors = signal<AdminAuditLogInstructorOption[]>([]);
  readonly lookupAdmins      = signal<AdminAuditLogAdminOption[]>([]);

  /* ── Instructors sub-filter modal (same pattern as Users) ────── */
  readonly instructorModal = signal<{ open: boolean; query: string }>({ open: false, query: '' });
  readonly selectedInstructorSet = signal<Set<number>>(new Set());

  /* ── Computed ────────────────────────────────────────────────── */
  readonly instructorTabCount = computed(() => this.instructorIds.length);

  readonly instructorRoleCount = computed(() => {
    const opt = this.roleOptions().find(r => r.key === 'instructor');
    return opt?.count ?? 0;
  });

  readonly adminRoleCount = computed(() => {
    const opt = this.roleOptions().find(r => r.key === 'admin');
    return opt?.count ?? 0;
  });

  /* ── Lifecycle ───────────────────────────────────────────────── */
  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(v => {
        this.search = v;
        this.page   = 1;
        this.loadList();
      });

    this.loadLookups();
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */
  refresh(): void {
    this.loadList();
  }

  private loadList(): void {
    this.loading.set(true);
    const tab  = this.activeTab();
    const role = tab === 'all' ? null : tab;

    this.api.list({
      page:           this.page,
      per_page:       this.perPage,
      search:         this.search || null,
      role,
      instructor_ids: this.instructorIds.length ? this.instructorIds : null,
    }).subscribe({
      next: res => {
        this.items.set(res.result.data ?? []);
        this.total.set(res.result.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLookups(): void {
    this.api.filterOptions().subscribe({
      next: res => this.applyLookups(res.result),
    });
  }

  private applyLookups(opts: AdminAuditLogFilterOptions): void {
    this.roleOptions.set(opts.roles ?? []);
    this.lookupInstructors.set(opts.instructors ?? []);
    this.lookupAdmins.set(opts.admins ?? []);
  }

  /* ── Interactions ────────────────────────────────────────────── */
  onSearch(v: string): void { this.search$.next(v); }

  onPage(p: number): void {
    if (p < 1) return;
    this.page = p;
    this.loadList();
  }

  setTab(tab: RoleTab): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.page = 1;
    if (tab !== 'instructor') {
      this.instructorIds = [];
    }
    this.loadList();
  }

  /* ── Export ─────────────────────────────────────────────────── */
  exportLog(): void {
    if (this.exporting()) return;
    this.exporting.set(true);

    const tab  = this.activeTab();
    const role = tab === 'all' ? null : tab;

    this.api.export({
      search:         this.search || null,
      role,
      instructor_ids: this.instructorIds.length ? this.instructorIds : null,
    }).subscribe({
      next: blob => this.triggerDownload(blob),
      error: () => {
        this.exporting.set(false);
        this.messages.add({
          severity: 'error',
          summary:  'Export failed',
          detail:   'Could not generate the audit log. Please retry.',
        });
      },
    });
  }

  private triggerDownload(blob: Blob): void {
    const filename = `audit-log-${this.todayStamp()}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.exporting.set(false);
    this.messages.add({
      severity: 'success',
      summary:  'Export ready',
      detail:   `${filename} has been downloaded.`,
    });
  }

  private todayStamp(): string {
    const d = new Date();
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  /* ── Instructors sub-filter modal ───────────────────────────── */
  openInstructorModal(): void {
    if (this.activeTab() !== 'instructor') {
      this.setTab('instructor');
    }
    this.selectedInstructorSet.set(new Set(this.instructorIds));
    this.instructorModal.set({ open: true, query: '' });
  }

  closeInstructorModal(): void {
    this.instructorModal.update(s => ({ ...s, open: false }));
  }

  onInstructorQuery(v: string): void {
    this.instructorModal.update(s => ({ ...s, query: v }));
  }

  filteredInstructorOptions(): AdminAuditLogInstructorOption[] {
    const q = this.instructorModal().query.trim().toLowerCase();
    if (!q) return this.lookupInstructors();
    return this.lookupInstructors().filter(i => i.name.toLowerCase().includes(q));
  }

  toggleInstructorSelection(id: number): void {
    this.selectedInstructorSet.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isInstructorSelected(id: number): boolean {
    return this.selectedInstructorSet().has(id);
  }

  clearInstructorSelection(): void {
    this.selectedInstructorSet.set(new Set());
  }

  applyInstructorFilter(): void {
    this.instructorIds = [...this.selectedInstructorSet()];
    this.instructorModal.update(s => ({ ...s, open: false }));
    this.page = 1;
    this.loadList();
  }

  /* ── Visual helpers ─────────────────────────────────────────── */
  roleBadgeClass(role: AdminAuditActorRole | string): string {
    switch (role) {
      case 'admin':      return 'al-role-badge al-role-badge--admin';
      case 'instructor': return 'al-role-badge al-role-badge--instructor';
      case 'system':     return 'al-role-badge al-role-badge--system';
      default:           return 'al-role-badge al-role-badge--learner';
    }
  }
}
