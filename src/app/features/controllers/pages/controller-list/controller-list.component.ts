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
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateModule } from '@ngx-translate/core';

import { NasPageHeaderComponent } from '../../../../shared/nas';
import { ApiService } from '../../../../core/services/api.service';
import { API } from '../../../../core/constants/api.constants';
import { withLocaleReload } from '../../../../core/utils/with-locale-reload';
import { AdminRolesApiService } from '../../../roles/services/admin-roles-api.service';
import type {
  AdminRoleListItem,
  AdminRoleColor,
} from '../../../roles/models/role.types';

/* ── Types ──────────────────────────────────────────────────────── */

interface ControllerRoleChip {
  id: number;
  machine_name: string;
  name: string;
  name_en: string | null;
  name_ar: string | null;
  color: AdminRoleColor;
  is_system: boolean;
}

interface Controller {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  /** New rich chip emitted by AdminResource. */
  role_chip?: ControllerRoleChip | null;
  created_at?: string;
}

interface ControllerForm {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  /** Spatie role *machine name* (e.g. `superAdmin`, `admin`, `reports-viewer`). */
  role: string;
}

@Component({
  selector: 'app-controller-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SkeletonModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    NasPageHeaderComponent,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './controller-list.component.html',
  styleUrl: './controller-list.component.scss',
})
export class ControllerListComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly rolesApi = inject(AdminRolesApiService);
  private readonly confirm  = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  constructor() {
    withLocaleReload(() => this.refresh());
  }

  /* ── State ───────────────────────────────────────────────────── */
  readonly items   = signal<Controller[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(true);
  readonly saving  = signal(false);

  /** Rich role list used for the dropdown + as the colored chip catalog. */
  readonly roleOptions = signal<AdminRoleListItem[]>([]);

  /* ── List paging ─────────────────────────────────────────────── */
  readonly perPage = 10;
  page             = 1;
  search           = '';
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly min       = Math.min;

  /* ── Dialog state ─────────────────────────────────────────────── */
  readonly dialogOpen  = signal(false);
  readonly dialogMode  = signal<'create' | 'edit'>('create');
  readonly editingId   = signal<number | null>(null);
  readonly form        = signal<ControllerForm>(this.emptyForm());
  readonly showPwd     = signal(false);
  readonly showConfirm = signal(false);

  /* ── Computed ────────────────────────────────────────────────── */
  readonly hasRows = computed(() => this.items().length > 0);

  /** Picked-role chip preview shown next to the dropdown. */
  readonly previewChip = computed<AdminRoleListItem | null>(() => {
    const key = this.form().role;
    if (!key) return null;
    return this.roleOptions().find(r => r.machine_name === key) ?? null;
  });

  /* ── Lifecycle ───────────────────────────────────────────────── */
  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => { this.search = q; this.page = 1; this.refresh(); });

    this.refresh();
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ── Loaders ─────────────────────────────────────────────────── */
  refresh(): void {
    this.loading.set(true);
    this.api.getPaginated<Controller>(API.ADMIN_CONTROLLERS, {
      page: this.page,
      per_page: this.perPage,
      search: this.search || undefined,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.items.set(res.result.data ?? []);
        this.total.set(res.result.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRoles(): void {
    // Use the rich admin-roles list so we have name_en/name_ar/color
    // available for the dropdown swatches and badge previews.
    this.rolesApi.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => this.roleOptions.set(res.result.roles ?? []),
    });
  }

  /* ── Search / paging ─────────────────────────────────────────── */
  onSearch(term: string): void { this.search$.next(term); }
  onPage(p: number): void { this.page = p; this.refresh(); }

  /* ── Create / edit ───────────────────────────────────────────── */
  openCreate(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.form.set(this.emptyForm());
    this.showPwd.set(false);
    this.showConfirm.set(false);
    this.dialogOpen.set(true);
  }

  openEdit(item: Controller): void {
    this.api.get<Controller>(`${API.ADMIN_CONTROLLERS}/${item.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          const full = res.result;
          this.dialogMode.set('edit');
          this.editingId.set(full.id);
          this.form.set({
            name:                  full.name ?? '',
            email:                 full.email ?? '',
            password:              '',
            password_confirmation: '',
            role:                  full.role_chip?.machine_name ?? full.roles?.[0] ?? '',
          });
          this.showPwd.set(false);
          this.showConfirm.set(false);
          this.dialogOpen.set(true);
        },
      });
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
  }

  updateForm<K extends keyof ControllerForm>(field: K, value: ControllerForm[K]): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  togglePwd():     void { this.showPwd.update(v => !v); }
  toggleConfirm(): void { this.showConfirm.update(v => !v); }

  submit(): void {
    const f = this.form();
    if (!f.name.trim() || !f.email.trim() || !f.role) {
      this.messages.add({ severity: 'warn', summary: 'Required', detail: 'Name, email and role are required.' });
      return;
    }
    if (this.dialogMode() === 'create' && f.password.length < 8) {
      this.messages.add({ severity: 'warn', summary: 'Password', detail: 'Password must be at least 8 characters.' });
      return;
    }
    if (f.password && f.password !== f.password_confirmation) {
      this.messages.add({ severity: 'warn', summary: 'Password', detail: 'Passwords do not match.' });
      return;
    }

    this.saving.set(true);
    const payload: Record<string, string> = {
      name:  f.name.trim(),
      email: f.email.trim(),
      role:  f.role,
    };
    if (f.password) {
      payload['password']              = f.password;
      payload['password_confirmation'] = f.password_confirmation;
    }

    const request$ = this.dialogMode() === 'create'
      ? this.api.post(API.ADMIN_CONTROLLERS, payload)
      : this.api.put(`${API.ADMIN_CONTROLLERS}/${this.editingId()}`, payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary:  'Saved',
          detail:   this.dialogMode() === 'create' ? 'Controller created.' : 'Controller updated.',
        });
        this.refresh();
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.message ?? 'Could not save controller.';
        this.messages.add({ severity: 'error', summary: 'Error', detail });
      },
    });
  }

  /* ── Delete ───────────────────────────────────────────────────── */
  askDelete(item: Controller): void {
    this.confirm.confirm({
      header:  'Delete Controller',
      message: `Delete "${item.name}"? This action cannot be undone.`,
      icon:    'pi pi-exclamation-triangle',
      acceptLabel:    'Yes, delete',
      rejectLabel:    'Cancel',
      acceptButtonStyleClass: 'ctrl-btn ctrl-btn--danger',
      rejectButtonStyleClass: 'ctrl-btn ctrl-btn--ghost',
      accept: () => {
        this.api.delete(`${API.ADMIN_CONTROLLERS}/${item.id}`).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Deleted', detail: `${item.name} removed.` });
            this.refresh();
          },
          error: () => {
            this.messages.add({ severity: 'error', summary: 'Error', detail: 'Could not delete controller.' });
          },
        });
      },
    });
  }

  /* ── Visual helpers ───────────────────────────────────────────── */
  initial(name: string | undefined | null): string {
    return (name ?? '').trim().charAt(0).toUpperCase() || '?';
  }

  /** Tint class for a role badge (mirrors the Roles list palette). */
  badgeColorClass(color: string | undefined): string {
    switch (color) {
      case 'green':  return 'ctrl-badge--green';
      case 'orange': return 'ctrl-badge--orange';
      case 'red':    return 'ctrl-badge--red';
      case 'blue':   return 'ctrl-badge--blue';
      default:       return 'ctrl-badge--teal';
    }
  }

  /** Locale-aware label for an admin-role list item. */
  roleLabel(opt: AdminRoleListItem): string {
    return opt.name || opt.name_en || opt.machine_name;
  }

  private emptyForm(): ControllerForm {
    return { name: '', email: '', password: '', password_confirmation: '', role: '' };
  }
}
