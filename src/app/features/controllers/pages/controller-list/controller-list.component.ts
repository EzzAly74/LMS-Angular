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
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

/** Cross-field validator: password_confirmation must match password. */
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pwd    = group.get('password')?.value  ?? '';
  const confirm = group.get('password_confirmation')?.value ?? '';
  if (pwd && confirm && pwd !== confirm) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-controller-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    SkeletonModule,
    DialogModule,
    DropdownModule,
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
  private readonly t        = inject(TranslateService);
  private readonly fb       = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();
  private readonly search$  = new Subject<string>();

  constructor() {
    withLocaleReload(() => {
      this.refresh();
      this.loadRoles();
    });
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
  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingId  = signal<number | null>(null);
  readonly showPwd     = signal(false);
  readonly showConfirm = signal(false);

  /* ── Reactive Form ───────────────────────────────────────────── */
  readonly dialogForm = this.fb.group(
    {
      name:                  ['', [Validators.required, Validators.maxLength(255)]],
      email:                 ['', [Validators.required, Validators.email]],
      role:                  ['', Validators.required],
      password:              ['', []],
      password_confirmation: ['', []],
    },
    { validators: passwordMatchValidator },
  );

  /** Convenience accessors for the template. */
  get nameCtrl()    { return this.dialogForm.controls.name; }
  get emailCtrl()   { return this.dialogForm.controls.email; }
  get roleCtrl()    { return this.dialogForm.controls.role; }
  get pwdCtrl()     { return this.dialogForm.controls.password; }
  get confirmCtrl() { return this.dialogForm.controls.password_confirmation; }

  /* ── Computed ────────────────────────────────────────────────── */
  readonly hasRows = computed(() => this.items().length > 0);

  /** Picked-role chip preview shown next to the dropdown. */
  readonly previewChip = computed<AdminRoleListItem | null>(() => {
    const key = this.roleCtrl.value;
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
    this.showPwd.set(false);
    this.showConfirm.set(false);
    this.dialogForm.reset();
    // Password required on create
    this.pwdCtrl.setValidators([Validators.required, Validators.minLength(8)]);
    this.pwdCtrl.updateValueAndValidity();
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
          this.showPwd.set(false);
          this.showConfirm.set(false);
          // Password optional on edit
          this.pwdCtrl.setValidators([Validators.minLength(8)]);
          this.pwdCtrl.updateValueAndValidity();
          this.dialogForm.reset({
            name:                  full.name ?? '',
            email:                 full.email ?? '',
            role:                  full.role_chip?.machine_name ?? full.roles?.[0] ?? '',
            password:              '',
            password_confirmation: '',
          });
          this.dialogOpen.set(true);
        },
      });
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
  }

  togglePwd():     void { this.showPwd.update(v => !v); }
  toggleConfirm(): void { this.showConfirm.update(v => !v); }

  submit(): void {
    this.dialogForm.markAllAsTouched();
    if (this.dialogForm.invalid) return;

    const v = this.dialogForm.getRawValue();
    this.saving.set(true);

    const payload: Record<string, string> = {
      name:  v.name!.trim(),
      email: v.email!.trim(),
      role:  v.role!,
    };
    if (v.password) {
      payload['password']              = v.password;
      payload['password_confirmation'] = v.password_confirmation ?? '';
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
          summary:  this.t.instant('common.saved'),
          detail:   this.t.instant(
            this.dialogMode() === 'create' ? 'common.created' : 'common.updated',
          ),
        });
        this.refresh();
      },
      error: (err) => {
        this.saving.set(false);
        const errors: Record<string, string[]> = err?.error?.errors ?? {};
        const fieldErrors = Object.values(errors).flat();
        const detail = fieldErrors.length
          ? fieldErrors.join(' ')
          : (err?.error?.message ?? this.t.instant('common.operation_failed'));
        this.messages.add({
          severity: 'error',
          summary:  this.t.instant('common.error_title'),
          detail,
        });
      },
    });
  }

  /* ── Delete ───────────────────────────────────────────────────── */
  askDelete(item: Controller): void {
    this.confirm.confirm({
      header:  this.t.instant('controllers_toasts.delete_title'),
      message: this.t.instant('confirm.delete_message_title', { title: item.name }),
      icon:    'pi pi-exclamation-triangle',
      acceptLabel: this.t.instant('common.yes_delete'),
      rejectLabel: this.t.instant('common.cancel'),
      acceptButtonStyleClass: 'ctrl-btn ctrl-btn--danger',
      rejectButtonStyleClass: 'ctrl-btn ctrl-btn--ghost',
      accept: () => {
        this.api.delete(`${API.ADMIN_CONTROLLERS}/${item.id}`).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary:  this.t.instant('common.deleted'),
              detail:   this.t.instant('controllers_toasts.removed', { name: item.name }),
            });
            this.refresh();
          },
          error: () => {
            this.messages.add({
              severity: 'error',
              summary:  this.t.instant('common.error_title'),
              detail:   this.t.instant('controllers_toasts.delete_failed'),
            });
          },
        });
      },
    });
  }

  /* ── Visual helpers ───────────────────────────────────────────── */
  initial(name: string | undefined | null): string {
    return (name ?? '').trim().charAt(0).toUpperCase() || '?';
  }

  badgeColorClass(color: string | undefined): string {
    switch (color) {
      case 'green':  return 'ctrl-badge--green';
      case 'orange': return 'ctrl-badge--orange';
      case 'red':    return 'ctrl-badge--red';
      case 'blue':   return 'ctrl-badge--blue';
      default:       return 'ctrl-badge--teal';
    }
  }

  roleLabel(opt: AdminRoleListItem): string {
    return opt.name || opt.name_en || opt.machine_name;
  }
}
