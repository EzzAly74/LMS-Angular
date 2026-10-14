import { ShortNamePipe } from '../../../../shared/pipes/short-name.pipe';
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
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NasAvatarComponent, NasPageHeaderComponent } from '../../../../shared/nas';
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
import { ToastService } from '../../../../core/services/toast.service';
import { NasCanDirective } from '../../../../shared/nas/nas-can/nas-can.directive';
import { AuthService } from '../../../../core/services/auth.service';

/** Assigned Courses rows shown before "+N more" (Figma 715:57123). */
const PROFILE_COURSES_SHOWN = 3;

interface UserFormState {
  id: number | null;
  source: AdminUserSource | null;
  name_en: string;
  name_ar: string;
  /** Instructor "Brief" (bio), bilingual. Only used when role === instructor. */
  title_en: string;
  title_ar: string;
  brief_en: string;
  brief_ar: string;
  /** Instructor LinkedIn profile (Figma 1532:63886). */
  linkedin_url: string;
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
  /** The admin removed the saved photo; sent as `remove_image` on edit (NEW2B-6160). */
  removeImage: boolean;
}

/** Photo types and size the server accepts for an account (NEW2B-6165..6167). */
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/**
 * The server's full-name rule (NEW2B-6161): two names or more, each at least
 * three letters, 100 characters at most. Returns the message key, or null.
 */
export function fullNameError(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  if ([...name].length > 100) return 'users.name_rule_max';
  const parts = name.split(' ');
  if (parts.length < 2) return 'users.name_rule_parts';
  if (parts.some(part => [...part].length < 3)) return 'users.name_rule_part_length';
  return null;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [ShortNamePipe, NasCanDirective, NasAvatarComponent, RouterLink,
    CommonModule,
    FormsModule,
    DialogModule,
    DropdownModule,
    SkeletonModule,
    TranslateModule,
    NasPageHeaderComponent,
    NasPhotoUploadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api      = inject(AdminUsersApiService);
  private readonly messages = inject(ToastService);
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
  /** The form offers only roles the signed-in admin may give (D-073). */
  readonly assignableRoles   = computed(() => this.roleOptions().filter(r => r.assignable !== false));

  /* ── Row action menu (kebab) ─────────────────────────────────── */
  readonly menuOpenKey = signal<string | null>(null);

  /* ── Profile drawer ──────────────────────────────────────────── */
  readonly profile        = signal<AdminUserDetail | null>(null);
  readonly profileLoading = signal(false);
  /** Assigned Courses shows three, then "+N more" (Figma 715:57123). */
  readonly coursesExpanded = signal(false);
  readonly visibleCourses = computed(() => {
    const courses = this.profile()?.courses ?? [];
    return this.coursesExpanded() ? courses : courses.slice(0, PROFILE_COURSES_SHOWN);
  });
  readonly hiddenCourseCount = computed(() => Math.max(0, (this.profile()?.courses?.length ?? 0) - PROFILE_COURSES_SHOWN));

  /* ── Add / Edit modal ────────────────────────────────────────── */
  readonly formOpen    = signal(false);
  readonly formMode    = signal<'create' | 'edit'>('create');
  readonly formSaving  = signal(false);
  readonly form        = signal<UserFormState>(this.emptyForm());
  readonly showPassword        = signal(false);
  readonly showPasswordConfirm = signal(false);
  /** Message key for a refused photo (wrong type or too large), shown under the picker. */
  readonly photoError          = signal<string | null>(null);
  readonly nameEnError = computed(() => fullNameError(this.form().name_en));
  readonly nameArError = computed(() => fullNameError(this.form().name_ar));

  /* ── Deactivate confirm dialog ───────────────────────────────── */
  readonly deactivateTarget = signal<AdminUserListItem | null>(null);
  readonly deactivating     = signal(false);

  /* ── Computed ────────────────────────────────────────────────── */
  /**
   * The Dashboard password rule, as the server enforces it (D-075): at least
   * 8 characters with an upper-case letter, a lower-case letter and a number.
   * Shown as a live checklist so the form never sends a password it will refuse.
   */
  readonly passwordChecks = computed(() => {
    const p = this.form().password;
    return [
      { key: 'users.password_rule_length', ok: p.length >= 8 },
      { key: 'users.password_rule_upper', ok: /\p{Lu}/u.test(p) },
      { key: 'users.password_rule_lower', ok: /\p{Ll}/u.test(p) },
      { key: 'users.password_rule_number', ok: /\d/.test(p) },
    ];
  });

  readonly passwordStrong = computed(() => this.passwordChecks().every(c => c.ok));

  readonly formValid = computed(() => {
    const f = this.form();
    const base = f.name_en.trim().length > 0
        && f.name_ar.trim().length > 0
        && !this.nameEnError()
        && !this.nameArError()
        && /^\S+@\S+\.\S+$/.test(f.email)
        && !!f.role;
    if (!base) return false;

    if (this.formMode() === 'create') {
      // Password + confirmation required and must match on create.
      return this.passwordStrong() && f.password === f.password_confirmation;
    }
    // On edit the password is optional ("leave blank to keep current"),
    // but one that is typed follows the same rule and must match.
    return f.password.length === 0
        || (this.passwordStrong() && f.password === f.password_confirmation);
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
    this.coursesExpanded.set(false);
    this.profile.set(user);
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
    this.photoError.set(null);
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
      title_en:  user.title_en ?? '',
      title_ar:  user.title_ar ?? '',
      brief_en:  user.brief_en ?? '',
      brief_ar:  user.brief_ar ?? '',
      linkedin_url: user.linkedin_url ?? '',
      email:     user.email ?? '',
      // Prefer the real Spatie role so the dropdown reflects e.g. "Reports
      // Viewer" rather than the bucket; fall back to the bucket key.
      role:      user.role_machine ?? user.role_key ?? 'learner',
      password: '', password_confirmation: '',
      image:        null,
      imagePreview: user.image ?? null,
      removeImage:  false,
    });
    this.photoError.set(null);
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
      // Brief (instructor bio) — only relevant for the instructor role, so
      // only send it then. Empty strings are allowed (clears the brief).
      ...(f.role === 'instructor'
        ? {
            title_en: f.title_en.trim(), title_ar: f.title_ar.trim(), brief_en: f.brief_en.trim(), brief_ar: f.brief_ar.trim(),
            linkedin_url: f.linkedin_url.trim() || null,
          }
        : {}),
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
      ...(this.formMode() === 'edit' && f.removeImage && !(f.image instanceof File) ? { remove_image: true } : {}),
    };
    const editingMe = this.formMode() === 'edit' && f.source === 'admin' && f.id === this.auth.currentAdmin()?.id;

    const obs = this.formMode() === 'create'
      ? this.api.create(payload)
      : this.api.update(f.source ?? 'user', f.id ?? 0, payload);

    obs.subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.messages.success(this.t.instant(
            this.formMode() === 'create' ? 'common.created' : 'common.updated',
          ));
        // Your own name / photo in the header follows at once (NEW2B-6174).
        if (editingMe) this.auth.refreshPermissions(true);
        this.refresh();
      },
      // The error interceptor shows the server's reason, once (D-072).
      error: () => this.formSaving.set(false),
    });
  }

  /* ── Deactivate user ────────────────────────────────────────── */
  askDeactivate(user: AdminUserListItem): void {
    this.closeMenu();
    this.deactivateTarget.set(user);
  }

  cancelDeactivate(): void { this.deactivateTarget.set(null); }

  /** The signed-in admin's own account: no deactivating yourself (D-073). */
  isMe(user: AdminUserListItem): boolean {
    return user.source === 'admin' && user.id === this.auth.currentAdmin()?.id;
  }

  /**
   * Only a super admin may change a super-admin account (D-073); the server
   * refuses it anyway, so the actions are not offered.
   */
  canManage(user: AdminUserListItem): boolean {
    return !user.is_super_admin || this.auth.isSuperAdmin();
  }

  /** A deactivated user shows "Reactivate" instead of "Deactivate". */
  isDeactivated(user: AdminUserListItem): boolean {
    return user.status === 'deactivated';
  }

  reactivate(user: AdminUserListItem): void {
    this.closeMenu();
    this.api.reactivate(user.source, user.id).subscribe({
      next: () => {
        this.messages.success('users_toasts.reactivated', { params: { name: user.name ?? this.t.instant('common.user_one') } });
        this.refresh();
      },
      error: () => {
        this.messages.error('users_toasts.reactivate_failed');
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
        this.messages.success('users_toasts.deactivated', { params: { name: target.name ?? this.t.instant('common.user_one') } });
        this.refresh();
      },
      error: () => {
        this.deactivating.set(false);
        this.messages.error('users_toasts.deactivate_failed');
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
    // Refuse what the server refuses, with the reason, before any upload.
    if (!PHOTO_TYPES.includes(file.type)) { this.photoError.set('users.photo_type_error'); return; }
    if (file.size > PHOTO_MAX_BYTES) { this.photoError.set('users.photo_size_error'); return; }
    this.photoError.set(null);
    const reader = new FileReader();
    reader.onload = () => this.form.update(f => ({
      ...f,
      image:        file,
      imagePreview: reader.result as string,
      removeImage:  false,
    }));
    reader.readAsDataURL(file);
  }

  onPhotoCleared(): void {
    this.photoError.set(null);
    this.form.update(f => ({ ...f, image: null, imagePreview: null, removeImage: f.id !== null }));
  }

  /* ── Internals ──────────────────────────────────────────────── */
  private emptyForm(): UserFormState {
    return {
      id: null, source: null, name_en: '', name_ar: '', title_en: '', title_ar: '', brief_en: '', brief_ar: '', linkedin_url: '', email: '',
      role: '', password: '', password_confirmation: '',
      image: null, imagePreview: null, removeImage: false,
    };
  }
}
