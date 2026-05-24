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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasPageHeaderComponent } from '../../../../shared/nas';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminUsersApiService } from '../../services/admin-users-api.service';
import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserRole,
  AdminUserRoleOption,
  AdminUserSource,
  AdminUserStatus,
  AdminUserSummary,
} from '../../models/user.types';

type RoleTab = 'all' | 'admin' | 'instructor';

interface UserFormState {
  id: number | null;
  source: AdminUserSource | null;
  name_en: string;
  name_ar: string;
  email: string;
  role: AdminUserRole | '';
  job_title: string;
}

@Component({
  selector: 'app-user-list',
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
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(AdminUsersApiService);
  private readonly messages = inject(MessageService);
  private readonly t        = inject(TranslateService);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly min = Math.min;

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  /* ── Data ────────────────────────────────────────────────────── */
  readonly items   = signal<AdminUserListItem[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(true);
  readonly summary = signal<AdminUserSummary>({
    total_users: 0,
    instructors: 0,
    admins:      0,
    inactive:    0,
  });
  readonly summaryLoading = signal(true);

  /* ── List state ──────────────────────────────────────────────── */
  page        = 1;
  perPage     = 15;
  search      = '';
  activeTab   = signal<RoleTab>('all');
  instructorIds: number[] = [];

  /* ── Lookups ─────────────────────────────────────────────────── */
  readonly lookupInstructors = signal<Array<{ id: number; name: string; email: string | null }>>([]);
  readonly lookupJobTitles   = signal<string[]>([]);
  readonly roleOptions       = signal<AdminUserRoleOption[]>([]);

  /* ── Row action menu (kebab) ─────────────────────────────────── */
  readonly menuOpenKey = signal<string | null>(null);

  /* ── Profile drawer ──────────────────────────────────────────── */
  readonly profile        = signal<AdminUserDetail | null>(null);
  readonly profileLoading = signal(false);

  /* ── Add / Edit modal ────────────────────────────────────────── */
  readonly formOpen    = signal(false);
  readonly formMode    = signal<'create' | 'edit'>('create');
  readonly formSaving  = signal(false);
  readonly form        = signal<UserFormState>(this.emptyForm());

  /* ── Deactivate confirm dialog ───────────────────────────────── */
  readonly deactivateTarget = signal<AdminUserListItem | null>(null);
  readonly deactivating     = signal(false);

  /* ── Instructors sub-filter modal ────────────────────────────── */
  readonly instructorModal = signal<{ open: boolean; query: string }>({ open: false, query: '' });
  readonly selectedInstructorSet = signal<Set<number>>(new Set());

  /* ── Computed ────────────────────────────────────────────────── */
  readonly formValid = computed(() => {
    const f = this.form();
    return f.name_en.trim().length > 0
        && f.name_ar.trim().length > 0
        && /^\S+@\S+\.\S+$/.test(f.email)
        && !!f.role;
  });

  readonly visibleStatusKpi = computed(() =>
    Math.max(0, this.summary().inactive),
  );

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
    this.loadSummary();
    this.loadList();
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.api.summary().subscribe({
      next: res => { this.summary.set(res.result); this.summaryLoading.set(false); },
      error: ()  => this.summaryLoading.set(false),
    });
  }

  private loadList(): void {
    this.loading.set(true);
    this.api.list({
      page:     this.page,
      per_page: this.perPage,
      ...(this.search                       ? { search:         this.search }         : {}),
      ...(this.activeTab() !== 'all'        ? { role:           this.activeTab() }    : {}),
      ...(this.instructorIds.length         ? { instructor_ids: this.instructorIds }  : {}),
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
      next: res => {
        this.lookupInstructors.set(res.result.instructors ?? []);
        this.lookupJobTitles.set(res.result.job_titles   ?? []);
        this.roleOptions.set(res.result.roles            ?? []);
      },
    });
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

  /* ── Row kebab menu ─────────────────────────────────────────── */
  toggleMenu(key: string, ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuOpenKey.set(this.menuOpenKey() === key ? null : key);
  }

  closeMenu(): void { this.menuOpenKey.set(null); }

  /* ── Profile drawer ─────────────────────────────────────────── */
  openProfile(user: AdminUserListItem): void {
    this.closeMenu();
    this.profileLoading.set(true);
    this.profile.set(user as unknown as AdminUserDetail);
    this.api.show(user.source, user.id).subscribe({
      next: res => {
        this.profile.set(res.result);
        this.profileLoading.set(false);
      },
      error: () => this.profileLoading.set(false),
    });
  }

  closeProfile(): void {
    this.profile.set(null);
    this.profileLoading.set(false);
  }

  editFromProfile(): void {
    const p = this.profile();
    if (!p) return;
    this.openEditForm(p);
    this.closeProfile();
  }

  /* ── Add / Edit user modal ──────────────────────────────────── */
  openCreateForm(): void {
    this.formMode.set('create');
    this.form.set(this.emptyForm());
    this.formOpen.set(true);
  }

  openEditForm(user: AdminUserListItem | AdminUserDetail): void {
    this.closeMenu();
    this.formMode.set('edit');
    this.form.set({
      id:        user.id,
      source:    user.source,
      name_en:   user.name_en ?? user.name ?? '',
      name_ar:   user.name_ar ?? '',
      email:     user.email ?? '',
      role:      user.role_key ?? 'learner',
      job_title: user.job_title ?? '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.formSaving()) return;
    this.formOpen.set(false);
  }

  updateForm<K extends keyof UserFormState>(field: K, value: UserFormState[K]): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  submitForm(): void {
    if (!this.formValid() || this.formSaving()) return;
    this.formSaving.set(true);

    const f = this.form();
    const payload = {
      name_en:   f.name_en.trim(),
      name_ar:   f.name_ar.trim(),
      email:     f.email.trim(),
      role:      f.role as AdminUserRole,
      job_title: f.job_title.trim() || null,
    };

    const obs = this.formMode() === 'create'
      ? this.api.create(payload)
      : this.api.update(f.source ?? 'user', f.id ?? 0, payload);

    obs.subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary:  this.t.instant('common.success_title'),
          detail:   this.t.instant(
            this.formMode() === 'create' ? 'common.created' : 'common.updated',
          ),
        });
        this.refresh();
      },
      error: (err) => {
        this.formSaving.set(false);
        const msg = err?.error?.message ?? this.t.instant('common.operation_failed');
        this.messages.add({
          severity: 'error',
          summary:  this.t.instant('common.error_title'),
          detail:   msg,
        });
      },
    });
  }

  /* ── Deactivate user ────────────────────────────────────────── */
  askDeactivate(user: AdminUserListItem): void {
    this.closeMenu();
    this.deactivateTarget.set(user);
  }

  cancelDeactivate(): void { this.deactivateTarget.set(null); }

  confirmDeactivate(): void {
    const target = this.deactivateTarget();
    if (!target || this.deactivating()) return;
    this.deactivating.set(true);

    this.api.deactivate(target.source, target.id).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.deactivateTarget.set(null);
        this.messages.add({
          severity: 'success',
          summary:  this.t.instant('common.success_title'),
          detail:   this.t.instant('users_toasts.deactivated', { name: target.name ?? this.t.instant('common.user_one') }),
        });
        this.refresh();
      },
      error: () => {
        this.deactivating.set(false);
        this.messages.add({
          severity: 'error',
          summary:  this.t.instant('common.error_title'),
          detail:   this.t.instant('users_toasts.deactivate_failed'),
        });
      },
    });
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

  filteredInstructorOptions(): Array<{ id: number; name: string }> {
    const q = this.instructorModal().query.trim().toLowerCase();
    const src = this.lookupInstructors().map(i => ({ id: i.id, name: i.name }));
    if (!q) return src;
    return src.filter(i => i.name.toLowerCase().includes(q));
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
  statusTone(s: AdminUserStatus | null | undefined): string {
    switch (s) {
      case 'active':      return 'u-status--active';
      case 'inactive':    return 'u-status--inactive';
      case 'deactivated': return 'u-status--deactivated';
      default:            return 'u-status--active';
    }
  }

  statusLabel(s: AdminUserStatus | null | undefined): string {
    switch (s) {
      case 'inactive':    return 'Inactive';
      case 'deactivated': return 'Deactivated';
      default:            return 'Active';
    }
  }

  complianceTone(pct: number | null): string {
    if (pct === null || pct === undefined) return '';
    if (pct >= 85) return 'u-pct--good';
    if (pct >= 60) return 'u-pct--warn';
    return 'u-pct--bad';
  }

  roleBadgeClass(roleKey: string): string {
    switch (roleKey) {
      case 'admin':      return 'u-role-badge u-role-badge--admin';
      case 'instructor': return 'u-role-badge u-role-badge--instructor';
      default:           return 'u-role-badge u-role-badge--learner';
    }
  }

  /* ── Internals ──────────────────────────────────────────────── */
  private emptyForm(): UserFormState {
    return { id: null, source: null, name_en: '', name_ar: '', email: '', role: '', job_title: '' };
  }
}
