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
import { DropdownModule } from 'primeng/dropdown';
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
  AdminUserRoleKey,
  AdminUserRoleOption,
  AdminUserSource,
  AdminUserStatus,
  AdminUserSummary,
} from '../../models/user.types';
import { NasPhotoUploadComponent } from '../../../../shared/nas/nas-photo-upload/nas-photo-upload.component';

interface UserFormState {
  id: number | null;
  source: AdminUserSource | null;
  name_en: string;
  name_ar: string;
  email: string;
  role: AdminUserRoleKey | '';
  /** Plain-text password (hashed server-side). Required on create. */
  password: string;
  /** Confirmation field — must match `password` (create only). */
  password_confirmation: string;
  /** Local preview / pending upload. `null` means "no avatar". */
  image: File | null;
  /** Existing server-side URL — drives the "Replace Photo" UX. */
  imagePreview: string | null;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    DropdownModule,
    SkeletonModule,
    ToastModule,
    TranslateModule,
    NasPageHeaderComponent,
    NasPhotoUploadComponent,
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
    // Reload primary table AND filter-modal lookups (instructors,
    // job titles, role options) on EN ↔ AR switch — otherwise the
    // instructor sub-filter modal renders old-locale names.
    withLocaleReload(() => {
      this.refresh();
      this.loadLookups();
    });
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
  /** Active role filter machine name; `null` = "All". */
  activeRole  = signal<string | null>(null);

  /* ── Lookups ─────────────────────────────────────────────────── */
  readonly lookupInstructors = signal<Array<{ id: number; name: string; email: string | null }>>([]);
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
  readonly showPassword        = signal(false);
  readonly showPasswordConfirm = signal(false);

  /* ── Deactivate confirm dialog ───────────────────────────────── */
  readonly deactivateTarget = signal<AdminUserListItem | null>(null);
  readonly deactivating     = signal(false);

  /* ── Computed ────────────────────────────────────────────────── */
  readonly formValid = computed(() => {
    const f = this.form();
    const base = f.name_en.trim().length > 0
        && f.name_ar.trim().length > 0
        && /^\S+@\S+\.\S+$/.test(f.email)
        && !!f.role;
    if (!base) return false;

    if (this.formMode() === 'create') {
      // Password + confirmation required and must match on create.
      return f.password.length >= 8 && f.password === f.password_confirmation;
    }
    // On edit the password is optional ("leave blank to keep current"),
    // but if one is typed it must be ≥ 8 chars AND match the confirmation
    // (the backend enforces the `confirmed` rule).
    return f.password.length === 0
        || (f.password.length >= 8 && f.password === f.password_confirmation);
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
      ...(this.search       ? { search: this.search }       : {}),
      ...(this.activeRole() ? { role:   this.activeRole()! } : {}),
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

  /** Select a role filter pill. Pass `null` for the "All" pill. */
  setRole(role: string | null): void {
    if (role === this.activeRole()) return;
    this.activeRole.set(role);
    this.page = 1;
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
    this.showPassword.set(false);
    this.showPasswordConfirm.set(false);
    this.form.set(this.emptyForm());
    this.formOpen.set(true);
  }

  openEditForm(user: AdminUserListItem | AdminUserDetail): void {
    this.closeMenu();
    this.formMode.set('edit');
    this.showPassword.set(false);
    this.showPasswordConfirm.set(false);
    this.form.set({
      id:        user.id,
      source:    user.source,
      name_en:   user.name_en ?? user.name ?? '',
      name_ar:   user.name_ar ?? '',
      email:     user.email ?? '',
      // Prefer the real Spatie role so the dropdown reflects e.g. "Reports
      // Viewer" rather than the bucket; fall back to the bucket key.
      role:      user.role_machine ?? user.role_key ?? 'learner',
      password: '', password_confirmation: '',
      image:        null,
      imagePreview: user.image ?? null,
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
      role:      f.role as AdminUserRoleKey,
      // Send the password only when one was entered. On create it is
      // required (enforced by `formValid`); on edit it is optional and a
      // blank value leaves the current password untouched.
      ...(f.password
        ? { password: f.password, password_confirmation: f.password_confirmation }
        : {}),
      // Only send the image field when the admin actually picked a new
      // file. Omitting the key keeps the request as JSON and avoids
      // accidentally clearing the avatar on edit.
      ...(f.image instanceof File ? { image: f.image } : {}),
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

  /** A deactivated user shows "Reactivate" instead of "Deactivate". */
  isDeactivated(user: AdminUserListItem): boolean {
    return user.status === 'deactivated';
  }

  reactivate(user: AdminUserListItem): void {
    this.closeMenu();
    this.api.reactivate(user.source, user.id).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary:  this.t.instant('common.success_title'),
          detail:   this.t.instant('users_toasts.reactivated', { name: user.name ?? this.t.instant('common.user_one') }),
        });
        this.refresh();
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary:  this.t.instant('common.error_title'),
          detail:   this.t.instant('users_toasts.reactivate_failed'),
        });
      },
    });
  }

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
      case 'inactive':    return this.t.instant('common.inactive');
      case 'deactivated': return this.t.instant('users.deactivated_status');
      default:            return this.t.instant('common.active');
    }
  }

  complianceTone(pct: number | null): string {
    if (pct === null || pct === undefined) return '';
    if (pct >= 85) return 'u-pct--good';
    if (pct >= 60) return 'u-pct--warn';
    return 'u-pct--bad';
  }

  /** Role badge classes keyed by the configured role colour. */
  roleBadgeClass(color: string | null | undefined): string {
    const palette = ['teal', 'green', 'orange', 'red', 'blue'];
    const c = palette.includes(color ?? '') ? color : 'teal';
    return `u-role-badge u-role-badge--${c}`;
  }

  /** Toggle visibility of the password / confirmation inputs. */
  togglePassword(): void { this.showPassword.update(v => !v); }
  togglePasswordConfirm(): void { this.showPasswordConfirm.update(v => !v); }

  /* ── Avatar upload ──────────────────────────────────────────── */
  /**
   * Cache the picked file in the form state and surface a data-URL
   * preview so the swap is visible immediately. The upload itself is
   * deferred to `submitForm()` which posts it as multipart/form-data.
   */
  onPhotoPicked(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.form.update(f => ({
      ...f,
      image:        file,
      imagePreview: reader.result as string,
    }));
    reader.readAsDataURL(file);
  }

  onPhotoCleared(): void {
    this.form.update(f => ({ ...f, image: null, imagePreview: null }));
  }

  /* ── Internals ──────────────────────────────────────────────── */
  private emptyForm(): UserFormState {
    return {
      id: null, source: null, name_en: '', name_ar: '', email: '',
      role: '', password: '', password_confirmation: '',
      image: null, imagePreview: null,
    };
  }
}
